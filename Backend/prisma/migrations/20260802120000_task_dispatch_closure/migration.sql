ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "ratio" VARCHAR(16) NOT NULL DEFAULT '1:1';

CREATE UNIQUE INDEX IF NOT EXISTS "tasks_user_id_idempotency_key_key"
  ON "tasks"("user_id", "idempotency_key");

ALTER TABLE "source_runs"
  ADD COLUMN IF NOT EXISTS "latency_ms" INTEGER;

ALTER TABLE "user_creations"
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;
