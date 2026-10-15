# Disaster recovery (Mini PC)

Same-host backups are **not** offsite copies. Encrypt and copy `/opt/memora/backups` elsewhere.

## What is backed up

| Component | Method | Path |
|---|---|---|
| PostgreSQL `memora` | `pg_dump -Fc` | `/opt/memora/backups/postgres/memora-<utc>.dump` |
| Redis | `BGSAVE` then copy `dump.rdb` | `/opt/memora/backups/redis/memora-<utc>.rdb` |

Helper: `sudo /opt/memora/bin/memora-deploy backup`

Retention: `MEMORA_BACKUP_RETAIN_DAYS` (default 7) deletes only `memora-*.dump` / `memora-*.rdb` older than that. Other files are left alone.

Dump listing is verified with `pg_restore --list` in a throwaway `postgres:17-alpine` container. **Restore has not been live-tested in this phase** unless an isolated restore drill is recorded below.

## Restore Postgres (isolated — do not overwrite production)

```bash
docker network create memora-restore-test
docker run -d --name memora-restore-pg --network memora-restore-test \
  -e POSTGRES_PASSWORD=restore-only -e POSTGRES_DB=memora postgres:17-alpine
docker cp /opt/memora/backups/postgres/memora-YYYYMMDD.dump memora-restore-pg:/tmp/restore.dump
docker exec memora-restore-pg pg_restore -U postgres -d memora --no-owner /tmp/restore.dump
docker rm -f memora-restore-pg
docker network rm memora-restore-test
```

Never `pg_restore` into `memora-postgres` without an explicit incident plan.

## Restore Redis

Copy an RDB into a **new** Redis container. Do not `FLUSHALL` / `FLUSHDB` on production. IAM sessions in Redis are more important than cache/queue logical DBs 1–2 (not security isolation).

## Application rollback

`sudo /opt/memora/bin/memora-deploy rollback` uses `/opt/memora/state/previous-release` image digests. Database schema is **not** rolled back.

## Schedule (admin crontab)

```
15 3 * * * /usr/bin/sudo -n /opt/memora/bin/memora-deploy backup
```

## Isolated restore drill

- Date:
- Operator:
- Isolated Postgres restore: not run / PASS / FAIL
- Isolated Redis restore: not run / PASS / FAIL
