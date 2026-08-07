-- Download links, disputed ride #88213, rewards points, audit seed

CREATE TABLE IF NOT EXISTS app_store_links (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ios_url TEXT NOT NULL DEFAULT 'https://apps.apple.com/app/movr',
  android_url TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=io.movr.app',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_store_links (id, ios_url, android_url)
VALUES (
  1,
  'https://apps.apple.com/app/movr',
  'https://play.google.com/store/apps/details?id=io.movr.app'
)
ON CONFLICT (id) DO UPDATE
SET ios_url = EXCLUDED.ios_url,
    android_url = EXCLUDED.android_url,
    updated_at = NOW();

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS public_ref VARCHAR(32),
  ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rides_public_ref
  ON rides (public_ref) WHERE public_ref IS NOT NULL;

-- Align rewards to mockup
UPDATE rewards_rules SET points_amount = 10, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'ride_completed';
UPDATE rewards_rules SET points_amount = 8, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'order_completed';
UPDATE rewards_rules SET points_amount = 250, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'referral_qualified';
UPDATE rewards_rules SET points_amount = 5, dvt_amount = 0, active = FALSE, updated_at = NOW()
WHERE event_type = 'stake_created';

INSERT INTO rewards_rules (event_type, points_amount, dvt_amount, active) VALUES
  ('ride_completed', 10, 0, TRUE),
  ('order_completed', 8, 0, TRUE),
  ('referral_qualified', 250, 0, TRUE),
  ('stake_created', 5, 0, FALSE)
ON CONFLICT (event_type) DO UPDATE
SET points_amount = EXCLUDED.points_amount,
    dvt_amount = 0,
    active = EXCLUDED.active,
    updated_at = NOW();

-- Admin users for audit (Yaw A., Ama S.) — upsert by phone to avoid conflicts
INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, is_verified
)
VALUES
  (
    'ad000000-0000-4000-8000-0000000000a1'::uuid,
    '+233200000001',
    'yaw.a@movr.app',
    'Yaw',
    'A.',
    crypt('password123', gen_salt('bf')),
    'admin',
    'GH',
    'Accra',
    TRUE,
    TRUE
  )
ON CONFLICT (phone) DO UPDATE
SET first_name = 'Yaw',
    last_name = 'A.',
    email = COALESCE(users.email, EXCLUDED.email),
    user_type = 'admin',
    is_active = TRUE;

INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, is_verified
)
VALUES
  (
    'ad000000-0000-4000-8000-0000000000a2'::uuid,
    '+233200000002',
    'ama.s@movr.app',
    'Ama',
    'S.',
    crypt('password123', gen_salt('bf')),
    'admin',
    'GH',
    'Accra',
    TRUE,
    TRUE
  )
ON CONFLICT (phone) DO UPDATE
SET first_name = 'Ama',
    last_name = 'S.',
    email = COALESCE(users.email, EXCLUDED.email),
    user_type = 'admin',
    is_active = TRUE;

INSERT INTO admin_roles (user_id, role)
SELECT u.id, 'super_admin'
FROM users u
WHERE u.phone = '+233200000001'
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_roles')
  AND NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = u.id);

INSERT INTO admin_roles (user_id, role)
SELECT u.id, 'ops'
FROM users u
WHERE u.phone = '+233200000002'
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_roles')
  AND NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = u.id);

-- Disputed ride #88213: Kwesi → Ama, Osu → Airport, GH₵45
INSERT INTO rides (
  id, customer_id, driver_id,
  pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
  pickup_address, dropoff_address,
  status, estimated_fare, actual_fare, public_ref, dispute_status,
  completed_at, created_at
)
SELECT
  'f4000000-0000-4000-8000-000000008821'::uuid,
  (SELECT id FROM users WHERE phone = '+233240000000' LIMIT 1),
  COALESCE(
    (SELECT id FROM users WHERE id = 'd1000000-0000-4000-8000-0000000000c1'::uuid),
    (SELECT id FROM users WHERE first_name = 'Kwesi' AND user_type = 'driver' LIMIT 1)
  ),
  5.5557, -0.1820, 5.6052, -0.1668,
  'Osu', 'Airport',
  'completed', 50, 45, '88213', 'disputed',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '4 hours'
WHERE EXISTS (SELECT 1 FROM users WHERE phone = '+233240000000')
ON CONFLICT (id) DO UPDATE
SET public_ref = '88213',
    dispute_status = 'disputed',
    pickup_address = 'Osu',
    dropoff_address = 'Airport',
    actual_fare = 45,
    estimated_fare = 50,
    status = 'completed',
    driver_id = EXCLUDED.driver_id,
    customer_id = EXCLUDED.customer_id;

-- Ops note on disputed ride
INSERT INTO ops_notes (entity_type, entity_id, author_admin_id, note, created_at)
SELECT
  'ride',
  'f4000000-0000-4000-8000-000000008821',
  (SELECT id FROM users WHERE phone = '+233200000001' LIMIT 1),
  'Rider disputes fare, claims traffic detour was driver error. Reviewing route logs.',
  NOW() - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM users WHERE phone = '+233200000001')
  AND NOT EXISTS (
  SELECT 1 FROM ops_notes
  WHERE entity_id = 'f4000000-0000-4000-8000-000000008821'
    AND note LIKE 'Rider disputes fare%'
);

-- Audit log seed matching mockup
INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata, created_at)
SELECT
  yaw.id,
  'adjust_fare',
  'ride',
  'f4000000-0000-4000-8000-000000008821',
  'Adjusted fare -GH₵5',
  '{"delta":-5,"public_ref":"88213"}'::jsonb,
  NOW() - INTERVAL '2 hours'
FROM users yaw WHERE yaw.phone = '+233200000001'
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reason = 'Adjusted fare -GH₵5');

INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata, created_at)
SELECT
  yaw.id,
  'approve_kyc',
  'driver',
  'd1000000-0000-4000-8000-0000000000c1',
  'Approved KYC',
  '{"driver":"Kwesi B."}'::jsonb,
  NOW() - INTERVAL '5 hours'
FROM users yaw WHERE yaw.phone = '+233200000001'
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reason = 'Approved KYC' AND metadata->>'driver' = 'Kwesi B.');

INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata, created_at)
SELECT
  ama.id,
  'change_payment_provider',
  'integration',
  'senegal-flutterwave',
  'Changed payment provider',
  '{"from":"Senegal","to":"Flutterwave"}'::jsonb,
  NOW() - INTERVAL '1 day'
FROM users ama WHERE ama.phone = '+233200000002'
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reason = 'Changed payment provider');

INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata, created_at)
SELECT
  ama.id,
  'suspend_account',
  'driver',
  'd2000000-0000-4000-8000-0000000000c2',
  'Suspended account',
  '{"driver":"Kofi M."}'::jsonb,
  NOW() - INTERVAL '2 days'
FROM users ama WHERE ama.phone = '+233200000002'
  AND NOT EXISTS (SELECT 1 FROM audit_log WHERE reason = 'Suspended account' AND metadata->>'driver' = 'Kofi M.');
