#!/usr/bin/env bash
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "$0")" && pwd)"
if [[ "$HERE" == "/opt/memora/bin" ]]; then
  export MEMORA_ROOT=/opt/memora
fi
if [[ -f /opt/memora/lib/lib.sh ]]; then
  # shellcheck disable=SC1091
  source /opt/memora/lib/lib.sh
elif [[ -f "${HERE}/../scripts/lib.sh" ]]; then
  # shellcheck disable=SC1091
  source "${HERE}/../scripts/lib.sh"
else
  echo "FAIL: cannot find lib.sh" >&2
  exit 1
fi

require_root

COMMAND="${1:-}"
shift || true

usage() {
  cat <<'EOF'
memora-deploy <command> [options]

Commands:
  preflight
  provision-secrets
  bootstrap-infra
  migrate --release-sha SHA --migrate-digest DIGEST
  seed --release-sha SHA --migrate-digest DIGEST
  rbac-dry-run --release-sha SHA --migrate-digest DIGEST
  rbac-apply --release-sha SHA --migrate-digest DIGEST --confirm MARKER
  pull --gateway-digest D --iam-digest D --migrate-digest D
  deploy-backend --release-sha SHA --gateway-digest D --iam-digest D --migrate-digest D
  health-check
  backup
  rollback
  bootstrap   (infra + optional migrate/seed/rbac + backend)
  deploy      (backup + optional migrate + backend + health)
EOF
}

parse_opts() {
  RELEASE_SHA=""
  GATEWAY_DIGEST=""
  IAM_DIGEST=""
  MIGRATE_DIGEST=""
  CONFIRM=""
  CONFIRM_BOOTSTRAP=""
  CONFIRM_MIGRATE=""
  CONFIRM_RBAC=""
  RUN_MIGRATE=0
  RUN_SEED=0
  RUN_RBAC=0
  FROM_SHA_TAGS=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --release-sha|--gateway-digest|--iam-digest|--migrate-digest|--confirm|--confirm-bootstrap|--confirm-migrate|--confirm-rbac)
        [[ $# -ge 2 ]] || die "missing value for $1"
        [[ "$2" != -* ]] || die "invalid value for $1"
        case "$1" in
          --release-sha) RELEASE_SHA="$2" ;;
          --gateway-digest) GATEWAY_DIGEST="$2" ;;
          --iam-digest) IAM_DIGEST="$2" ;;
          --migrate-digest) MIGRATE_DIGEST="$2" ;;
          --confirm) CONFIRM="$2" ;;
          --confirm-bootstrap) CONFIRM_BOOTSTRAP="$2" ;;
          --confirm-migrate) CONFIRM_MIGRATE="$2" ;;
          --confirm-rbac) CONFIRM_RBAC="$2" ;;
        esac
        shift 2
        ;;
      --from-sha-tags) FROM_SHA_TAGS=1; shift ;;
      --run-migrate) RUN_MIGRATE=1; shift ;;
      --run-seed) RUN_SEED=1; shift ;;
      --run-rbac) RUN_RBAC=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "unknown argument $1" ;;
    esac
  done
}

cmd_preflight() {
  command -v docker >/dev/null || die "docker not installed"
  docker info >/dev/null 2>&1 || die "docker daemon not reachable"
  docker compose version >/dev/null || die "docker compose plugin missing"
  [[ "$(uname -m)" == "x86_64" ]] || die "host architecture must be x86_64"
  local avail_kb
  avail_kb="$(df -Pk "${MEMORA_ROOT}" 2>/dev/null | awk 'NR==2 {print $4}')"
  if [[ -n "${avail_kb}" && "${avail_kb}" -lt 2097152 ]]; then
    die "less than 2GiB free on ${MEMORA_ROOT}"
  fi
  [[ -x /opt/memora/bin/memora-deploy ]] || die "helper binary missing; run install-deploy-helper.sh as admin"
  local owner
  owner="$(stat -c '%U:%G %a' /opt/memora/bin/memora-deploy 2>/dev/null || true)"
  log "helper ${owner}"
  log "docker $(docker version --format '{{.Server.Version}}')"
  log "compose $(docker compose version --short)"
  log "preflight ok"
}

cmd_provision_secrets() {
  ensure_dirs
  if [[ ! -f "${MEMORA_SECRETS_DIR}/infra.env" ]]; then
    local pg_pass redis_pass
    pg_pass="$(random_secret)"
    redis_pass="$(random_secret)"
    cat > "${MEMORA_SECRETS_DIR}/infra.env" <<EOF
POSTGRES_USER=memora
POSTGRES_PASSWORD=${pg_pass}
POSTGRES_DB=memora
REDIS_PASSWORD=${redis_pass}
EOF
    chmod 600 "${MEMORA_SECRETS_DIR}/infra.env"
    log "wrote infra.env (generated once)"
  else
    log "infra.env exists; not overwritten"
  fi

  load_env_file "${MEMORA_SECRETS_DIR}/infra.env"
  [[ ${#REDIS_PASSWORD} -ge 16 ]] || die "REDIS_PASSWORD must be at least 16 characters"

  if [[ ! -f "${MEMORA_SECRETS_DIR}/iam.env" ]]; then
    die "create ${MEMORA_SECRETS_DIR}/iam.env from iam.env.example (JWT/peppers/email URL required)"
  fi
  if [[ ! -f "${MEMORA_SECRETS_DIR}/gateway.env" ]]; then
    die "create ${MEMORA_SECRETS_DIR}/gateway.env from gateway.env.example"
  fi
  if [[ ! -f "${MEMORA_SECRETS_DIR}/ghcr.env" ]]; then
    die "create ${MEMORA_SECRETS_DIR}/ghcr.env with read:packages token"
  fi
}

cmd_bootstrap_infra() {
  ensure_dirs
  cmd_provision_secrets
  legacy_volume_collision
  assert_managed_or_absent memora-postgres infra
  assert_managed_or_absent memora-redis infra
  ensure_network
  export MEMORA_SECRETS_DIR
  load_env_file "${MEMORA_SECRETS_DIR}/infra.env"
  compose_infra up -d --no-recreate
  wait_healthy memora-postgres
  wait_healthy memora-redis
  touch "${MEMORA_STATE_DIR}/infra-ready"
  log "infra ready"
}

run_migrate_container() {
  local entrypoint="$1"
  shift
  [[ "$entrypoint" == "npx" ]] || die "migrate entrypoint must be npx"
  load_env_file "${RELEASE_ENV}"
  load_env_file "${MEMORA_SECRETS_DIR}/iam.env"
  [[ "${MIGRATE_IMAGE:-}" == ghcr.io/m3mora/memora-iam-migrate@sha256:* ]] || die "MIGRATE_IMAGE is not a pinned GHCR digest"
  docker run --rm \
    --network "${MEMORA_NETWORK}" \
    --env-file "${MEMORA_SECRETS_DIR}/iam.env" \
    -e NODE_ENV=production \
    --entrypoint npx \
    "${MIGRATE_IMAGE}" \
    "$@"
}

cmd_migrate() {
  [[ -f "${MEMORA_STATE_DIR}/infra-ready" ]] || die "infra not bootstrapped"
  run_migrate_container npx prisma migrate deploy --config apps/iam-service/prisma.config.ts
  log "prisma migrate deploy finished"
}

cmd_seed() {
  run_migrate_container npx tsx apps/iam-service/prisma/seed.ts
  log "iam seed finished"
}

cmd_rbac_dry_run() {
  run_migrate_container npx tsx apps/iam-service/prisma/rbac-v1-bootstrap.ts
}

cmd_rbac_apply() {
  [[ "$CONFIRM" == "MEMORA_RBAC_V1_2026_10_15" ]] || die "rbac apply requires --confirm MEMORA_RBAC_V1_2026_10_15"
  load_env_file "${RELEASE_ENV}"
  load_env_file "${MEMORA_SECRETS_DIR}/iam.env"
  docker run --rm \
    --network "${MEMORA_NETWORK}" \
    --env-file "${MEMORA_SECRETS_DIR}/iam.env" \
    -e NODE_ENV=production \
    -e MEMORA_RBAC_PRODUCTION_CONFIRM=MEMORA_RBAC_V1_2026_10_15 \
    --entrypoint npx \
    "${MIGRATE_IMAGE}" \
    tsx apps/iam-service/prisma/rbac-v1-bootstrap.ts --apply
}

cmd_pull() {
  ghcr_login
  load_env_file "${RELEASE_ENV}"
  docker pull "${GATEWAY_IMAGE}"
  docker pull "${IAM_IMAGE}"
  docker pull "${MIGRATE_IMAGE}"
  docker image inspect "${GATEWAY_IMAGE}" >/dev/null
  docker image inspect "${IAM_IMAGE}" >/dev/null
  docker image inspect "${MIGRATE_IMAGE}" >/dev/null
  log "pulled gateway/iam/migrate images"
}

cmd_deploy_backend() {
  [[ -f "${MEMORA_STATE_DIR}/infra-ready" ]] || die "infra not bootstrapped"
  assert_managed_or_absent memora-api-gateway backend
  assert_managed_or_absent memora-iam-service backend
  export MEMORA_SECRETS_DIR
  compose_backend up -d --pull never
  wait_healthy memora-iam-service 48
  wait_healthy memora-api-gateway 36
  cmd_health_check
}

cmd_health_check() {
  docker exec memora-iam-service node -e "fetch('http://127.0.0.1:5051/health/ready').then(async(r)=>{const t=await r.text(); if(!r.ok){console.error(t); process.exit(1)} console.log(t)})"
  docker exec memora-api-gateway node -e "fetch('http://127.0.0.1:3000/health/ready').then(async(r)=>{const t=await r.text(); if(!r.ok){console.error(t); process.exit(1)} console.log(t)})"
  log "health checks passed"
}

cmd_backup() {
  [[ -f "${MEMORA_STATE_DIR}/infra-ready" ]] || die "infra not bootstrapped"
  load_env_file "${MEMORA_SECRETS_DIR}/infra.env"
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local pg_file="${MEMORA_BACKUP_DIR}/postgres/memora-${stamp}.dump"
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" memora-postgres \
    pg_dump -U "${POSTGRES_USER}" -d memora -Fc -f "/tmp/memora.dump"
  docker cp memora-postgres:/tmp/memora.dump "${pg_file}"
  docker exec memora-postgres rm -f /tmp/memora.dump
  chmod 600 "${pg_file}"
  docker run --rm -v "${pg_file}:/backup.dump:ro" postgres:17-alpine \
    pg_restore --list /backup.dump >/dev/null
  docker exec memora-redis redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning BGSAVE >/dev/null
  sleep 2
  docker cp memora-redis:/data/dump.rdb "${MEMORA_BACKUP_DIR}/redis/memora-${stamp}.rdb"
  chmod 600 "${MEMORA_BACKUP_DIR}/redis/memora-${stamp}.rdb"
  find "${MEMORA_BACKUP_DIR}/postgres" -name 'memora-*.dump' -mtime "+${BACKUP_RETAIN_DAYS}" -delete
  find "${MEMORA_BACKUP_DIR}/redis" -name 'memora-*.rdb' -mtime "+${BACKUP_RETAIN_DAYS}" -delete
  log "backup ${stamp} written"
}

cmd_rollback() {
  [[ -f "${MEMORA_STATE_DIR}/previous-release" ]] || die "no previous release recorded"
  # shellcheck disable=SC1091
  source "${MEMORA_STATE_DIR}/previous-release"
  validate_sha "${sha}"
  validate_digest "${gateway}" gateway
  validate_digest "${iam}" iam
  validate_digest "${migrate}" migrate
  write_release_env "${sha}" "${gateway}" "${iam}" "${migrate}"
  cmd_pull
  compose_backend up -d --pull never
  wait_healthy memora-iam-service 48
  wait_healthy memora-api-gateway 36
  cmd_health_check
  log "rolled back to sha=${sha}"
}

cmd_bootstrap() {
  parse_opts "$@"
  [[ "${CONFIRM_BOOTSTRAP}" == "BOOTSTRAP" ]] || die "bootstrap requires --confirm-bootstrap BOOTSTRAP"
  validate_sha "${RELEASE_SHA}"
  validate_digest "${GATEWAY_DIGEST}" gateway
  validate_digest "${IAM_DIGEST}" iam
  validate_digest "${MIGRATE_DIGEST}" migrate
  cmd_preflight
  write_release_env "${RELEASE_SHA}" "${GATEWAY_DIGEST}" "${IAM_DIGEST}" "${MIGRATE_DIGEST}"
  cmd_bootstrap_infra
  cmd_pull
  if [[ "${CONFIRM_MIGRATE}" == "MIGRATE" || "${RUN_MIGRATE}" -eq 1 ]]; then
    cmd_migrate
  else
    log "skip migrate (no --confirm-migrate MIGRATE)"
  fi
  if [[ "${RUN_SEED}" -eq 1 ]]; then
    cmd_seed
  fi
  if [[ "${RUN_RBAC}" -eq 1 ]]; then
    CONFIRM="${CONFIRM_RBAC}"
    cmd_rbac_apply
  fi
  cmd_deploy_backend
  record_release "${RELEASE_SHA}" "${GATEWAY_DIGEST}" "${IAM_DIGEST}" "${MIGRATE_DIGEST}" bootstrap
  touch "${MEMORA_STATE_DIR}/bootstrap-complete"
  log "bootstrap complete"
}

resolve_digests_from_sha_tags() {
  validate_sha "${RELEASE_SHA}"
  ghcr_login
  GATEWAY_DIGEST="$(image_digest_after_pull "ghcr.io/m3mora/memora-api-gateway:${RELEASE_SHA}" gateway)"
  IAM_DIGEST="$(image_digest_after_pull "ghcr.io/m3mora/memora-iam-service:${RELEASE_SHA}" iam)"
  MIGRATE_DIGEST="$(image_digest_after_pull "ghcr.io/m3mora/memora-iam-migrate:${RELEASE_SHA}" migrate)"
}

cmd_deploy() {
  parse_opts "$@"
  validate_sha "${RELEASE_SHA}"
  if [[ "${FROM_SHA_TAGS}" -eq 1 ]]; then
    resolve_digests_from_sha_tags
  else
    validate_digest "${GATEWAY_DIGEST}" gateway
    validate_digest "${IAM_DIGEST}" iam
    validate_digest "${MIGRATE_DIGEST}" migrate
  fi
  [[ -f "${MEMORA_STATE_DIR}/bootstrap-complete" ]] || die "bootstrap not complete; run Bootstrap Mini PC once"
  cmd_preflight
  cmd_backup
  write_release_env "${RELEASE_SHA}" "${GATEWAY_DIGEST}" "${IAM_DIGEST}" "${MIGRATE_DIGEST}"
  cmd_pull
  if [[ "${CONFIRM_MIGRATE}" == "MIGRATE" ]]; then
    cmd_migrate
  fi
  if ! cmd_deploy_backend; then
    err "deploy failed; attempting rollback"
    cmd_rollback
    die "deploy failed and rollback was attempted"
  fi
  record_release "${RELEASE_SHA}" "${GATEWAY_DIGEST}" "${IAM_DIGEST}" "${MIGRATE_DIGEST}" deploy
  log "deploy complete"
}

case "${COMMAND}" in
  preflight) cmd_preflight ;;
  provision-secrets) cmd_provision_secrets ;;
  bootstrap-infra) cmd_bootstrap_infra ;;
  migrate) parse_opts "$@"; validate_digest "${MIGRATE_DIGEST}" migrate; [[ -f "${RELEASE_ENV}" ]] || die "release.env missing"; cmd_migrate ;;
  seed) parse_opts "$@"; cmd_seed ;;
  rbac-dry-run) parse_opts "$@"; cmd_rbac_dry_run ;;
  rbac-apply) parse_opts "$@"; cmd_rbac_apply ;;
  pull) parse_opts "$@"; validate_digest "${GATEWAY_DIGEST}" gateway; validate_digest "${IAM_DIGEST}" iam; validate_digest "${MIGRATE_DIGEST}" migrate; write_release_env "${RELEASE_SHA:-unspecified}" "${GATEWAY_DIGEST}" "${IAM_DIGEST}" "${MIGRATE_DIGEST}"; cmd_pull ;;
  deploy-backend) parse_opts "$@"; validate_sha "${RELEASE_SHA}"; validate_digest "${GATEWAY_DIGEST}" gateway; validate_digest "${IAM_DIGEST}" iam; validate_digest "${MIGRATE_DIGEST}" migrate; write_release_env "${RELEASE_SHA}" "${GATEWAY_DIGEST}" "${IAM_DIGEST}" "${MIGRATE_DIGEST}"; cmd_deploy_backend ;;
  health-check) cmd_health_check ;;
  backup) cmd_backup ;;
  rollback) cmd_rollback ;;
  bootstrap) cmd_bootstrap "$@" ;;
  deploy) cmd_deploy "$@" ;;
  ""|-h|--help) usage ;;
  *) die "unknown command ${COMMAND}" ;;
esac
