-- 072: Customer mobile home / ride / shop / parcel mockup support

-- XL ride category (mockup: Standard / XL / Premium)
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order)
SELECT 'XL', 'xl', 'suv', 6, 4
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types WHERE code = 'xl');

UPDATE vehicle_types SET sort_order = 1 WHERE code = 'standard';
UPDATE vehicle_types SET sort_order = 2 WHERE code = 'xl';
UPDATE vehicle_types SET sort_order = 3 WHERE code = 'premium';

INSERT INTO vehicle_type_pricing (vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, currency_code)
SELECT vt.id, 'NG', 800, 120, 25, 'NGN'
FROM vehicle_types vt
WHERE vt.code IN ('standard','xl','premium')
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_type_pricing p
    WHERE p.vehicle_type_id = vt.id AND p.country_code = 'NG'
  );

INSERT INTO vehicle_type_pricing (vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, currency_code)
SELECT vt.id, 'GH',
  CASE vt.code WHEN 'standard' THEN 25 WHEN 'xl' THEN 40 ELSE 55 END,
  CASE vt.code WHEN 'standard' THEN 2.5 WHEN 'xl' THEN 3.5 ELSE 5 END,
  CASE vt.code WHEN 'standard' THEN 0.25 WHEN 'xl' THEN 0.35 ELSE 0.5 END,
  'GHS'
FROM vehicle_types vt
WHERE vt.code IN ('standard','xl','premium')
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_type_pricing p
    WHERE p.vehicle_type_id = vt.id AND p.country_code = 'GH'
  );

-- Parcel package types (Document / Small Box / Large)
CREATE TABLE IF NOT EXISTS parcel_package_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  weight_label VARCHAR(64) NOT NULL,
  base_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  dvt_reward NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  icon_key VARCHAR(32) DEFAULT 'box',
  active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO parcel_package_types (code, name, weight_label, base_fee, dvt_reward, sort_order, icon_key)
SELECT * FROM (VALUES
  ('document', 'Document', 'Under 1kg', 500::numeric, 50::numeric, 1, 'document'),
  ('small_box', 'Small Box', '1-5kg', 800::numeric, 80::numeric, 2, 'box'),
  ('large', 'Large', '5-20kg', 1500::numeric, 150::numeric, 3, 'crate')
) AS v(code, name, weight_label, base_fee, dvt_reward, sort_order, icon_key)
WHERE NOT EXISTS (SELECT 1 FROM parcel_package_types LIMIT 1);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS package_type VARCHAR(32) DEFAULT 'small_box',
  ADD COLUMN IF NOT EXISTS dvt_reward NUMERIC(12,2) DEFAULT 0;

-- User home location for dashboard map pin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION;

UPDATE users SET
  home_address = COALESCE(home_address, 'Victoria Island, Lagos'),
  home_lat = COALESCE(home_lat, 6.4281),
  home_lng = COALESCE(home_lng, 3.4219)
WHERE home_address IS NULL;

-- Onboarding landing copy (single hero, not carousel-only)
CREATE TABLE IF NOT EXISTS onboarding_landing (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand VARCHAR(64) NOT NULL DEFAULT 'Movr',
  tagline VARCHAR(128) NOT NULL DEFAULT 'MOVE · SHOP · DELIVER',
  headline VARCHAR(200) NOT NULL DEFAULT 'Africa''s Super-App Is Here',
  body TEXT NOT NULL DEFAULT 'One platform for rides, shopping, deliveries, and rentals — powered by blockchain rewards.',
  cta_primary VARCHAR(64) NOT NULL DEFAULT 'Get Started',
  cta_secondary VARCHAR(128) NOT NULL DEFAULT 'Already have an account? Sign in',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO onboarding_landing (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
