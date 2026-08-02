CREATE TABLE "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_order_id" uuid NOT NULL REFERENCES "payment_orders"("id"),
  "out_refund_no" varchar(64) NOT NULL UNIQUE,
  "wx_refund_id" varchar(128),
  "status" varchar(32) NOT NULL DEFAULT 'processing',
  "amount_fen" integer NOT NULL,
  "credits" integer NOT NULL,
  "reason" text,
  "failure_reason" text,
  "succeeded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "payment_refunds_payment_order_id_created_at_idx"
  ON "payment_refunds"("payment_order_id", "created_at");
