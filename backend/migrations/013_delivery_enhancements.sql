-- Phase 11 — Delivery enhancements (013; was 011_delivery_enhancements.sql)

DO $$ BEGIN
  CREATE TYPE speed_tier AS ENUM ('standard', 'express');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS speed_tier speed_tier DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS receiver_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(8);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id),
  receiver_name VARCHAR(128),
  receiver_phone VARCHAR(32),
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  speed_tier speed_tier DEFAULT 'standard',
  otp_code VARCHAR(8),
  status VARCHAR(32) DEFAULT 'requested',
  courier_id UUID REFERENCES users(id),
  delivery_fee NUMERIC(12,2) DEFAULT 0,
  proof_of_delivery_url TEXT,
  receiver_signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_pricing_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  standard_fee NUMERIC(12,2) DEFAULT 10,
  express_multiplier NUMERIC(6,2) DEFAULT 1.5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO delivery_pricing_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_deliveries_sender ON deliveries(sender_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id);
