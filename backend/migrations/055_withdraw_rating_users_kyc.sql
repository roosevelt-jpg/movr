-- Withdraw / rating / admin users / driver KYC mockup alignment

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS review TEXT,
  ADD COLUMN IF NOT EXISTS rating_tags TEXT[];

CREATE TABLE IF NOT EXISTS driver_payout_methods (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL DEFAULT 'MTN MoMo',
  account_mask VARCHAR(32) NOT NULL DEFAULT '****4471',
  account_number VARCHAR(64),
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(64) NOT NULL,
  label VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_review',
  rejection_reason TEXT,
  file_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (driver_user_id, document_type)
);

CREATE TABLE IF NOT EXISTS ride_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ride_id)
);

-- Demo driver Kwesi Boateng (active)
INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, is_verified, created_at
)
VALUES (
  'd1000000-0000-4000-8000-0000000000c1'::uuid,
  '+233209991111',
  'kwesi.boateng@movr.app',
  'Kwesi',
  'Boateng',
  crypt('password123', gen_salt('bf')),
  'driver',
  'GH',
  'Accra',
  TRUE,
  TRUE,
  '2026-01-15'::timestamptz
)
ON CONFLICT (id) DO UPDATE
SET first_name = 'Kwesi', last_name = 'Boateng', is_active = TRUE, updated_at = NOW();

INSERT INTO drivers (user_id, vehicle_type, is_online, rating, kyc_status)
SELECT 'd1000000-0000-4000-8000-0000000000c1'::uuid, 'standard', TRUE, 4.9, 'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE user_id = 'd1000000-0000-4000-8000-0000000000c1'::uuid
);

INSERT INTO driver_payout_methods (user_id, provider, account_mask, is_default)
VALUES ('d1000000-0000-4000-8000-0000000000c1'::uuid, 'MTN MoMo', '****4471', TRUE)
ON CONFLICT (user_id) DO UPDATE
SET provider = 'MTN MoMo', account_mask = '****4471', is_default = TRUE, updated_at = NOW();

-- Also attach payout method to existing demo driver
INSERT INTO driver_payout_methods (user_id, provider, account_mask, is_default)
SELECT id, 'MTN MoMo', '****4471', TRUE
FROM users WHERE phone = '+233241111111'
ON CONFLICT (user_id) DO NOTHING;

-- Seed wallet available balance GH₵1,640 for Kwesi
INSERT INTO wallets (user_id, balance_fiat, currency)
VALUES ('d1000000-0000-4000-8000-0000000000c1'::uuid, 1640.00, 'GHS')
ON CONFLICT (user_id) DO UPDATE
SET balance_fiat = 1640.00, currency = 'GHS', last_updated = NOW();

INSERT INTO wallets (user_id, balance_fiat, currency)
SELECT id, 1640.00, 'GHS' FROM users WHERE phone = '+233241111111'
ON CONFLICT (user_id) DO UPDATE
SET balance_fiat = GREATEST(wallets.balance_fiat, 1640.00), last_updated = NOW();

-- KYC docs for Kwesi (mockup statuses)
INSERT INTO driver_kyc_documents (driver_user_id, document_type, label, status, rejection_reason)
VALUES
  ('d1000000-0000-4000-8000-0000000000c1'::uuid, 'ghana_card', 'Ghana Card', 'verified', NULL),
  ('d1000000-0000-4000-8000-0000000000c1'::uuid, 'driving_license', 'Driving license', 'in_review', NULL),
  (
    'd1000000-0000-4000-8000-0000000000c1'::uuid,
    'vehicle_registration',
    'Vehicle registration',
    'rejected',
    'Vehicle registration photo was blurry. Please re-upload a clear photo.'
  )
ON CONFLICT (driver_user_id, document_type) DO UPDATE
SET status = EXCLUDED.status,
    rejection_reason = EXCLUDED.rejection_reason,
    label = EXCLUDED.label,
    updated_at = NOW();

-- Same docs for phone demo driver
INSERT INTO driver_kyc_documents (driver_user_id, document_type, label, status, rejection_reason)
SELECT u.id, d.document_type, d.label, d.status, d.rejection_reason
FROM users u
CROSS JOIN (VALUES
  ('ghana_card', 'Ghana Card', 'verified', NULL),
  ('driving_license', 'Driving license', 'in_review', NULL),
  ('vehicle_registration', 'Vehicle registration', 'rejected',
   'Vehicle registration photo was blurry. Please re-upload a clear photo.')
) AS d(document_type, label, status, rejection_reason)
WHERE u.phone = '+233241111111'
ON CONFLICT (driver_user_id, document_type) DO UPDATE
SET status = EXCLUDED.status,
    rejection_reason = EXCLUDED.rejection_reason,
    updated_at = NOW();

-- Suspended driver Kofi Mensah
INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, created_at
)
VALUES (
  'd2000000-0000-4000-8000-0000000000c2'::uuid,
  '+233208887777',
  'kofi.mensah@movr.app',
  'Kofi',
  'Mensah',
  crypt('password123', gen_salt('bf')),
  'driver',
  'GH',
  'Accra',
  FALSE,
  '2025-11-10'::timestamptz
)
ON CONFLICT (id) DO UPDATE
SET first_name = 'Kofi', last_name = 'Mensah', is_active = FALSE, updated_at = NOW();

INSERT INTO drivers (user_id, vehicle_type, is_online, rating, kyc_status)
SELECT 'd2000000-0000-4000-8000-0000000000c2'::uuid, 'standard', FALSE, 4.2, 'rejected'
WHERE NOT EXISTS (
  SELECT 1 FROM drivers WHERE user_id = 'd2000000-0000-4000-8000-0000000000c2'::uuid
);

-- Ensure Ama joined Mar 2026 for admin list
UPDATE users
SET created_at = '2026-03-12'::timestamptz,
    first_name = 'Ama',
    last_name = 'Konadu'
WHERE phone = '+233240000000'
   OR id = 'a0000000-0000-4000-8000-0000000000a1'::uuid;

-- Rateable completed ride with Kwesi as driver name seed
INSERT INTO rides (
  id, customer_id, driver_id,
  pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
  pickup_address, dropoff_address, status, estimated_fare, actual_fare, completed_at, created_at
)
SELECT
  'f3000000-0000-4000-8000-0000000000a9'::uuid,
  (SELECT id FROM users WHERE phone = '+233240000000' LIMIT 1),
  'd1000000-0000-4000-8000-0000000000c1'::uuid,
  5.55, -0.18, 5.60, -0.17,
  'Osu', 'Airport',
  'completed', 45, 45,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM users WHERE phone = '+233240000000')
ON CONFLICT (id) DO UPDATE
SET driver_id = EXCLUDED.driver_id, status = 'completed';
