-- Auth + driver pickup mockup: customer rating + seed Ama Konadu active ride
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 4.7;

-- Demo customer (Ama Konadu)
INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, is_verified
)
SELECT
  'a0000000-0000-4000-8000-0000000000a1'::uuid,
  '+233240000000',
  'ama.konadu@phone.movr',
  'Ama',
  'Konadu',
  crypt('password123', gen_salt('bf')),
  'customer',
  'GH',
  'Accra',
  TRUE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE (phone = '+233240000000' OR email = 'ama.konadu@phone.movr')
    AND id <> 'a0000000-0000-4000-8000-0000000000a1'::uuid
)
ON CONFLICT (id) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    password = EXCLUDED.password,
    updated_at = NOW();

UPDATE users
SET first_name = 'Ama',
    last_name = 'Konadu',
    password = crypt('password123', gen_salt('bf')),
    updated_at = NOW()
WHERE id = 'a0000000-0000-4000-8000-0000000000a1'::uuid
   OR phone = '+233240000000';

INSERT INTO customers (user_id, rating)
SELECT 'a0000000-0000-4000-8000-0000000000a1'::uuid, 4.7
WHERE EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-4000-8000-0000000000a1'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM customers WHERE user_id = 'a0000000-0000-4000-8000-0000000000a1'::uuid
  );

UPDATE customers
SET rating = 4.7
WHERE user_id IN (
  SELECT id FROM users WHERE phone = '+233240000000' OR id = 'a0000000-0000-4000-8000-0000000000a1'::uuid
);

INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, is_verified
)
SELECT
  'd0000000-0000-4000-8000-0000000000d1'::uuid,
  '+233241111111',
  'driver.demo@movr.app',
  'Kwame',
  'Mensah',
  crypt('password123', gen_salt('bf')),
  'driver',
  'GH',
  'Accra',
  TRUE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE (phone = '+233241111111' OR email = 'driver.demo@movr.app')
    AND id <> 'd0000000-0000-4000-8000-0000000000d1'::uuid
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO drivers (user_id, vehicle_type, is_online, rating)
SELECT 'd0000000-0000-4000-8000-0000000000d1'::uuid, 'standard', TRUE, 4.9
WHERE EXISTS (SELECT 1 FROM users WHERE id = 'd0000000-0000-4000-8000-0000000000d1'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM drivers WHERE user_id = 'd0000000-0000-4000-8000-0000000000d1'::uuid
  );

-- Resolve customer/driver ids (fixed or existing by phone)
WITH ids AS (
  SELECT
    COALESCE(
      (SELECT id FROM users WHERE id = 'a0000000-0000-4000-8000-0000000000a1'::uuid),
      (SELECT id FROM users WHERE phone = '+233240000000' LIMIT 1)
    ) AS customer_id,
    COALESCE(
      (SELECT id FROM users WHERE id = 'd0000000-0000-4000-8000-0000000000d1'::uuid),
      (SELECT id FROM users WHERE phone = '+233241111111' LIMIT 1)
    ) AS driver_id
)
INSERT INTO rides (
  id, customer_id, driver_id,
  pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
  pickup_address, dropoff_address,
  ride_type, status, estimated_fare, estimated_duration_minutes
)
SELECT
  'f0000000-0000-4000-8000-0000000000f1'::uuid,
  ids.customer_id,
  ids.driver_id,
  5.6037, -0.1870, 5.5600, -0.2050,
  '12 Oxford St',
  'Independence Ave, Accra',
  'standard',
  'accepted',
  25.00,
  3
FROM ids
WHERE ids.customer_id IS NOT NULL AND ids.driver_id IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET status = 'accepted',
    pickup_address = '12 Oxford St',
    estimated_duration_minutes = 3,
    driver_id = EXCLUDED.driver_id,
    customer_id = EXCLUDED.customer_id,
    updated_at = NOW();

WITH ids AS (
  SELECT
    COALESCE(
      (SELECT id FROM users WHERE id = 'a0000000-0000-4000-8000-0000000000a1'::uuid),
      (SELECT id FROM users WHERE phone = '+233240000000' LIMIT 1)
    ) AS customer_id,
    COALESCE(
      (SELECT id FROM users WHERE id = 'd0000000-0000-4000-8000-0000000000d1'::uuid),
      (SELECT id FROM users WHERE phone = '+233241111111' LIMIT 1)
    ) AS driver_id
)
INSERT INTO rides (
  id, customer_id, driver_id,
  pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
  pickup_address, dropoff_address, status, estimated_fare, completed_at, created_at
)
SELECT
  v.id::uuid,
  ids.customer_id,
  ids.driver_id,
  5.60, -0.18, 5.61, -0.19,
  'Earlier pickup',
  'Earlier dropoff',
  'completed',
  18.00,
  NOW() - (v.n || ' hours')::interval,
  NOW() - (v.n || ' hours')::interval
FROM ids
CROSS JOIN (VALUES
  ('f0000000-0000-4000-8000-0000000000f2', 2),
  ('f0000000-0000-4000-8000-0000000000f3', 4)
) AS v(id, n)
WHERE ids.customer_id IS NOT NULL
  AND ids.driver_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM rides WHERE id = v.id::uuid);
