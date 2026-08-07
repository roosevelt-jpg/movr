-- Profile settings + OTP persistence + trip history seed for Ama Konadu

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  language VARCHAR(16) NOT NULL DEFAULT 'English',
  region VARCHAR(64) NOT NULL DEFAULT 'Ghana',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(128) NOT NULL,
  code_hash TEXT NOT NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'signup',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_identifier ON auth_otps (identifier, purpose)
  WHERE consumed_at IS NULL;

INSERT INTO user_settings (user_id, notifications_enabled, language, region)
SELECT id, TRUE, 'English', 'Ghana'
FROM users
WHERE phone = '+233240000000'
   OR id = 'a0000000-0000-4000-8000-0000000000a1'::uuid
ON CONFLICT (user_id) DO UPDATE
SET notifications_enabled = TRUE,
    language = 'English',
    region = 'Ghana',
    updated_at = NOW();

-- Trip history mockup rides (relative to today)
WITH cust AS (
  SELECT id FROM users
  WHERE phone = '+233240000000'
     OR id = 'a0000000-0000-4000-8000-0000000000a1'::uuid
  LIMIT 1
),
drv AS (
  SELECT id FROM users
  WHERE phone = '+233241111111'
     OR id = 'd0000000-0000-4000-8000-0000000000d1'::uuid
  LIMIT 1
)
INSERT INTO rides (
  id, customer_id, driver_id,
  pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
  pickup_address, dropoff_address,
  status, estimated_fare, actual_fare, completed_at, created_at
)
SELECT
  v.id::uuid, cust.id, drv.id,
  5.55, -0.18, 5.60, -0.17,
  v.pickup, v.dropoff,
  'completed', v.fare, v.fare,
  date_trunc('day', NOW()) - (v.days || ' days')::interval + v.tod,
  date_trunc('day', NOW()) - (v.days || ' days')::interval + v.tod
FROM cust, drv,
(VALUES
  ('f1000000-0000-4000-8000-000000000001', 'Osu', 'Airport', 45::numeric, 0, INTERVAL '14 hours 14 minutes'),
  ('f1000000-0000-4000-8000-000000000002', 'East Legon', 'Labone', 28::numeric, 1, INTERVAL '11 hours'),
  ('f1000000-0000-4000-8000-000000000003', 'Home', 'Osu', 22::numeric, 3, INTERVAL '9 hours 30 minutes')
) AS v(id, pickup, dropoff, fare, days, tod)
WHERE cust.id IS NOT NULL AND drv.id IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET pickup_address = EXCLUDED.pickup_address,
    dropoff_address = EXCLUDED.dropoff_address,
    actual_fare = EXCLUDED.actual_fare,
    estimated_fare = EXCLUDED.estimated_fare,
    status = 'completed',
    completed_at = EXCLUDED.completed_at,
    created_at = EXCLUDED.created_at;

-- Boutique 22 + Fresh Mart orders for Ama
DO $$
DECLARE
  uid UUID;
  b22 UUID;
  fm UUID;
BEGIN
  SELECT id INTO uid FROM users
  WHERE phone = '+233240000000'
     OR id = 'a0000000-0000-4000-8000-0000000000a1'::uuid
  LIMIT 1;
  SELECT id INTO b22 FROM stores WHERE name = 'Boutique 22' LIMIT 1;
  SELECT id INTO fm FROM stores WHERE name = 'Fresh Mart' LIMIT 1;
  IF uid IS NULL THEN RETURN; END IF;

  IF b22 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM marketplace_orders WHERE user_id = uid AND notes = 'history-mockup-b22'
  ) THEN
    INSERT INTO marketplace_orders (
      id, store_id, user_id, status, subtotal, total, currency, notes, created_at, updated_at
    ) VALUES (
      'f2000000-0000-4000-8000-0000000000b1'::uuid,
      b22, uid, 'completed', 330, 330, 'GHS', 'history-mockup-b22',
      date_trunc('day', NOW()) - INTERVAL '2 days' + INTERVAL '16 hours',
      NOW()
    );
  END IF;

  IF fm IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM marketplace_orders WHERE user_id = uid AND notes = 'history-mockup-fm'
  ) THEN
    INSERT INTO marketplace_orders (
      id, store_id, user_id, status, subtotal, total, currency, notes, created_at, updated_at
    ) VALUES (
      'f2000000-0000-4000-8000-0000000000f1'::uuid,
      fm, uid, 'completed', 96, 96, 'GHS', 'history-mockup-fm',
      date_trunc('day', NOW()) - INTERVAL '5 days' + INTERVAL '12 hours',
      NOW()
    );
  END IF;
END $$;
