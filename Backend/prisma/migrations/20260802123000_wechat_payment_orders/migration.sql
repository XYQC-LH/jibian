CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "provider" VARCHAR(32) NOT NULL DEFAULT 'wechat_pay',
  "package_id" VARCHAR(64) NOT NULL,
  "out_trade_no" VARCHAR(64) NOT NULL UNIQUE,
  "prepay_id" VARCHAR(128),
  "wx_transaction_id" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "amount_fen" INTEGER NOT NULL,
  "credits" INTEGER NOT NULL,
  "failure_reason" TEXT,
  "paid_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_orders_user_id_created_at_idx"
  ON "payment_orders"("user_id", "created_at");
