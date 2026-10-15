# Mini PC backend deployment

Daily (or as-needed) **application** update after bootstrap. Does not restart Postgres/Redis, does not recreate `memora-network`, does not apply RBAC.

## Automatic deploy (push / merge to `main`)

After **Quality gates**, **Security**, and **Publish GHCR** all succeed, job **Deploy Mini PC** runs on runner `optiplex-server` (`self-hosted`, `Linux`, `X64`).

It does **not** build source. It calls:

`sudo -n /opt/memora/bin/memora-deploy deploy --release-sha $GITHUB_SHA --from-sha-tags --confirm-migrate MIGRATE`

Pull Request **không** deploy. Bootstrap infra **không** tự chạy.

Runner GitHub đang Idle **chưa** đủ: host phải có helper + secrets + **một lần** Bootstrap (xem `infrastructure-bootstrap.md`). Nếu chưa bootstrap, job CD fail với `bootstrap not complete`.

Sudoers phải khớp **user OS** của process runner (không nhất thiết tên `runner-memora-backend`).

## Manual deploy

`.github/workflows/deploy.yml` — `workflow_dispatch`, cùng runner `[self-hosted, Linux, X64]`.

`sudo -n /opt/memora/bin/memora-deploy deploy --release-sha … --gateway-digest … --iam-digest … --migrate-digest …`

Optional `--confirm-migrate MIGRATE` if that SHA contains new Prisma migrations.

## What it does

1. Preflight (Docker, disk, helper ownership).
2. Backup Postgres (`pg_dump -Fc`) + Redis RDB to `/opt/memora/backups`.
3. GHCR login from host `ghcr.env`.
4. Pull pinned digests (never `latest`).
5. `docker compose … up -d --pull never` on **backend project only**.
6. Wait for container **health**, then Gateway `/health/ready` and IAM `/health/ready`.
7. Record `/opt/memora/state/current-release`.

On application health failure the helper rolls **images** back to `previous-release`. It does **not** reverse migrations.

## Images

| Name | GHCR |
|---|---|
| Gateway | `ghcr.io/m3mora/memora-api-gateway@sha256:…` |
| IAM | `ghcr.io/m3mora/memora-iam-service@sha256:…` |
| Migrate job | `ghcr.io/m3mora/memora-iam-migrate@sha256:…` |

Copy digests from the CI **Publish GHCR** job summary for the chosen SHA.

Gateway HTTP is published as `127.0.0.1:3000` for host `cloudflared`. IAM gRPC, Postgres, Redis have **no** host ports.

`IAM_GRPC_URL=iam-service:50051`. IAM binds gRPC/health on `0.0.0.0` **inside** the container.

## Security limits (GitHub Free private org)

Branch protection is **not** enforced. Anyone who can change `main` workflows can change what the runner invokes **unless** the job only calls `/opt/memora/bin/memora-deploy` and that binary stays root-owned. `workflow_dispatch` is **not** an approval gate.

Do not run these workflows on pull requests. Do not use `memora-cd` for CI.

## First bootstrap on GitHub

1. Confirm GHCR has three images for the SHA.
2. Actions → **Bootstrap Mini PC** → Run workflow.
3. Paste SHA + three digests.
4. Type `BOOTSTRAP`, and `MIGRATE` if this is an empty `memora` database.
5. Enable seed/RBAC only for the first empty database.

Live PASS is only after that run is green **and** `/health/ready` succeeds on the Mini PC.
