-- Verified mobility (passport, escrow-match, named cars, org desk, multi-vehicle).
-- Additive: existing rides/matching/wallets/rentals keep working. New columns are nullable.

CREATE TABLE IF NOT EXISTS verified_classes (
  code VARCHAR(32) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  sla_guaranteed BOOLEAN NOT NULL DEFAULT TRUE,
  security_grade VARCHAR(16) NOT NULL DEFAULT 'none'
);

INSERT INTO verified_classes (code, name, description, sort_order, sla_guaranteed, security_grade)
VALUES
  ('classic', 'Classic', 'Verified everyday chauffeur', 10, TRUE, 'none'),
  ('vip', 'VIP', 'Higher spec, inspected chassis', 20, TRUE, 'none'),
  ('security', 'Security', 'Security-spec SUV with trained chauffeur', 30, TRUE, 'security'),
  ('executive', 'Executive', 'Board-level sedan / SUV', 40, TRUE, 'none'),
  ('executive_plus', 'Executive+', 'Flagship SUV with extra cabin', 50, TRUE, 'none'),
  ('armored', 'Armored', 'B6+ ballistic, insurance-gated', 60, TRUE, 'armored'),
  ('signature', 'Signature', 'Named supercar / ultra-luxury', 70, TRUE, 'none')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  sla_guaranteed = EXCLUDED.sla_guaranteed,
  security_grade = EXCLUDED.security_grade;

CREATE TABLE IF NOT EXISTS verified_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(24) NOT NULL DEFAULT 'direct',
  driver_vehicle_id UUID,
  rental_vehicle_id UUID,
  chauffeur_user_id UUID,
  class_code VARCHAR(32) NOT NULL REFERENCES verified_classes(code),
  title TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INT,
  seats INT DEFAULT 4,
  exterior_photo_url TEXT,
  interior_photo_url TEXT,
  plate_number TEXT,
  vin TEXT,
  inspection_at TIMESTAMPTZ,
  inspection_expires_at TIMESTAMPTZ,
  chauffeur_name TEXT,
  chauffeur_rating NUMERIC(4,2) DEFAULT 4.8,
  owner_price NUMERIC(12,2),
  hourly_rate NUMERIC(12,2),
  airport_rate NUMERIC(12,2),
  currency_code VARCHAR(8) DEFAULT 'NGN',
  country_code VARCHAR(4),
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  listed_for_hire BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verified_listings_class_city
  ON verified_listings (class_code, country_code, is_active);

CREATE TABLE IF NOT EXISTS verified_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  cac_number TEXT,
  monthly_spend_tier TEXT,
  team_size TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pilot',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verified_org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES verified_orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'booker',
  cost_center TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS verified_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID,
  pickup_address TEXT,
  dropoff_address TEXT,
  pickup_lat NUMERIC(10,7),
  pickup_lng NUMERIC(10,7),
  dropoff_lat NUMERIC(10,7),
  dropoff_lng NUMERIC(10,7),
  pickup_at TIMESTAMPTZ,
  notes TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'booked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verified_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID,
  movement_id UUID,
  listing_id UUID NOT NULL REFERENCES verified_listings(id),
  ride_id UUID,
  driver_id UUID,
  class_code VARCHAR(32),
  pickup_address TEXT,
  dropoff_address TEXT,
  pickup_lat NUMERIC(10,7),
  pickup_lng NUMERIC(10,7),
  dropoff_lat NUMERIC(10,7),
  dropoff_lng NUMERIC(10,7),
  pickup_at TIMESTAMPTZ,
  passengers INT NOT NULL DEFAULT 1,
  product VARCHAR(24) NOT NULL DEFAULT 'trip',
  hours NUMERIC(6,2),
  priority BOOLEAN NOT NULL DEFAULT FALSE,
  priority_surcharge NUMERIC(12,2) NOT NULL DEFAULT 0,
  quoted_fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) DEFAULT 'NGN',
  escrow_status VARCHAR(24) NOT NULL DEFAULT 'held',
  escrow_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  match_confirmed_at TIMESTAMPTZ,
  match_rejected_at TIMESTAMPTZ,
  arrived_class_code VARCHAR(32),
  sla_credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verified_bookings_user ON verified_bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_bookings_ride ON verified_bookings (ride_id);
CREATE INDEX IF NOT EXISTS idx_verified_bookings_org ON verified_bookings (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_bookings_driver ON verified_bookings (driver_id, status);

CREATE TABLE IF NOT EXISTS verified_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES verified_bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
  status VARCHAR(24) NOT NULL DEFAULT 'held',
  reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS verified_escrow_held NUMERIC(14,2) DEFAULT 0;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS verified_booking_id UUID;

CREATE INDEX IF NOT EXISTS idx_rides_verified_booking ON rides (verified_booking_id);

-- Backfill listings from existing rental fleet (additive, skip if already listed).
INSERT INTO verified_listings (
  source, rental_vehicle_id, chauffeur_user_id, class_code, title, make, model, year, seats,
  exterior_photo_url, plate_number, vin, inspection_at, inspection_expires_at,
  owner_price, hourly_rate, airport_rate, currency_code, country_code, city, chauffeur_name
)
SELECT
  'rental_vehicle',
  rv.id,
  rv.owner_user_id,
  CASE
    WHEN lower(COALESCE(rv.category, '')) LIKE '%armor%' THEN 'armored'
    WHEN lower(COALESCE(rv.category, '')) LIKE '%lux%' OR lower(COALESCE(rv.category, '')) LIKE '%premium%' THEN 'executive'
    WHEN lower(COALESCE(rv.category, '')) LIKE '%suv%' OR lower(COALESCE(rv.category, '')) LIKE '%xl%' THEN 'vip'
    ELSE 'classic'
  END,
  TRIM(CONCAT_WS(' ', rv.make, rv.model)),
  rv.make,
  rv.model,
  NULLIF(rv.year, 0),
  COALESCE(rv.seats, 4),
  rv.image_url,
  rv.plate_number,
  rv.vin,
  NOW(),
  NOW() + INTERVAL '90 days',
  COALESCE(rv.chauffeur_daily_rate, rv.daily_rate),
  ROUND(COALESCE(rv.chauffeur_daily_rate, rv.daily_rate, 0) / 8.0, 2),
  COALESCE(rv.chauffeur_daily_rate, rv.daily_rate),
  COALESCE(rv.currency_code, 'GHS'),
  rv.country_code,
  rv.city,
  'Verified chauffeur'
FROM rental_vehicles rv
WHERE COALESCE(rv.is_active, TRUE) = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM verified_listings vl WHERE vl.rental_vehicle_id = rv.id
  );

INSERT INTO verified_listings (
  source, driver_vehicle_id, chauffeur_user_id, class_code, title, make, model, year, seats,
  exterior_photo_url, plate_number, vin, inspection_at, inspection_expires_at,
  owner_price, hourly_rate, airport_rate, currency_code, chauffeur_name, chauffeur_rating
)
SELECT
  'driver_vehicle',
  dv.id,
  dv.driver_user_id,
  CASE
    WHEN lower(COALESCE(dv.vehicle_type, '')) LIKE '%lux%' OR lower(COALESCE(dv.vehicle_type, '')) LIKE '%premium%' THEN 'executive'
    WHEN lower(COALESCE(dv.vehicle_type, '')) IN ('suv', 'xl', 'van') THEN 'vip'
    ELSE 'classic'
  END,
  COALESCE(NULLIF(dv.make_model, ''), TRIM(CONCAT_WS(' ', dv.make, dv.model)), 'Verified vehicle'),
  dv.make,
  dv.model,
  NULLIF(dv.year, 0),
  4,
  dv.photo_url,
  dv.plate_number,
  dv.vin,
  NOW(),
  NOW() + INTERVAL '90 days',
  25000,
  8000,
  30000,
  'NGN',
  TRIM(CONCAT_WS(' ', u.first_name, u.last_name)),
  COALESCE(d.rating, 4.8)
FROM driver_vehicles dv
LEFT JOIN users u ON u.id = dv.driver_user_id
LEFT JOIN drivers d ON d.user_id = dv.driver_user_id
WHERE COALESCE(dv.verified, FALSE) = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM verified_listings vl WHERE vl.driver_vehicle_id = dv.id
  );
