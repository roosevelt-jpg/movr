-- 084: Driver profile & ratings, DVT redeem catalog, ride receipt fields, driver plans/trial

-- ── Driver profile extras ───────────────────────────────────────────────────
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS loyalty_badge VARCHAR(32) DEFAULT 'BRONZE',
  ADD COLUMN IF NOT EXISTS location_label VARCHAR(128),
  ADD COLUMN IF NOT EXISTS total_trips INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_rate_display NUMERIC(5,2);

COMMENT ON COLUMN drivers.loyalty_badge IS 'GOLD | SILVER | BRONZE | PLATINUM driver badge';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS joined_year INT;

-- ── Ride receipt enrichment ─────────────────────────────────────────────────
ALTER TABLE ride_receipts
  ADD COLUMN IF NOT EXISTS txn_ref VARCHAR(64),
  ADD COLUMN IF NOT EXISTS service_label VARCHAR(64) DEFAULT 'Standard Ride',
  ADD COLUMN IF NOT EXISTS driver_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS pickup_label VARCHAR(200),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64) DEFAULT 'Movr Wallet',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ride_receipts_txn_ref
  ON ride_receipts (txn_ref) WHERE txn_ref IS NOT NULL;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS service_label VARCHAR(64);

-- ── DVT redeem catalog (Ride Credits / Order Discount / Cash Withdrawal) ────
CREATE TABLE IF NOT EXISTS dvt_redeem_options (
  id VARCHAR(64) PRIMARY KEY,
  label VARCHAR(128) NOT NULL,
  icon VARCHAR(32) DEFAULT 'token',
  dvt_cost NUMERIC(18,2) NOT NULL,
  reward_value NUMERIC(18,2) NOT NULL,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'NGN',
  reward_type VARCHAR(64) NOT NULL,
  reward_unit VARCHAR(64) NOT NULL DEFAULT 'credit',
  tags TEXT[] DEFAULT '{}',
  tag_tone VARCHAR(32) DEFAULT 'violet',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dvt_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id VARCHAR(64) REFERENCES dvt_redeem_options(id),
  dvt_spent NUMERIC(18,2) NOT NULL,
  reward_value NUMERIC(18,2) NOT NULL,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'NGN',
  reward_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'issued',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dvt_redemptions_user
  ON dvt_redemptions (user_id, created_at DESC);

INSERT INTO dvt_redeem_options (
  id, label, icon, dvt_cost, reward_value, currency_code, reward_type, reward_unit, tags, tag_tone, sort_order
) VALUES
  ('ride_credits', 'Ride Credits', 'car', 500, 1000, 'NGN', 'ride_credit', 'ride credit',
   ARRAY['Best value','Most popular'], 'violet', 1),
  ('order_discount', 'Order Discount', 'bag', 300, 500, 'NGN', 'order_discount', 'off any order',
   ARRAY[]::text[], 'muted', 2),
  ('cash_withdrawal', 'Cash Withdrawal', 'cash', 1000, 1800, 'NGN', 'wallet_cash', 'to wallet',
   ARRAY['Lower rate','Instant'], 'amber', 3)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  dvt_cost = EXCLUDED.dvt_cost,
  reward_value = EXCLUDED.reward_value,
  currency_code = EXCLUDED.currency_code,
  reward_type = EXCLUDED.reward_type,
  reward_unit = EXCLUDED.reward_unit,
  tags = EXCLUDED.tags,
  tag_tone = EXCLUDED.tag_tone,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

UPDATE token_redeem_config
SET currency_code = 'NGN',
    dvt_per_fiat_unit = 0.5,
    updated_at = NOW()
WHERE id = 1;

-- ── Driver subscription plans (Weekly ₦2,500 / Monthly ₦7,000) ───────────────
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS interval VARCHAR(16) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS headline VARCHAR(128),
  ADD COLUMN IF NOT EXISTS subtitle VARCHAR(256),
  ADD COLUMN IF NOT EXISTS badge_label VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

INSERT INTO plans (id, name, features, amount, currency, interval, headline, subtitle, badge_label, is_featured, sort_order)
VALUES
  (
    'weekly_driver',
    'Weekly',
    '["0% commission on all rides","Unlimited trips","DVT token rewards included"]'::jsonb,
    2500, 'NGN', 'weekly', 'Weekly', 'Flexible · Cancel anytime', NULL, FALSE, 1
  ),
  (
    'monthly_driver',
    'Monthly',
    '["0% commission on all rides","Priority ride matching","2x DVT token rewards","Gold driver badge"]'::jsonb,
    7000, 'NGN', 'monthly', 'Monthly', 'Most popular · Auto-renews', 'BEST VALUE · SAVE 30%', TRUE, 2
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  features = EXCLUDED.features,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  interval = EXCLUDED.interval,
  headline = EXCLUDED.headline,
  subtitle = EXCLUDED.subtitle,
  badge_label = EXCLUDED.badge_label,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order;

-- Soft-retire old GHS pro plan from featured UI
UPDATE plans SET sort_order = 99, is_featured = FALSE WHERE id = 'pro_driver';
UPDATE plans SET sort_order = 98 WHERE id = 'basic_driver';

-- ── Seed Emeka Okafor (driver profile mockup) ───────────────────────────────
INSERT INTO users (
  id, phone, email, first_name, last_name, password, user_type, country, city,
  is_active, is_verified, created_at, joined_year, loyalty_tier
)
VALUES (
  'd2000000-0000-4000-8000-0000000000e1'::uuid,
  '+2348010004848',
  'emeka.okafor@movr.app',
  'Emeka',
  'Okafor',
  crypt('password123', gen_salt('bf')),
  'driver',
  'NG',
  'Lagos',
  TRUE,
  TRUE,
  '2023-03-15'::timestamptz,
  2023,
  'gold'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = 'Emeka',
  last_name = 'Okafor',
  city = 'Lagos',
  country = 'NG',
  joined_year = 2023,
  loyalty_tier = 'gold',
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO drivers (
  user_id, vehicle_type, is_online, rating, kyc_status,
  loyalty_badge, location_label, total_trips, acceptance_rate_display
)
VALUES (
  'd2000000-0000-4000-8000-0000000000e1'::uuid,
  'standard', TRUE, 4.9, 'approved',
  'GOLD', 'Lagos, Nigeria', 312, 98
)
ON CONFLICT (user_id) DO UPDATE SET
  rating = 4.9,
  loyalty_badge = 'GOLD',
  location_label = 'Lagos, Nigeria',
  total_trips = 312,
  acceptance_rate_display = 98,
  is_online = TRUE;

-- Metrics for profile Accept %
INSERT INTO driver_metrics (
  driver_id, acceptance_rate, cancellation_rate, on_time_rate,
  rides_completed, rides_accepted, rides_cancelled, rides_offered,
  current_tier, period_start, period_end, updated_at
)
VALUES (
  'd2000000-0000-4000-8000-0000000000e1'::uuid,
  98, 1.2, 96,
  312, 320, 4, 324,
  'premium', date_trunc('month', NOW()), date_trunc('month', NOW()) + INTERVAL '1 month', NOW()
)
ON CONFLICT (driver_id, period_start) DO UPDATE SET
  acceptance_rate = 98,
  rides_completed = 312,
  current_tier = 'premium',
  updated_at = NOW();

-- DVT balance 18.2K for Emeka
INSERT INTO token_balances (user_id, pending_amount, onchain_amount, updated_at)
VALUES ('d2000000-0000-4000-8000-0000000000e1'::uuid, 18200, 0, NOW())
ON CONFLICT (user_id) DO UPDATE SET
  pending_amount = GREATEST(token_balances.pending_amount, 18200),
  updated_at = NOW();

-- Free trial subscription (3 days remaining)
INSERT INTO subscriptions (
  user_id, plan_id, status, amount, currency,
  next_billing_date, auto_renew, trial_started_at, trial_ends_at, updated_at
)
VALUES (
  'd2000000-0000-4000-8000-0000000000e1'::uuid,
  'monthly_driver',
  'trial',
  0, 'NGN',
  NOW() + INTERVAL '3 days',
  TRUE,
  NOW() - INTERVAL '4 days',
  NOW() + INTERVAL '3 days',
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  plan_id = 'monthly_driver',
  status = 'trial',
  trial_ends_at = NOW() + INTERVAL '3 days',
  trial_started_at = COALESCE(subscriptions.trial_started_at, NOW() - INTERVAL '4 days'),
  currency = 'NGN',
  updated_at = NOW();

-- Seed reviews for rating breakdown (82/14/3/1 → 5★–2★)
DO $$
DECLARE
  did UUID := 'd2000000-0000-4000-8000-0000000000e1'::uuid;
  cid UUID;
  i INT;
  stars INT;
  names TEXT[] := ARRAY['Kofi Asante','Chioma F.','Adaobi N.','Tunde B.','Amara O.'];
  comments TEXT[] := ARRAY[
    'Very professional and friendly. Smooth ride the whole way.',
    'Car was very clean and the AC worked perfectly.',
    'Great navigation, arrived right on time.',
    'Polite driver, would ride again.',
    'Excellent service throughout.'
  ];
BEGIN
  SELECT id INTO cid FROM users
  WHERE COALESCE(user_type, 'customer') IN ('customer', 'rider', 'user')
  ORDER BY created_at ASC LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO users (id, phone, email, first_name, last_name, user_type, is_verified)
    VALUES (
      'c2000000-0000-4000-8000-0000000000e2'::uuid,
      '+2348010004849', 'rider.demo@movr.app', 'Kofi', 'Asante', 'customer', TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    cid := 'c2000000-0000-4000-8000-0000000000e2'::uuid;
  END IF;

  -- Ensure ~100 synthetic ratings for percentages if few exist
  IF (SELECT COUNT(*) FROM ride_ratings WHERE driver_id = did) < 20 THEN
    FOR i IN 1..100 LOOP
      stars := CASE
        WHEN i <= 82 THEN 5
        WHEN i <= 96 THEN 4
        WHEN i <= 99 THEN 3
        ELSE 2
      END;
      INSERT INTO rides (
        id, customer_id, driver_id, pickup_address, dropoff_address,
        status, estimated_fare, actual_fare, completed_at, created_at
      )
      VALUES (
        ('e3000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
        cid, did,
        'Victoria Island', 'Lekki Phase 1',
        'completed', 1200, 1200,
        NOW() - ((i || ' hours')::interval),
        NOW() - ((i || ' hours')::interval)
      )
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO ride_ratings (ride_id, customer_id, driver_id, rating, comment, created_at)
      VALUES (
        ('e3000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
        cid, did, stars,
        CASE WHEN i <= 5 THEN comments[i] ELSE NULL END,
        NOW() - ((i || ' hours')::interval)
      )
      ON CONFLICT (ride_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Demo receipt MVR-TXN-48219
DO $$
DECLARE
  rid UUID := 'f3000000-0000-4000-8000-000000004821'::uuid;
  did UUID := 'd2000000-0000-4000-8000-0000000000e1'::uuid;
  cid UUID;
BEGIN
  SELECT id INTO cid FROM users
  WHERE COALESCE(user_type, 'customer') IN ('customer', 'rider', 'user')
  ORDER BY created_at ASC LIMIT 1;

  IF cid IS NULL THEN
    cid := 'c2000000-0000-4000-8000-0000000000e2'::uuid;
  END IF;

  INSERT INTO rides (
    id, customer_id, driver_id, pickup_address, dropoff_address,
    status, ride_type, service_label, estimated_fare, actual_fare,
    base_fare, distance_fare, dvt_discount, distance_km, duration_minutes,
    payment_method, dvt_earned, public_ref, completed_at, created_at
  )
  VALUES (
    rid, cid, did,
    'Victoria Island', 'Lekki Phase 1',
    'completed', 'standard', 'Standard Ride',
    1200, 1200, 900, 360, 60, 8.4, 18,
    'Movr Wallet', 120, 'MVR-TXN-48219',
    '2026-04-08 09:12:00+00'::timestamptz,
    '2026-04-08 08:54:00+00'::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    public_ref = 'MVR-TXN-48219',
    base_fare = 900,
    distance_fare = 360,
    dvt_discount = 60,
    actual_fare = 1200,
    distance_km = 8.4,
    duration_minutes = 18,
    dvt_earned = 120,
    payment_method = 'Movr Wallet',
    service_label = 'Standard Ride',
    driver_id = did,
    pickup_address = 'Victoria Island',
    dropoff_address = 'Lekki Phase 1';

  INSERT INTO ride_receipts (
    ride_id, destination_label, duration_minutes, distance_km,
    base_fare, distance_fare, dvt_discount, total_paid, dvt_earned, currency_code,
    txn_ref, service_label, driver_name, pickup_label, payment_method, paid_at
  )
  VALUES (
    rid, 'Lekki Phase 1', 18, 8.4,
    900, 360, 60, 1200, 120, 'NGN',
    'MVR-TXN-48219', 'Standard Ride', 'Emeka Okafor', 'Victoria Island',
    'Movr Wallet', '2026-04-08 09:12:00+00'::timestamptz
  )
  ON CONFLICT (ride_id) DO UPDATE SET
    txn_ref = 'MVR-TXN-48219',
    service_label = 'Standard Ride',
    driver_name = 'Emeka Okafor',
    pickup_label = 'Victoria Island',
    destination_label = 'Lekki Phase 1',
    base_fare = 900,
    distance_fare = 360,
    dvt_discount = 60,
    total_paid = 1200,
    dvt_earned = 120,
    payment_method = 'Movr Wallet',
    paid_at = '2026-04-08 09:12:00+00'::timestamptz;
END $$;

-- Customer DVT balance 2,400 for redeem mockup
DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM users
  WHERE phone = '+233240000000' OR email ILIKE '%ama%' OR phone LIKE '+234%'
  ORDER BY CASE WHEN phone = '+233240000000' THEN 0 ELSE 1 END
  LIMIT 1;

  IF uid IS NULL THEN
    SELECT id INTO uid FROM users
    WHERE COALESCE(user_type, 'customer') IN ('customer', 'rider', 'user')
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF uid IS NOT NULL THEN
    INSERT INTO token_balances (user_id, pending_amount, onchain_amount, updated_at)
    VALUES (uid, 2400, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      pending_amount = GREATEST(token_balances.pending_amount, 2400),
      updated_at = NOW();
  END IF;
END $$;
