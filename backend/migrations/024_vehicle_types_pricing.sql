-- Phase 23 support + Phase 24 vehicle types (024; was 022_vehicle_types_pricing.sql)

DO $$ BEGIN
  CREATE TYPE vehicle_category AS ENUM (
    'motorcycle', 'tricycle', 'sedan', 'suv', 'van', 'luxury', 'bus'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  category vehicle_category NOT NULL,
  passenger_capacity INTEGER DEFAULT 4,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicle_type_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id) ON DELETE CASCADE,
  country_code VARCHAR(8) REFERENCES countries(code),
  city VARCHAR(128),
  base_fare NUMERIC(12,2) NOT NULL,
  per_km_rate NUMERIC(12,2) NOT NULL,
  per_minute_rate NUMERIC(12,2) NOT NULL,
  minimum_fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'GHS',
  cancellation_fee NUMERIC(12,2) DEFAULT 0,
  effective_from TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES vehicle_types(id);

CREATE TABLE IF NOT EXISTS voice_parse_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  utterance TEXT,
  parsed_json JSONB,
  confidence NUMERIC(5,2),
  channel VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order) VALUES
  ('Motorcycle', 'motorcycle', 'motorcycle', 1, 1),
  ('Tricycle', 'tricycle', 'tricycle', 3, 2),
  ('Standard', 'standard', 'sedan', 4, 3),
  ('Express', 'express', 'sedan', 4, 4),
  ('SUV', 'suv', 'suv', 6, 5),
  ('Van', 'van', 'van', 8, 6),
  ('Luxury', 'luxury', 'luxury', 4, 7),
  ('Premium', 'premium', 'luxury', 4, 8)
ON CONFLICT (code) DO NOTHING;

INSERT INTO vehicle_type_pricing (
  vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, minimum_fare, currency_code
)
SELECT vt.id, 'GH',
  CASE vt.code
    WHEN 'motorcycle' THEN 1.5 WHEN 'tricycle' THEN 2.0 WHEN 'standard' THEN 2.5
    WHEN 'express' THEN 3.5 WHEN 'suv' THEN 4.0 WHEN 'van' THEN 4.5
    WHEN 'luxury' THEN 6.0 WHEN 'premium' THEN 5.0 ELSE 2.5 END,
  CASE vt.code
    WHEN 'motorcycle' THEN 0.9 WHEN 'tricycle' THEN 1.1 WHEN 'standard' THEN 1.5
    WHEN 'express' THEN 2.0 WHEN 'suv' THEN 2.2 WHEN 'van' THEN 2.4
    WHEN 'luxury' THEN 3.5 WHEN 'premium' THEN 3.0 ELSE 1.5 END,
  CASE vt.code
    WHEN 'motorcycle' THEN 0.15 WHEN 'tricycle' THEN 0.2 WHEN 'standard' THEN 0.25
    WHEN 'express' THEN 0.35 WHEN 'suv' THEN 0.4 WHEN 'van' THEN 0.45
    WHEN 'luxury' THEN 0.6 WHEN 'premium' THEN 0.5 ELSE 0.25 END,
  CASE vt.code WHEN 'motorcycle' THEN 3 WHEN 'tricycle' THEN 4 ELSE 5 END,
  'GHS'
FROM vehicle_types vt
WHERE NOT EXISTS (
  SELECT 1 FROM vehicle_type_pricing p WHERE p.vehicle_type_id = vt.id AND p.country_code = 'GH'
);
