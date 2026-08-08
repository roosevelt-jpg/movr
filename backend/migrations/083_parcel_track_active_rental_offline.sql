-- 083: Parcel tracking, Active Rental session, Offline capabilities

-- Parcel public ref + tracking fields
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS public_ref VARCHAR(32),
  ADD COLUMN IF NOT EXISTS status_label VARCHAR(32),
  ADD COLUMN IF NOT EXISTS eta_minutes INT DEFAULT 12,
  ADD COLUMN IF NOT EXISTS courier_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS courier_rating NUMERIC(3,2) DEFAULT 4.7,
  ADD COLUMN IF NOT EXISTS courier_phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_public_ref
  ON deliveries (public_ref) WHERE public_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS delivery_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  share_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed / refresh demo parcel MVR-P-8821
DO $$
DECLARE
  uid UUID;
  cid UUID;
  did UUID := 'a0000000-0000-4000-8000-000000008821'::uuid;
BEGIN
  SELECT id INTO uid FROM users
  WHERE COALESCE(user_type, 'customer') IN ('customer', 'rider', 'user')
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO cid FROM users
  WHERE first_name ILIKE 'Tunde' OR phone LIKE '%8821%' OR email = 'tunde.courier@movr.app'
  LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
    VALUES (
      'b0000000-0000-4000-8000-00000000c821'::uuid,
      '+2348010008821', 'tunde.courier@movr.app', 'Tunde', 'Adeyemi', 'driver', TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    cid := 'b0000000-0000-4000-8000-00000000c821'::uuid;
  END IF;

  IF uid IS NOT NULL THEN
    INSERT INTO deliveries (
      id, sender_id, courier_id, receiver_name, receiver_phone,
      pickup_address, dropoff_address, status, status_label, public_ref,
      eta_minutes, courier_name, courier_rating, courier_phone,
      package_type, delivery_fee, dvt_reward,
      scheduled_at, picked_up_at, in_transit_at, created_at
    ) VALUES (
      did, uid, cid, 'Receiver', '+2348000000000',
      '24 Admiralty Way, Lekki', 'Marina Square, Lagos Island',
      'en_route', 'En Route', 'MVR-P-8821',
      12, 'Tunde Adeyemi', 4.7, '+2348010008821',
      'small_box', 800, 80,
      NOW() - INTERVAL '2 minutes',
      NOW() - INTERVAL '15 minutes',
      NOW() - INTERVAL '10 minutes',
      NOW() - INTERVAL '2 minutes'
    )
    ON CONFLICT (id) DO UPDATE SET
      public_ref = 'MVR-P-8821',
      status = 'en_route',
      status_label = 'En Route',
      eta_minutes = 12,
      courier_name = 'Tunde Adeyemi',
      courier_rating = 4.7,
      pickup_address = '24 Admiralty Way, Lekki',
      dropoff_address = 'Marina Square, Lagos Island',
      picked_up_at = COALESCE(deliveries.picked_up_at, NOW() - INTERVAL '15 minutes'),
      in_transit_at = COALESCE(deliveries.in_transit_at, NOW() - INTERVAL '10 minutes');
  END IF;
END $$;

-- Active rental: plate, fuel, extend rate
ALTER TABLE rental_vehicles
  ADD COLUMN IF NOT EXISTS plate_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS extend_daily_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fuel_reminder TEXT DEFAULT 'Return with same fuel level. Charges apply otherwise.';

UPDATE rental_vehicles SET
  plate_number = COALESCE(plate_number, 'LAG-481-KJ'),
  color = COALESCE(color, 'Silver'),
  extend_daily_rate = COALESCE(extend_daily_rate, 22500),
  fuel_reminder = COALESCE(fuel_reminder, 'Return with same fuel level. Charges apply otherwise.')
WHERE make = 'Honda' AND model = 'CR-V';

UPDATE rental_vehicles SET
  plate_number = COALESCE(plate_number, 'LAG-' || LPAD((ABS(HASHTEXT(id::text)) % 900 + 100)::text, 3, '0') || '-KJ'),
  extend_daily_rate = COALESCE(extend_daily_rate, ROUND(daily_rate * 0.5, 0))
WHERE plate_number IS NULL;

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS extended_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extend_daily_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fuel_reminder TEXT,
  ADD COLUMN IF NOT EXISTS return_hub_id UUID REFERENCES rental_hubs(id);

-- Promote latest confirmed CR-V rental to active demo window (Apr 10 9AM → Apr 11 9AM style)
UPDATE rentals r SET
  status = 'active',
  pickup_at = COALESCE(pickup_at, date_trunc('day', NOW()) + INTERVAL '9 hours' - INTERVAL '9 hours'),
  return_at = COALESCE(return_at, NOW() + INTERVAL '14 hours 32 minutes'),
  extend_daily_rate = COALESCE(r.extend_daily_rate, 22500),
  fuel_reminder = COALESCE(
    r.fuel_reminder,
    'Return with same fuel level. Charges apply otherwise.'
  ),
  return_hub_id = COALESCE(
    r.return_hub_id,
    (SELECT id FROM rental_hubs WHERE is_default = TRUE LIMIT 1)
  )
WHERE r.id IN (
  SELECT id FROM rentals
  WHERE status IN ('confirmed', 'active', 'pending')
  ORDER BY created_at DESC
  LIMIT 5
);

-- If no active rental, insert one for first customer + CR-V
INSERT INTO rentals (
  user_id, vehicle_type_id, rental_type, rate_unit, duration, days,
  rate_amount, daily_rate, insurance_fee, dvt_discount, total_amount,
  currency, status, pickup_address, return_address,
  pickup_at, return_at, rental_vehicle_id, pickup_hub_id, return_hub_id,
  extend_daily_rate, fuel_reminder
)
SELECT
  u.id, 'suv', 'self_drive', 'daily', 1, 1,
  45000, 45000, 3000, 2000, 46000,
  'NGN', 'active',
  'Movr Hub, Victoria Island, Lagos',
  'Movr Hub, Victoria Island, Lagos',
  NOW() - INTERVAL '9 hours',
  NOW() + INTERVAL '14 hours 32 minutes',
  v.id,
  h.id, h.id,
  22500,
  'Return with same fuel level. Charges apply otherwise.'
FROM users u
CROSS JOIN rental_vehicles v
LEFT JOIN rental_hubs h ON h.is_default = TRUE
WHERE COALESCE(u.user_type, 'customer') IN ('customer', 'rider', 'user')
  AND v.make = 'Honda' AND v.model = 'CR-V'
  AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.status = 'active' AND r.user_id = u.id)
LIMIT 1;

-- Offline capabilities copy
ALTER TABLE app_status_copy
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

INSERT INTO app_status_copy (key, title, body, cta_label, meta)
VALUES (
  'no_connection',
  'No connection',
  'Please check your internet connection and try again. Your data is safe.',
  'Retry Connection',
  '{
    "secondaryCta":"Go to Settings",
    "offlineFeatures":[
      {"id":"history","label":"View recent trip history","icon":"clipboard"},
      {"id":"wallet","label":"View wallet balance","icon":"wallet"},
      {"id":"sos","label":"Access SOS contacts","icon":"sos"}
    ]
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_label = EXCLUDED.cta_label,
    meta = EXCLUDED.meta;

CREATE TABLE IF NOT EXISTS offline_capability_catalog (
  id VARCHAR(32) PRIMARY KEY,
  label VARCHAR(128) NOT NULL,
  icon_key VARCHAR(32),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO offline_capability_catalog (id, label, icon_key, sort_order) VALUES
  ('history', 'View recent trip history', 'clipboard', 1),
  ('wallet', 'View wallet balance', 'wallet', 2),
  ('sos', 'Access SOS contacts', 'sos', 3)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, icon_key = EXCLUDED.icon_key;
