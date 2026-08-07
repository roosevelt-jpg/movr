-- USSD/SMS session helpers, support tickets, dashboard stats, KYC queue seed

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject VARCHAR(256) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  priority VARCHAR(32) NOT NULL DEFAULT 'normal',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  phone VARCHAR(32),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  state VARCHAR(64) NOT NULL DEFAULT 'menu',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_dashboard_stats (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_rides INT NOT NULL DEFAULT 0,
  active_rides_delta INT NOT NULL DEFAULT 0,
  gmv_today NUMERIC(14,2) NOT NULL DEFAULT 0,
  gmv_delta INT NOT NULL DEFAULT 0,
  new_drivers INT NOT NULL DEFAULT 0,
  pending_kyc INT NOT NULL DEFAULT 0,
  tickets_open INT NOT NULL DEFAULT 0,
  tickets_urgent INT NOT NULL DEFAULT 0,
  rides_today INT NOT NULL DEFAULT 0,
  orders_today INT NOT NULL DEFAULT 0,
  deliveries_today INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_dashboard_stats (
  id, active_rides, active_rides_delta, gmv_today, gmv_delta,
  new_drivers, pending_kyc, tickets_open, tickets_urgent,
  rides_today, orders_today, deliveries_today
) VALUES (
  1, 206, 12, 84200, 8,
  18, 3, 7, 2,
  142, 68, 34
)
ON CONFLICT (id) DO UPDATE
SET active_rides = EXCLUDED.active_rides,
    active_rides_delta = EXCLUDED.active_rides_delta,
    gmv_today = EXCLUDED.gmv_today,
    gmv_delta = EXCLUDED.gmv_delta,
    new_drivers = EXCLUDED.new_drivers,
    pending_kyc = EXCLUDED.pending_kyc,
    tickets_open = EXCLUDED.tickets_open,
    tickets_urgent = EXCLUDED.tickets_urgent,
    rides_today = EXCLUDED.rides_today,
    orders_today = EXCLUDED.orders_today,
    deliveries_today = EXCLUDED.deliveries_today,
    updated_at = NOW();

-- Support tickets (7 open, 2 urgent)
INSERT INTO support_tickets (id, subject, status, priority, created_at)
SELECT v.id::uuid, v.subject, 'open', v.priority, NOW() - (v.hrs || ' hours')::interval
FROM (VALUES
  ('a7000000-0000-4000-8000-000000000001', 'Fare dispute Ride #88213', 'urgent', 2),
  ('a7000000-0000-4000-8000-000000000002', 'Driver no-show complaint', 'urgent', 3),
  ('a7000000-0000-4000-8000-000000000003', 'Wallet top-up delayed', 'normal', 5),
  ('a7000000-0000-4000-8000-000000000004', 'Order missing items', 'normal', 8),
  ('a7000000-0000-4000-8000-000000000005', 'App crash on checkout', 'normal', 12),
  ('a7000000-0000-4000-8000-000000000006', 'Promo code not applying', 'normal', 18),
  ('a7000000-0000-4000-8000-000000000007', 'Change payout number', 'normal', 24)
) AS v(id, subject, priority, hrs)
WHERE NOT EXISTS (SELECT 1 FROM support_tickets WHERE id = v.id::uuid);

-- Ensure Kwesi pending KYC with docs for queue
UPDATE drivers SET kyc_status = 'pending'
WHERE user_id = 'd1000000-0000-4000-8000-0000000000c1'::uuid
   OR user_id IN (SELECT id FROM users WHERE first_name = 'Kwesi' AND user_type = 'driver' LIMIT 1);

INSERT INTO driver_kyc_documents (driver_user_id, document_type, label, status)
SELECT u.id, v.doc_type, v.label, 'uploaded'
FROM users u
JOIN (VALUES
  ('ghana_card', 'Ghana Card'),
  ('drivers_license', 'Driver licence')
) AS v(doc_type, label) ON TRUE
WHERE u.id = 'd1000000-0000-4000-8000-0000000000c1'::uuid
   OR (u.first_name = 'Kwesi' AND u.user_type = 'driver')
ON CONFLICT DO NOTHING;

-- Extra pending drivers for queue depth (mockup-style names)
INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city, is_active, is_verified
)
VALUES
  (
    'd3000000-0000-4000-8000-0000000000c3'::uuid,
    '+233209990003',
    'ama.driver@movr.app',
    'Ama',
    'Mensah',
    crypt('password123', gen_salt('bf')),
    'driver',
    'GH',
    'Accra',
    TRUE,
    FALSE
  ),
  (
    'd4000000-0000-4000-8000-0000000000c4'::uuid,
    '+233209990004',
    'kofi.driver@movr.app',
    'Kofi',
    'Asante',
    crypt('password123', gen_salt('bf')),
    'driver',
    'GH',
    'Kumasi',
    TRUE,
    FALSE
  )
ON CONFLICT (phone) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    user_type = 'driver';

INSERT INTO drivers (user_id, vehicle_type, is_online, rating, kyc_status)
SELECT u.id, 'sedan', FALSE, 4.8, 'pending'
FROM users u
WHERE u.phone IN ('+233209990003', '+233209990004')
  AND NOT EXISTS (SELECT 1 FROM drivers d WHERE d.user_id = u.id);

UPDATE drivers d
SET kyc_status = 'pending'
FROM users u
WHERE d.user_id = u.id AND u.phone IN ('+233209990003', '+233209990004');

INSERT INTO driver_kyc_documents (driver_user_id, document_type, label, status)
SELECT u.id, v.doc_type, v.label, 'uploaded'
FROM users u
CROSS JOIN (VALUES
  ('ghana_card', 'Ghana Card'),
  ('drivers_license', 'Driver licence'),
  ('vehicle_reg', 'Vehicle registration')
) AS v(doc_type, label)
WHERE u.phone = '+233209990003'
ON CONFLICT DO NOTHING;

INSERT INTO driver_kyc_documents (driver_user_id, document_type, label, status)
SELECT u.id, 'ghana_card', 'Ghana Card', 'uploaded'
FROM users u WHERE u.phone = '+233209990004'
ON CONFLICT DO NOTHING;

-- Ensure Kwesi plate for SMS confirmation mockup
INSERT INTO driver_vehicles (driver_user_id, plate_number, is_primary)
SELECT 'd1000000-0000-4000-8000-0000000000c1'::uuid, 'GR 4471-22', TRUE
WHERE EXISTS (SELECT 1 FROM users WHERE id = 'd1000000-0000-4000-8000-0000000000c1'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM driver_vehicles WHERE driver_user_id = 'd1000000-0000-4000-8000-0000000000c1'::uuid
  );

UPDATE driver_vehicles
SET plate_number = 'GR 4471-22'
WHERE driver_user_id = 'd1000000-0000-4000-8000-0000000000c1'::uuid;

-- Fresh Mart merchant pending KYC
INSERT INTO merchants (user_id, business_name, kyc_status, created_at)
SELECT
  (SELECT id FROM users WHERE phone = '+233240000000' LIMIT 1),
  'Fresh Mart',
  'pending',
  NOW() - INTERVAL '1 day'
WHERE EXISTS (SELECT 1 FROM users WHERE phone = '+233240000000')
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE business_name ILIKE 'Fresh Mart%');

UPDATE merchants
SET kyc_status = 'pending'
WHERE business_name ILIKE 'Fresh Mart%';

INSERT INTO merchant_kyc_documents (merchant_id, document_type, file_url, status)
SELECT m.id, v.doc_type, 'https://cdn.movr.app/kyc/demo/' || v.doc_type || '.pdf', 'uploaded'
FROM merchants m
CROSS JOIN (VALUES ('business_reg'), ('tax_id'), ('owner_id')) AS v(doc_type)
WHERE m.business_name ILIKE 'Fresh Mart%'
  AND NOT EXISTS (
    SELECT 1 FROM merchant_kyc_documents d
    WHERE d.merchant_id = m.id AND d.document_type = v.doc_type
  );

-- Mark disputed ride for overview attention
UPDATE rides SET dispute_status = 'disputed'
WHERE public_ref = '88213' OR id = 'f4000000-0000-4000-8000-000000008821'::uuid;
