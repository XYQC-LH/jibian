ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "invite_code" VARCHAR(16);

CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_code_key"
ON "users"("invite_code");

CREATE TABLE IF NOT EXISTS "invite_relations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'bound',
    "reward_credits" INTEGER NOT NULL DEFAULT 30,
    "rewarded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invite_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invite_relations_invitee_id_key"
ON "invite_relations"("invitee_id");

CREATE INDEX IF NOT EXISTS "invite_relations_inviter_id_status_idx"
ON "invite_relations"("inviter_id", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invite_relations_inviter_id_fkey'
    ) THEN
        ALTER TABLE "invite_relations"
        ADD CONSTRAINT "invite_relations_inviter_id_fkey"
        FOREIGN KEY ("inviter_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invite_relations_invitee_id_fkey'
    ) THEN
        ALTER TABLE "invite_relations"
        ADD CONSTRAINT "invite_relations_invitee_id_fkey"
        FOREIGN KEY ("invitee_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
