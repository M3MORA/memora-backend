---
name: prisma-migration-seed
description: Plan and implement a MEMORA Prisma 7 schema migration or approved idempotent seed, with source approval, safety and rollback thinking.
---
# Prisma migration / seed

1. Identify data-owning service/schema and exact deployed Prisma 7 config. Read proposed DB Tracker rows **including Review/Approval status**, related migrations, constraints and application code. Stop for unapproved business fields/permission mappings.
2. Classify: structural DDL -> versioned migration; static catalogs -> idempotent seed; assignments -> authorized admin workflow. Never silently combine.
3. For production-impacting DDL, write migration/backfill and forward recovery plan; verify impact on FK, nullable data, readers, events and indexes. Never drop/backfill without approval and backups.
4. Seed by stable business code, preserve UUIDs and disabled/revoked state; detect conflicts; avoid re-granting privileges. Roles from sheet: CUSTOMER/STORE_STAFF/MANAGER/JEWELER/DELIVERY_STAFF/ADMIN.
5. Run Prisma/schema validation, tests and local-only seed/migrate **only if authorized**. Verify repeat run and referential consistency. Do not claim production deployed.
6. Describe migration vs seed, exact SQL/Prisma files, approved source and unresolved decisions. Do not use permission examples as approved catalog.
