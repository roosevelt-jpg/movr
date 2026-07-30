-- Phase 15 — Rental / fleet expansion (016; was 014_rental_expansion.sql)

DO $$ BEGIN
  CREATE TYPE rental_type AS ENUM ('chauffeur', 'self_drive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rental_rate_unit AS ENUM ('hourly', 'daily');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  vehicle_type_id VARCHAR(64) NOT NULL DEFAULT 'standard',
  rental_type rental_type NOT NULL DEFAULT 'chauffeur',
  rate_unit rental_rate_unit NOT NULL DEFAULT 'daily',
  duration INTEGER NOT NULL DEFAULT 1,
  rate_amount NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'GHS',
  status VARCHAR(32) DEFAULT 'pending',
  pickup_address TEXT,
  deposit_hold_reference VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS self_drive_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL UNIQUE REFERENCES rentals(id) ON DELETE CASCADE,
  license_upload_url TEXT,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_status VARCHAR(32) DEFAULT 'pending',
  license_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type_id VARCHAR(64) NOT NULL,
  rental_type rental_type NOT NULL,
  rate_unit rental_rate_unit NOT NULL,
  rate_amount NUMERIC(12,2) NOT NULL,
  currency_code VARCHAR(8) DEFAULT 'GHS',
  min_duration INTEGER DEFAULT 1,
  max_duration INTEGER DEFAULT 30,
  UNIQUE (vehicle_type_id, rental_type, rate_unit, currency_code)
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key VARCHAR(64) PRIMARY KEY,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_pct INTEGER DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rental_pricing (vehicle_type_id, rental_type, rate_unit, rate_amount, currency_code)
SELECT * FROM (VALUES
  ('standard', 'chauffeur'::rental_type, 'hourly'::rental_rate_unit, 40::numeric, 'GHS'),
  ('standard', 'chauffeur'::rental_type, 'daily'::rental_rate_unit, 250::numeric, 'GHS'),
  ('standard', 'self_drive'::rental_type, 'hourly'::rental_rate_unit, 30::numeric, 'GHS'),
  ('standard', 'self_drive'::rental_type, 'daily'::rental_rate_unit, 180::numeric, 'GHS'),
  ('suv', 'chauffeur'::rental_type, 'daily'::rental_rate_unit, 400::numeric, 'GHS'),
  ('suv', 'self_drive'::rental_type, 'daily'::rental_rate_unit, 300::numeric, 'GHS')
) AS v(vehicle_type_id, rental_type, rate_unit, rate_amount, currency_code)
WHERE NOT EXISTS (
  SELECT 1 FROM rental_pricing p
  WHERE p.vehicle_type_id = v.vehicle_type_id
    AND p.rental_type = v.rental_type
    AND p.rate_unit = v.rate_unit
    AND p.currency_code = v.currency_code
);

INSERT INTO feature_flags (key, enabled, rollout_pct) VALUES
  ('self_drive_rentals', TRUE, 100)
ON CONFLICT (key) DO NOTHING;
