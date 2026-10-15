# Mini PC infrastructure bootstrap

One-time path. **Not** tied to `push` on `main`. Live bootstrap is **not** claimed until the self-hosted runner has run `bootstrap.yml` successfully.

## Before / after

**Before:** local `docker-compose.postgres.yml` / `docker-compose.redis.yml` bind `127.0.0.1` for development. GitHub-hosted CI builds images. Mini PC may already have Postgres/Redis from those files.

**After (intended):** two Compose **projects** on the Mini PC:

| Project | File on host | Containers | Volumes |
|---|---|---|---|
| `memora-infra` | `/opt/memora/infra/compose.yaml` | `memora-postgres`, `memora-redis` | `memora-infra_pgdata`, `memora-infra_redisdata` |
| `memora-backend` | `/opt/memora/backend/compose.yaml` | `memora-api-gateway`, `memora-iam-service` | none |

Shared external network: `memora-network` (Docker DNS: `postgres`, `redis`, `iam-service`, `api-gateway`).

Local compose files in the repo remain for **developer machines**. They are not the Mini PC stack. If Mini PC already has unlabeled `memora-postgres` / `memora_pgdata`, bootstrap **fails** instead of taking over.

## Host (administrator, once)

1. Ubuntu x86_64, NTP, disk/RAM, outbound GitHub/GHCR.
2. `sudo bash deploy/host/install-host-prerequisites.sh`
3. If Docker missing: `sudo bash deploy/host/install-docker.sh`
4. Create user `runner-memora-backend` for the GitHub runner. **Do not** add it to group `docker` (that is root-equivalent).
5. Install runner with label `memora-cd` as that user. Do not use it for CI.
6. `sudo bash deploy/host/install-deploy-helper.sh` from a known Git SHA.
7. Install sudoers: `deploy/host/sudoers.memora-deploy.example` → `/etc/sudoers.d/memora-deploy` (`visudo -c`).
8. Copy examples to live env files and edit:

   - `/opt/memora/secrets/gateway.env`
   - `/opt/memora/secrets/iam.env` (`IAM_DATABASE_URL` host **`postgres`**, Redis host **`redis`**, `IAM_EMAIL_ACTION_BASE_URL` real frontend origin)
   - `/opt/memora/secrets/ghcr.env` (`read:packages` only)
   - Optional: let `memora-deploy provision-secrets` generate `/opt/memora/secrets/infra.env` once

9. Leave Cloudflare Tunnel as-is; point it at `http://127.0.0.1:3000`.
10. Set `TRUST_PROXY=1` on Gateway. `SWAGGER_ENABLED=false`.

## GitHub Actions

`.github/workflows/bootstrap.yml` — `workflow_dispatch` only, runner `[self-hosted, memora-cd]`.

No checkout, no `npm`, no image build. The job calls:

`sudo -n /opt/memora/bin/memora-deploy bootstrap ...`

### Inputs

- `release_sha` (40 hex)
- `gateway_digest` / `iam_digest` / `migrate_digest` (`sha256:` + 64 hex)
- `confirm_bootstrap` = `BOOTSTRAP`
- `confirm_migrate` = `MIGRATE` to run Prisma deploy
- `run_seed` / `run_rbac` + `confirm_rbac` = `MEMORA_RBAC_V1_2026_10_15`

Idempotent: existing managed containers are not recreated; volumes are never `-v` removed; secrets files are not overwritten; Prisma migrate deploy is additive; RBAC apply is insert-only with marker.

## Prisma / RBAC

Runtime Gateway/IAM images **do not** include Prisma CLI. Migrations run in `ghcr.io/m3mora/memora-iam-migrate@digest`.

RBAC apply on Mini PC requires `MEMORA_RBAC_PRODUCTION_CONFIRM=MEMORA_RBAC_V1_2026_10_15` (same marker) so `NODE_ENV=production` and host `postgres` are allowed. Grants/checksums are unchanged.

## GHCR

Images may **not** exist until the **Publish GHCR** job on `main` has pushed gateway, iam, **and** migrate. Bootstrap will fail at pull if digests are missing — that is fail-safe, not a successful deploy.
