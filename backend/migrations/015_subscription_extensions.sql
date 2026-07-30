-- Phase 14 — Subscription extensions (015; was 013_subscription_extensions.sql)

DO $$ BEGIN
  CREATE TYPE subscription_payment_method AS ENUM ('fiat', 'dvt');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_method subscription_payment_method DEFAULT 'fiat',
  ADD COLUMN IF NOT EXISTS discount_applied_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS list_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS subscription_discount_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_total_discount_pct NUMERIC(5,2) DEFAULT 25,
  staking_discount_pct NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_discount_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
