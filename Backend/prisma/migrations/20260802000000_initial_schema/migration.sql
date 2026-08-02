CREATE SCHEMA IF NOT EXISTS "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "openid" VARCHAR(128) NOT NULL,
    "unionid" VARCHAR(128),
    "nickname" VARCHAR(64),
    "avatar_url" TEXT,
    "phone" VARCHAR(32),
    "phone_bound" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(64) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "env_synced_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "input_asset_id" UUID NOT NULL,
    "result_asset_id" UUID,
    "idempotency_key" VARCHAR(128),
    "ratio" VARCHAR(16) NOT NULL DEFAULT '1:1',
    "status" VARCHAR(32) NOT NULL DEFAULT 'running',
    "expected_result_count" INTEGER NOT NULL DEFAULT 1,
    "credit_cost" INTEGER NOT NULL DEFAULT 0,
    "credit_status" VARCHAR(32) NOT NULL DEFAULT 'charged',
    "is_visible" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "source_id" VARCHAR(128) NOT NULL,
    "upstream_job_id" VARCHAR(128),
    "status" VARCHAR(32) NOT NULL,
    "latency_ms" INTEGER,
    "cost_amount" DECIMAL(12,4),
    "source_error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "cover_asset_id" UUID,
    "prompt" TEXT NOT NULL,
    "price_credits" INTEGER NOT NULL DEFAULT 0,
    "result_count" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "generation_time_anchors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "result_count" INTEGER NOT NULL,
    "anchor_duration_seconds" DECIMAL(10,3) NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generation_time_anchors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID,
    "asset_type" VARCHAR(32) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "review_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" VARCHAR(64) NOT NULL,
    "target_id" UUID NOT NULL,
    "review_stage" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "policy_hit" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "credit_accounts" (
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS "credit_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "amount" INTEGER NOT NULL,
    "ref_type" VARCHAR(64) NOT NULL,
    "ref_id" UUID NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "redeem_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "redeem_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "settings" (
    "key" VARCHAR(128) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "user_creations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "title" VARCHAR(120),
    "cover_asset_id" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_creations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "template_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_openid_key" ON "users"("openid");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_username_key" ON "admin_users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_user_id_idempotency_key_key" ON "tasks"("user_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "generation_time_anchors_result_count_key" ON "generation_time_anchors"("result_count");
CREATE UNIQUE INDEX IF NOT EXISTS "assets_storage_key_key" ON "assets"("storage_key");
CREATE UNIQUE INDEX IF NOT EXISTS "redeem_codes_code_key" ON "redeem_codes"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_id_template_id_key" ON "favorites"("user_id", "template_id");
CREATE UNIQUE INDEX IF NOT EXISTS "template_categories_name_key" ON "template_categories"("name");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_user_id_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_template_id_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_input_asset_id_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_input_asset_id_fkey" FOREIGN KEY ("input_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_result_asset_id_fkey') THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_result_asset_id_fkey" FOREIGN KEY ("result_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_runs_task_id_fkey') THEN
        ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_cover_asset_id_fkey') THEN
        ALTER TABLE "templates" ADD CONSTRAINT "templates_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_owner_user_id_fkey') THEN
        ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_accounts_user_id_fkey') THEN
        ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_ledger_user_id_fkey') THEN
        ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_creations_user_id_fkey') THEN
        ALTER TABLE "user_creations" ADD CONSTRAINT "user_creations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_creations_task_id_fkey') THEN
        ALTER TABLE "user_creations" ADD CONSTRAINT "user_creations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_creations_cover_asset_id_fkey') THEN
        ALTER TABLE "user_creations" ADD CONSTRAINT "user_creations_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_user_id_fkey') THEN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_template_id_fkey') THEN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
