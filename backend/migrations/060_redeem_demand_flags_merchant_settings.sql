-- Redeem catalog + redemptions, driver demand heatmap, feature-flag mockup rollouts,
-- Boutique 22 account settings + notification prefs

-- ── Redeem points catalog ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards_redeem_catalog (
  id VARCHAR(64) PRIMARY KEY,
  label TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  reward_type VARCHAR(64) NOT NULL DEFAULT 'voucher',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  catalog_id VARCHAR(64) REFERENCES rewards_redeem_catalog(id),
  points_spent INTEGER NOT NULL,
  label TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'issued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user
  ON reward_redemptions (user_id, created_at DESC);

INSERT INTO rewards_redeem_catalog (id, label, points_cost, reward_type, sort_order, is_active)
VALUES
  ('ride_5', 'GH₵5 off your next ride', 500, 'ride_discount', 1, TRUE),
  ('order_10', 'GH₵10 off your next order', 900, 'order_discount', 2, TRUE),
  ('delivery_free', 'Free delivery voucher', 300, 'free_delivery', 3, TRUE)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    points_cost = EXCLUDED.points_cost,
    reward_type = EXCLUDED.reward_type,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

-- Demo customer Ama: 1,280 points (mockup balance)
UPDATE wallets
SET points_balance = 1280,
    balance_points = 1280,
    last_updated = NOW()
WHERE user_id = (SELECT id FROM users WHERE phone = '+233240000000' LIMIT 1);

INSERT INTO points_ledger (user_id, activity_type, points_earned, description)
SELECT u.id, 'mockup_seed_balance', 1280, 'Starting points for redeem mockup'
FROM users u
WHERE u.phone = '+233240000000'
  AND NOT EXISTS (
    SELECT 1 FROM points_ledger pl
    WHERE pl.user_id = u.id AND pl.activity_type = 'mockup_seed_balance'
  );

-- ── Driver demand near you ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_demand_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name VARCHAR(128) NOT NULL UNIQUE,
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  demand_level VARCHAR(64) NOT NULL DEFAULT 'Normal',
  hotspots JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO driver_demand_zones (zone_name, surge_multiplier, demand_level, hotspots, is_active)
VALUES (
  'Osu & East Legon',
  1.4,
  'High demand',
  '[
    {"lat": 5.5557, "lng": -0.174, "intensity": 0.9},
    {"lat": 5.64, "lng": -0.16, "intensity": 0.75},
    {"lat": 5.58, "lng": -0.19, "intensity": 0.4}
  ]'::jsonb,
  TRUE
)
ON CONFLICT (zone_name) DO UPDATE
SET surge_multiplier = 1.4,
    demand_level = 'High demand',
    hotspots = EXCLUDED.hotspots,
    is_active = TRUE,
    updated_at = NOW();

-- Keep pricing zone snapshot in sync when zone exists
INSERT INTO zone_demand_snapshots (zone_id, active_rides, available_drivers, recorded_at)
SELECT z.id, 18, 4, NOW()
FROM pricing_zones z
WHERE z.name = 'Osu & East Legon'
  AND NOT EXISTS (
    SELECT 1 FROM zone_demand_snapshots s
    WHERE s.zone_id = z.id AND s.recorded_at > NOW() - INTERVAL '1 hour'
  );

-- ── Feature flags (mockup rollouts) ────────────────────────────────────────
INSERT INTO feature_flags (key, enabled, rollout_pct, metadata, updated_at)
VALUES
  (
    'self_drive_rentals', TRUE, 25,
    '{"label":"Self-drive rentals","phase":"Phase 15 rollout","rolloutLabel":"25% · Accra only"}'::jsonb,
    NOW()
  ),
  (
    'voice_booking', TRUE, 100,
    '{"label":"Voice booking","phase":"Phase 23","rolloutLabel":"100% · all regions"}'::jsonb,
    NOW()
  ),
  (
    'ussd_booking', TRUE, 10,
    '{"label":"USSD booking","phase":"Phase 22","rolloutLabel":"10% · Ghana"}'::jsonb,
    NOW()
  ),
  (
    'cross_border_transfers', FALSE, 0,
    '{"label":"Cross-border transfers","phase":"Phase 27","rolloutLabel":"0% · compliance review pending"}'::jsonb,
    NOW()
  )
ON CONFLICT (key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    rollout_pct = EXCLUDED.rollout_pct,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ── Merchant account settings (Boutique 22) ────────────────────────────────
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS business_email VARCHAR(255);

CREATE TABLE IF NOT EXISTS merchant_notification_settings (
  merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  new_order_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  daily_sales_summary BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE users u
SET email = 'owner@boutique22.com',
    updated_at = NOW()
FROM merchants m
WHERE m.user_id = u.id
  AND (m.business_name = 'Boutique 22' OR m.id = 'b0000000-0000-4000-8000-000000000022'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM users x
    WHERE x.email = 'owner@boutique22.com' AND x.id <> u.id
  );

UPDATE merchants
SET business_email = 'owner@boutique22.com',
    business_registration_number = 'BN-2024-88213',
    payout_account = jsonb_build_object(
      'bankName', 'GCB Bank',
      'bankCode', 'GCB',
      'accountNumber', '****3390',
      'accountName', 'Boutique 22'
    ),
    updated_at = NOW()
WHERE business_name = 'Boutique 22'
   OR id = 'b0000000-0000-4000-8000-000000000022'::uuid;

INSERT INTO merchant_notification_settings (merchant_id, new_order_alerts, daily_sales_summary)
SELECT m.id, TRUE, TRUE
FROM merchants m
WHERE m.business_name = 'Boutique 22'
   OR m.id = 'b0000000-0000-4000-8000-000000000022'::uuid
ON CONFLICT (merchant_id) DO UPDATE
SET new_order_alerts = TRUE,
    daily_sales_summary = TRUE,
    updated_at = NOW();
