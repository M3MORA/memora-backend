-- CreateExtension (shared PostgreSQL type; not an IAM table)
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";

CREATE SCHEMA IF NOT EXISTS "iam";

-- citext lives in public; IAM tables live in iam
SET search_path TO "iam", "public";

-- CreateTable
CREATE TABLE "iam"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "auth_provider" VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    "google_sub" VARCHAR(255),
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "email_verified_at" TIMESTAMPTZ(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "terms_version" VARCHAR(50),
    "terms_accepted_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam"."customer_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "is_primary_for_user" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(150),
    "contact_email" CITEXT NOT NULL,
    "contact_phone" VARCHAR(30),
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "account_linked_at" TIMESTAMPTZ(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam"."roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam"."permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam"."user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iam"."role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by_user_id" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "users_email_key" ON "iam"."users"("email");
CREATE UNIQUE INDEX "users_google_sub_key" ON "iam"."users"("google_sub");
CREATE UNIQUE INDEX "roles_code_key" ON "iam"."roles"("code");
CREATE UNIQUE INDEX "permissions_code_key" ON "iam"."permissions"("code");

-- One primary Customer Identity per linked user (guest rows without user_id are excluded)
CREATE UNIQUE INDEX "customer_identities_one_primary_per_user_key"
ON "iam"."customer_identities"("user_id")
WHERE "is_primary_for_user" = true AND "user_id" IS NOT NULL;

-- One active role assignment per user; revoked rows remain as history
CREATE UNIQUE INDEX "user_roles_active_user_role_key"
ON "iam"."user_roles"("user_id", "role_id")
WHERE "revoked_at" IS NULL;

-- role_permissions has no revoke history: one grant per role+permission
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key"
ON "iam"."role_permissions"("role_id", "permission_id");

-- Lookup / FK indexes
CREATE INDEX "users_created_by_user_id_idx" ON "iam"."users"("created_by_user_id");
CREATE INDEX "customer_identities_user_id_idx" ON "iam"."customer_identities"("user_id");
CREATE INDEX "customer_identities_contact_email_idx" ON "iam"."customer_identities"("contact_email");
CREATE INDEX "user_roles_user_id_idx" ON "iam"."user_roles"("user_id");
CREATE INDEX "user_roles_role_id_idx" ON "iam"."user_roles"("role_id");
CREATE INDEX "user_roles_assigned_by_user_id_idx" ON "iam"."user_roles"("assigned_by_user_id");
CREATE INDEX "role_permissions_role_id_idx" ON "iam"."role_permissions"("role_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "iam"."role_permissions"("permission_id");
CREATE INDEX "role_permissions_granted_by_user_id_idx" ON "iam"."role_permissions"("granted_by_user_id");

-- CHECK constraints
ALTER TABLE "iam"."users"
ADD CONSTRAINT "users_auth_provider_check"
CHECK ("auth_provider" IN ('LOCAL', 'GOOGLE', 'HYBRID'));

ALTER TABLE "iam"."users"
ADD CONSTRAINT "users_status_check"
CHECK ("status" IN ('ACTIVE', 'LOCKED', 'DISABLED'));

ALTER TABLE "iam"."customer_identities"
ADD CONSTRAINT "customer_identities_primary_requires_user_check"
CHECK ("is_primary_for_user" = false OR "user_id" IS NOT NULL);

-- Foreign keys
ALTER TABLE "iam"."users"
ADD CONSTRAINT "users_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "iam"."customer_identities"
ADD CONSTRAINT "customer_identities_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "iam"."user_roles"
ADD CONSTRAINT "user_roles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "iam"."user_roles"
ADD CONSTRAINT "user_roles_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "iam"."user_roles"
ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey"
FOREIGN KEY ("assigned_by_user_id") REFERENCES "iam"."users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "iam"."role_permissions"
ADD CONSTRAINT "role_permissions_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "iam"."role_permissions"
ADD CONSTRAINT "role_permissions_permission_id_fkey"
FOREIGN KEY ("permission_id") REFERENCES "iam"."permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "iam"."role_permissions"
ADD CONSTRAINT "role_permissions_granted_by_user_id_fkey"
FOREIGN KEY ("granted_by_user_id") REFERENCES "iam"."users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- Database-level updated_at
CREATE OR REPLACE FUNCTION "iam"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "users_set_updated_at"
BEFORE UPDATE ON "iam"."users"
FOR EACH ROW
EXECUTE FUNCTION "iam"."set_updated_at"();

CREATE TRIGGER "customer_identities_set_updated_at"
BEFORE UPDATE ON "iam"."customer_identities"
FOR EACH ROW
EXECUTE FUNCTION "iam"."set_updated_at"();
