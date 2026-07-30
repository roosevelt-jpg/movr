-- Phase 4 — Merchant delivery control (006; was 005_delivery_control.sql)

DO $$ BEGIN
  CREATE TYPE delivery_mode AS ENUM ('movr_courier', 'merchant_own');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS delivery_mode delivery_mode,
  ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS courier_assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_courier ON marketplace_orders(courier_id);
