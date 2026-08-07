-- Ensure Ama Konadu has 2 completed rides today for driver pickup meta
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
  pickup_address, dropoff_address, status, estimated_fare, completed_at, created_at
)
SELECT
  v.id::uuid,
  cust.id,
  drv.id,
  5.60, -0.18, 5.61, -0.19,
  'Earlier pickup',
  'Earlier dropoff',
  'completed',
  18.00,
  NOW() - (v.n || ' hours')::interval,
  NOW() - (v.n || ' hours')::interval
FROM cust, drv,
(VALUES
  ('f0000000-0000-4000-8000-0000000000f2', 2),
  ('f0000000-0000-4000-8000-0000000000f3', 4)
) AS v(id, n)
ON CONFLICT (id) DO UPDATE
SET status = 'completed',
    completed_at = EXCLUDED.completed_at,
    customer_id = EXCLUDED.customer_id,
    driver_id = EXCLUDED.driver_id;

-- Keep active pickup ride accepted for demo
UPDATE rides
SET status = 'accepted',
    pickup_address = '12 Oxford St',
    estimated_duration_minutes = 3,
    updated_at = NOW()
WHERE id = 'f0000000-0000-4000-8000-0000000000f1'::uuid;
