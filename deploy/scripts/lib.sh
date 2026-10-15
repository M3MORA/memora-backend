# shellcheck shell=bash
# Shared helpers. Never enable set -x (secrets).

MEMORA_ROOT="${MEMORA_ROOT:-/opt/memora}"
MEMORA_SECRETS_DIR="${MEMORA_SECRETS_DIR:-${MEMORA_ROOT}/secrets}"
MEMORA_STATE_DIR="${MEMORA_STATE_DIR:-${MEMORA_ROOT}/state}"
MEMORA_BACKUP_DIR="${MEMORA_BACKUP_DIR:-${MEMORA_ROOT}/backups}"
MEMORA_RELEASES_DIR="${MEMORA_RELEASES_DIR:-${MEMORA_ROOT}/releases}"
MEMORA_NETWORK="${MEMORA_NETWORK:-memora-network}"
INFRA_COMPOSE="${INFRA_COMPOSE:-${MEMORA_ROOT}/infra/compose.yaml}"
BACKEND_COMPOSE="${BACKEND_COMPOSE:-${MEMORA_ROOT}/backend/compose.yaml}"
RELEASE_ENV="${RELEASE_ENV:-${MEMORA_ROOT}/backend/release.env}"
BACKUP_RETAIN_DAYS="${MEMORA_BACKUP_RETAIN_DAYS:-7}"

RESERVED_CONTAINERS=(memora-postgres memora-redis memora-api-gateway memora-iam-service)
RESERVED_VOLUMES=(memora-infra_pgdata memora-infra_redisdata)
LEGACY_VOLUMES=(memora_pgdata memora_redisdata)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
err() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { err "FAIL: $*"; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "memora-deploy must run as root (sudo -n /opt/memora/bin/memora-deploy ...)"
  fi
}

validate_sha() {
  local sha="$1"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "release SHA must be 40 lowercase hex chars"
}

validate_digest() {
  local digest="$1"
  local name="$2"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "${name} digest must be sha256:<64 hex>"
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || die "missing env file ${file}"
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

compose_infra() {
  docker compose --project-name memora-infra \
    --env-file "${MEMORA_SECRETS_DIR}/infra.env" \
    -f "${INFRA_COMPOSE}" \
    "$@"
}

compose_backend() {
  docker compose --project-name memora-backend \
    --env-file "${RELEASE_ENV}" \
    -f "${BACKEND_COMPOSE}" \
    "$@"
}

ensure_dirs() {
  mkdir -p "${MEMORA_SECRETS_DIR}" "${MEMORA_STATE_DIR}" "${MEMORA_BACKUP_DIR}/postgres" \
    "${MEMORA_BACKUP_DIR}/redis" "${MEMORA_RELEASES_DIR}" "${MEMORA_ROOT}/logs" \
    "${MEMORA_ROOT}/infra" "${MEMORA_ROOT}/backend"
  chmod 700 "${MEMORA_SECRETS_DIR}" "${MEMORA_BACKUP_DIR}"
}

container_label() {
  local name="$1"
  local key="$2"
  docker inspect -f "{{index .Config.Labels \"${key}\"}}" "$name" 2>/dev/null || true
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

assert_managed_or_absent() {
  local name="$1"
  local stack="$2"
  if ! container_exists "$name"; then
    return 0
  fi
  local managed
  managed="$(container_label "$name" com.memora.managed)"
  local have_stack
  have_stack="$(container_label "$name" com.memora.stack)"
  if [[ "$managed" == "true" && "$have_stack" == "$stack" ]]; then
    return 0
  fi
  die "container ${name} exists but is not MEMORA-managed (${stack}); refusing to replace"
}

legacy_volume_collision() {
  local vol
  for vol in "${LEGACY_VOLUMES[@]}"; do
    if docker volume inspect "$vol" >/dev/null 2>&1; then
      err "WARN: legacy volume ${vol} exists (local compose). Production uses memora-infra_* names and will not adopt it automatically."
    fi
  done
}

ensure_network() {
  if docker network inspect "${MEMORA_NETWORK}" >/dev/null 2>&1; then
    log "network ${MEMORA_NETWORK} already exists"
    return 0
  fi
  docker network create --label com.memora.managed=true --label com.memora.stack=infra "${MEMORA_NETWORK}"
  log "created network ${MEMORA_NETWORK}"
}

wait_healthy() {
  local name="$1"
  local attempts="${2:-36}"
  local i
  for i in $(seq 1 "$attempts"); do
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      log "${name} healthy"
      return 0
    fi
    sleep 5
  done
  docker logs --tail 80 "$name" >&2 || true
  die "${name} did not become healthy"
}

image_digest_after_pull() {
  local ref="$1"
  local label="$2"
  [[ "$ref" == ghcr.io/m3mora/memora-* ]] || die "ref ${label} is not a MEMORA GHCR image"
  docker pull "${ref}"
  local raw
  raw="$(docker image inspect --format '{{index .RepoDigests 0}}' "${ref}")"
  local digest="${raw##*@}"
  validate_digest "${digest}" "${label}"
  printf '%s\n' "${digest}"
}

ghcr_login() {
  [[ -f "${MEMORA_SECRETS_DIR}/ghcr.env" ]] || die "missing ${MEMORA_SECRETS_DIR}/ghcr.env"
  # shellcheck disable=SC1091
  source "${MEMORA_SECRETS_DIR}/ghcr.env"
  [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]] || die "GHCR_USERNAME/GHCR_TOKEN required"
  printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin >/dev/null
}

write_release_env() {
  local sha="$1"
  local gateway="$2"
  local iam="$3"
  local migrate="$4"
  validate_digest "$gateway" gateway
  validate_digest "$iam" iam
  validate_digest "$migrate" migrate
  umask 077
  cat > "${RELEASE_ENV}" <<EOF
MEMORA_RELEASE_SHA=${sha}
GATEWAY_IMAGE=ghcr.io/m3mora/memora-api-gateway@${gateway}
IAM_IMAGE=ghcr.io/m3mora/memora-iam-service@${iam}
MIGRATE_IMAGE=ghcr.io/m3mora/memora-iam-migrate@${migrate}
MEMORA_SECRETS_DIR=${MEMORA_SECRETS_DIR}
EOF
  chmod 600 "${RELEASE_ENV}"
}

record_release() {
  local sha="$1"
  local gateway="$2"
  local iam="$3"
  local migrate="$4"
  local kind="$5"
  mkdir -p "${MEMORA_STATE_DIR}"
  umask 077
  if [[ -f "${MEMORA_STATE_DIR}/current-release" ]]; then
    cp -a "${MEMORA_STATE_DIR}/current-release" "${MEMORA_STATE_DIR}/previous-release"
  fi
  cat > "${MEMORA_STATE_DIR}/current-release" <<EOF
kind=${kind}
sha=${sha}
gateway=${gateway}
iam=${iam}
migrate=${migrate}
recorded_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

random_secret() {
  openssl rand -base64 48 | tr -d '\n'
}
