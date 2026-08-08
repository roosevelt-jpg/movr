-- 080: Driver home surge, ride offers, nav steps, KYC identity step 3

-- Surge / demand for driver home
CREATE TABLE IF NOT EXISTS driver_surge_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(64) NOT NULL DEFAULT 'Lagos',
  label VARCHAR(128) NOT NULL DEFAULT 'High demand nearby',
  multiplier NUMERIC(6,2) NOT NULL DEFAULT 1.8,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO driver_surge_zones (city, label, multiplier)
SELECT 'Lagos', 'High demand nearby', 1.8
WHERE NOT EXISTS (SELECT 1 FROM driver_surge_zones WHERE city = 'Lagos' AND is_active = TRUE);

-- Incoming ride offers (countdown window)
CREATE TABLE IF NOT EXISTS ride_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending | accepted | declined | expired
  expires_at TIMESTAMPTZ NOT NULL,
  pickup_label TEXT,
  dropoff_label TEXT,
  distance_to_pickup_km NUMERIC(8,2) DEFAULT 0.8,
  trip_distance_km NUMERIC(8,2) DEFAULT 8.4,
  eta_minutes INT DEFAULT 22,
  earnings NUMERIC(12,2) DEFAULT 1400,
  surge_multiplier NUMERIC(6,2) DEFAULT 1.8,
  surge_bonus NUMERIC(12,2) DEFAULT 630,
  currency_code VARCHAR(8) DEFAULT 'NGN',
  dvt_reward NUMERIC(12,2) DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_offers_driver ON ride_offers(driver_id, status, expires_at);

-- Seed a pending demo offer for drivers with none
INSERT INTO ride_offers (
  driver_id, status, expires_at, pickup_label, dropoff_label,
  distance_to_pickup_km, trip_distance_km, eta_minutes, earnings,
  surge_multiplier, surge_bonus, currency_code, dvt_reward
)
SELECT u.id, 'pending', NOW() + INTERVAL '12 seconds',
       'Victoria Island, Lagos', 'Lekki Phase 1, Lagos',
       0.8, 8.4, 22, 1400, 1.8, 630, 'NGN', 60
FROM users u
WHERE COALESCE(u.user_type, 'customer') = 'driver'
  AND NOT EXISTS (
    SELECT 1 FROM ride_offers o WHERE o.driver_id = u.id AND o.status = 'pending'
  )
LIMIT 20;

-- Navigation step on active rides
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS nav_instruction TEXT,
  ADD COLUMN IF NOT EXISTS nav_distance_m INT,
  ADD COLUMN IF NOT EXISTS distance_remaining_km NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS driver_earnings NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS dvt_reward NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS surge_multiplier NUMERIC(6,2);

UPDATE rides SET
  nav_instruction = COALESCE(nav_instruction, 'Turn right onto Ozumba Mbadiwe Ave · 200m'),
  nav_distance_m = COALESCE(nav_distance_m, 200),
  distance_remaining_km = COALESCE(distance_remaining_km, 1.2),
  driver_earnings = COALESCE(driver_earnings, 1400),
  dvt_reward = COALESCE(dvt_reward, 60),
  surge_multiplier = COALESCE(surge_multiplier, 1.8)
WHERE status IN ('accepted', 'arrived', 'en_route', 'in_progress');

-- KYC identity verification step 3
CREATE TABLE IF NOT EXISTS driver_identity_verification (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  step INT NOT NULL DEFAULT 3,
  id_type VARCHAR(32) DEFAULT 'national_id', -- national_id | drivers_license | passport
  id_front_url TEXT,
  id_back_url TEXT,
  selfie_url TEXT,
  selfie_status VARCHAR(32) DEFAULT 'pending', -- pending | started | verified | failed
  status VARCHAR(32) DEFAULT 'in_progress', -- in_progress | submitted | verified | rejected
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_kyc_documents') THEN
    ALTER TABLE driver_kyc_documents
      ADD COLUMN IF NOT EXISTS side VARCHAR(16),
      ADD COLUMN IF NOT EXISTS id_type VARCHAR(32);
  END IF;
END $$;
