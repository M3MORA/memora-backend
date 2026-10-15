# MEMORA container images (GHCR)

Phase 3.13A publishes **application images only**. There is **no Mini PC deploy job**. PostgreSQL, Redis, Cloudflare Tunnel, and RBAC bootstrap stay outside this pipeline.

## Images

| Application | Image | Platform |
|---|---|---|
| API Gateway | `ghcr.io/m3mora/memora-api-gateway` | `linux/amd64` (Mini PC x86_64) |
| IAM Service | `ghcr.io/m3mora/memora-iam-service` | `linux/amd64` |
| IAM migrate/seed/RBAC job | `ghcr.io/m3mora/memora-iam-migrate` | `linux/amd64` |

**Tag:** Git commit SHA (`github.sha`). Do **not** rely on `latest`.

**Digest:** recorded in the **Publish GHCR** job summary after push (`steps.push.outputs.digest`). Pin Compose with `image@sha256:…` when promoting a known-good SHA.

**Source:** OCI label `org.opencontainers.image.revision` = commit SHA; `org.opencontainers.image.source` = GitHub repo URL.

## Dockerfiles

- `docker/api-gateway.Dockerfile`
- `docker/iam-service.Dockerfile`

Multi-stage:

1. `npm ci` from `package-lock.json` (Node `20.20.2-bookworm-slim`, same major as CI). Runtime stages `apt-get upgrade` Debian security patches before scan.
2. Build: `npx nest build api-gateway` or `prisma:iam:generate` + `npx nest build iam-service`.
3. Runtime: `npm ci --omit=dev`, copy `dist/`, `proto/`, and (IAM) `apps/iam-service/generated/prisma`. Non-root user `memora` (uid 1001).

Entrypoints:

- Gateway: `node dist/apps/api-gateway/main.js` (HTTP `API_GATEWAY_PORT`, default 3000).
- IAM: `node dist/apps/iam-service/main.js` (gRPC `IAM_GRPC_HOST:IAM_GRPC_PORT`, health HTTP `IAM_HEALTH_HOST:IAM_HEALTH_PORT`).

Images do **not** copy `.env`. They do **not** run Prisma migrate or RBAC bootstrap.

`IAM_DATABASE_URL` during **image build** is a dummy value so Prisma Client can generate. Runtime URL comes from the Mini PC environment.

## GitHub Actions publish

Same workflow as CI: `.github/workflows/ci.yml`.

- Jobs **Quality gates** and **Security** must succeed (`needs`).
- Publish runs only when `github.ref == refs/heads/main` and the event is **not** a pull request.
- GitHub-hosted `ubuntu-latest` only (never the Mini PC self-hosted runner).
- Job permission `packages: write` is limited to this job. Workflow default remains `contents: read`.
- No `workflow_run` trigger (avoids privilege escalation).
- No production secrets in `docker build`. GHCR login uses `GITHUB_TOKEN`.
- Provenance/SBOM attestations are disabled so the job does not need `id-token`.

Local reproduction (optional, requires Docker):

```bash
docker build -f docker/api-gateway.Dockerfile -t memora-api-gateway:local .
docker build -f docker/iam-service.Dockerfile -t memora-iam-service:local .
```

## GHCR authentication (Mini PC)

Package visibility follows the **private** org repo. The Mini PC pulls with a GitHub PAT (classic: `read:packages`) or a fine-grained token that can read GHCR packages, **stored on the host**, never in Git:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
docker pull ghcr.io/m3mora/memora-api-gateway:<git-sha>
docker pull ghcr.io/m3mora/memora-iam-service:<git-sha>
```

Grant the Actions `GITHUB_TOKEN` write access to GHCR (org/repo **Actions** permissions → **Read and write** for packages, or package workflow access on first publish).

## Mini PC Compose (design only — do not apply in 3.13A)

Keep existing Postgres/Redis containers. Do **not** publish 5432/6379/50051. Cloudflare Tunnel terminates on Gateway HTTP only.

Runtime env files live on the host (for example `/etc/memora/gateway.env` and `/etc/memora/iam.env`), gitignored.

Suggested service names (not localhost):

- Gateway `IAM_GRPC_URL=iam-service:50051`
- IAM `IAM_GRPC_HOST=0.0.0.0`, `IAM_HEALTH_HOST=0.0.0.0` (default health bind is `127.0.0.1`, which is wrong inside Compose)
- IAM `IAM_REDIS_HOST` / `IAM_DATABASE_URL` → existing internal hostnames
- Gateway `TRUST_PROXY=1` behind Cloudflare Tunnel

Health:

- Gateway `GET /health/live` (liveness; `/health/ready` calls IAM gRPC)
- IAM `GET /health/live` on `IAM_HEALTH_PORT` (readiness also checks Postgres + Redis)

## Rollback

1. Identify last known-good SHA from GHCR job summary (tag + digest).
2. Point Compose at that tag/digest.
3. `docker compose up -d` **only those two app services** (leave Postgres/Redis).
4. Confirm Gateway `/health/live` through the Tunnel.

Do not migrate or re-seed to roll back an application image.

## Troubleshooting

| Symptom | Check |
|---|---|
| Publish job skipped | Push was not `main`, or Quality/Security failed, or event was a PR |
| `denied` pushing GHCR | `packages: write`, org package permissions, lowercase `m3mora` |
| IAM never becomes ready | `IAM_HEALTH_HOST=0.0.0.0`; Postgres database name must be `memora` and schema `iam` (migrate is **out of band**) |
| Gateway ready 503 | `IAM_GRPC_URL` must be the Compose service DNS, not `localhost` |
| Image contains secrets | `.dockerignore` must keep `.env` out; publish job fails if `.env` is found |
| Architecture mismatch | Images are `linux/amd64` only |

## Out of scope (Phase 3.13B+)

Self-hosted runner `memora-cd-01`, systemd, Compose apply, Cloudflare changes, production migrate/RBAC, public ports.
