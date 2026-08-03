CREATE TABLE IF NOT EXISTS "membership_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(32) NOT NULL UNIQUE,
  "name" varchar(64) NOT NULL,
  "amount_fen" integer NOT NULL,
  "period_days" integer NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'active',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "membership_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "plan_id" uuid NOT NULL REFERENCES "membership_plans"("id"),
  "out_contract_code" varchar(64) NOT NULL UNIQUE,
  "contract_id" varchar(128) UNIQUE,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "current_period_start" timestamptz,
  "current_period_end" timestamptz,
  "next_renew_at" timestamptz,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "canceled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "membership_subscriptions_user_id_status_idx"
  ON "membership_subscriptions"("user_id", "status");

CREATE INDEX IF NOT EXISTS "membership_subscriptions_current_period_end_idx"
  ON "membership_subscriptions"("current_period_end");

CREATE INDEX IF NOT EXISTS "membership_subscriptions_next_renew_at_idx"
  ON "membership_subscriptions"("next_renew_at");

CREATE TABLE IF NOT EXISTS "membership_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscription_id" uuid NOT NULL REFERENCES "membership_subscriptions"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "plan_id" uuid NOT NULL REFERENCES "membership_plans"("id"),
  "order_type" varchar(32) NOT NULL,
  "out_trade_no" varchar(64) NOT NULL UNIQUE,
  "wx_transaction_id" varchar(128),
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "amount_fen" integer NOT NULL,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "failure_reason" text,
  "paid_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "membership_orders_user_id_created_at_idx"
  ON "membership_orders"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "membership_orders_subscription_id_created_at_idx"
  ON "membership_orders"("subscription_id", "created_at");

CREATE TABLE IF NOT EXISTS "membership_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "membership_order_id" uuid NOT NULL REFERENCES "membership_orders"("id"),
  "out_refund_no" varchar(64) NOT NULL UNIQUE,
  "wx_refund_id" varchar(128),
  "status" varchar(32) NOT NULL DEFAULT 'processing',
  "amount_fen" integer NOT NULL,
  "reason" text,
  "failure_reason" text,
  "succeeded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "membership_refunds_membership_order_id_created_at_idx"
  ON "membership_refunds"("membership_order_id", "created_at");

CREATE TABLE IF NOT EXISTS "wechat_membership_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar(128) NOT NULL UNIQUE,
  "event_type" varchar(64) NOT NULL,
  "payload" jsonb NOT NULL,
  "processed_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "membership_plans" ("code", "name", "amount_fen", "period_days", "status", "sort_order")
VALUES
  ('month', '连续包月', 1500, 30, 'active', 1),
  ('season', '连续包季', 4000, 90, 'active', 2),
  ('year', '连续包年', 10800, 365, 'active', 3)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "amount_fen" = EXCLUDED."amount_fen",
  "period_days" = EXCLUDED."period_days",
  "status" = EXCLUDED."status",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();
