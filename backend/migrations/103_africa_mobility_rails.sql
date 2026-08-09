-- 103: Africa mobility rails — credit, guarantees, family share, corridors, agent float, trust score
-- Extends existing wallet/trust/pricing/channels without replacing them.

-- Portable reputation (rider + driver)
CREATE TABLE IF NOT EXISTS mobility_trust_scores (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'customer',
  score NUMERIC(6,2) NOT NULL DEFAULT 70,
  rides_completed INT NOT NULL DEFAULT 0,
  disputes_lost INT NOT NULL DEFAULT 0,
  no_shows INT NOT NULL DEFAULT 0,
  kyc_boost NUMERIC(6,2) NOT NULL DEFAULT 0,
  agent_attested BOOLEAN NOT NULL DEFAULT FALSE,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobility_trust_score ON mobility_trust_scores (score DESC);

-- Wallet-first mobility credit ledger (ring-fenced ride credit)
CREATE TABLE IF NOT EXISTS mobility_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  source VARCHAR(32) NOT NULL, -- momo | cash_agent | remittance | dvt | promo | salary | airtime
  reference VARCHAR(128),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobility_credit_user ON mobility_credit_ledger (user_id, created_at DESC);

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS mobility_credit NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Cash agent float accounts
CREATE TABLE IF NOT EXISTS cash_agent_accounts (
  agent_id UUID PRIMARY KEY REFERENCES cash_agents(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cash_agent_accounts (agent_id, balance, currency)
SELECT id, 50000, 'GHS' FROM cash_agents
WHERE NOT EXISTS (SELECT 1 FROM cash_agent_accounts a WHERE a.agent_id = cash_agents.id);

-- Driver earnings guarantees (income floor)
CREATE TABLE IF NOT EXISTS driver_earnings_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  min_amount NUMERIC(12,2) NOT NULL,
  earned_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  topup_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  status VARCHAR(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'fulfilled', 'topped_up', 'cancelled')),
  zone_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_driver_guarantees_status
  ON driver_earnings_guarantees (status, window_end);

-- Destination / going-home prefs (driver maximizes $/hour by heading toward demand)
CREATE TABLE IF NOT EXISTS driver_destination_prefs (
  driver_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  dest_lat DOUBLE PRECISION NOT NULL,
  dest_lng DOUBLE PRECISION NOT NULL,
  radius_km NUMERIC(8,2) NOT NULL DEFAULT 3,
  bonus_accept NUMERIC(12,2) NOT NULL DEFAULT 0,
  active_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Family / diaspora ride credit circles
CREATE TABLE IF NOT EXISTS wallet_share_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL DEFAULT 'Family rides',
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_share_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES wallet_share_circles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_limit NUMERIC(12,2) NOT NULL DEFAULT 50,
  spent_today NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent_on DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_share_member ON wallet_share_members (member_id, status);

-- City co-op corridors (capped rider fare + driver volume guarantee)
CREATE TABLE IF NOT EXISTS mobility_corridors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  city VARCHAR(64) NOT NULL,
  country_code VARCHAR(8) NOT NULL DEFAULT 'GH',
  origin_zone_id UUID REFERENCES pricing_zones(id) ON DELETE SET NULL,
  dest_zone_id UUID REFERENCES pricing_zones(id) ON DELETE SET NULL,
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  dest_lat DOUBLE PRECISION,
  dest_lng DOUBLE PRECISION,
  radius_km NUMERIC(8,2) NOT NULL DEFAULT 2.5,
  max_rider_fare NUMERIC(12,2) NOT NULL,
  driver_min_payout NUMERIC(12,2) NOT NULL,
  municipal_code VARCHAR(64),
  vehicle_codes TEXT[] NOT NULL DEFAULT ARRAY['okada','keke','economy','shared','standard'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobility_corridors_city ON mobility_corridors (city, country_code, is_active);

-- Remittance → mobility credit gifts
CREATE TABLE IF NOT EXISTS remittance_ride_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(32),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  rides_remaining INT,
  note TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'exhausted', 'cancelled')),
  claim_code VARCHAR(32) UNIQUE,
  transfer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

-- Channel booking receipt / SLA trail
CREATE TABLE IF NOT EXISTS channel_booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(24) NOT NULL,
  session_key VARCHAR(128),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ride_id UUID,
  event_type VARCHAR(48) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_booking_ride ON channel_booking_events (ride_id, created_at DESC);

-- Seed sample corridors (Accra / Lagos) if zones exist
INSERT INTO mobility_corridors (
  name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
  radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
)
SELECT
  'School run · Accra corridor',
  'Accra',
  'GH',
  5.5600,
  -0.2050,
  5.6037,
  -0.1870,
  3,
  15,
  18,
  'AMA-EDU-01',
  ARRAY['okada','keke','shared','economy','standard']
WHERE NOT EXISTS (SELECT 1 FROM mobility_corridors WHERE municipal_code = 'AMA-EDU-01');

INSERT INTO mobility_corridors (
  name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
  radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
)
SELECT
  'Hospital access · Lagos corridor',
  'Lagos',
  'NG',
  6.4281,
  3.4219,
  6.5244,
  3.3792,
  4,
  2500,
  2800,
  'LASG-HEALTH-01',
  ARRAY['okada','keke','shared','economy','standard']
WHERE NOT EXISTS (SELECT 1 FROM mobility_corridors WHERE municipal_code = 'LASG-HEALTH-01');

-- Ensure African vehicle aliases stay active
UPDATE vehicle_types SET is_active = TRUE, name = COALESCE(NULLIF(name,''), code)
WHERE code IN ('okada', 'keke', 'shared', 'economy', 'motorcycle', 'tricycle', 'standard', 'xl');

INSERT INTO platform_settings (key, value)
VALUES
  (
    'africa_mobility_rails',
    '{
      "enabled": true,
      "mobility_credit": true,
      "driver_guarantees": true,
      "family_share": true,
      "corridors": true,
      "destination_prefs": true,
      "channel_first": true,
      "trust_scores": true,
      "remittance_gifts": true,
      "default_guarantee_hourly": 25,
      "guarantee_window_hours": 4
    }'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
