-- Durable one-time marker for MEMORA RBAC v1 grant bootstrap.
-- Repeat apply of the same key/checksum must not recreate revoked mappings.

CREATE TABLE "iam"."rbac_bootstrap_executions" (
    "key" VARCHAR(80) NOT NULL,
    "grants_checksum" VARCHAR(64) NOT NULL,
    "grants_inserted" INTEGER NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_by" VARCHAR(200),

    CONSTRAINT "rbac_bootstrap_executions_pkey" PRIMARY KEY ("key")
);
