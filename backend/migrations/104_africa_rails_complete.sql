-- 104: Close Africa rails gaps — pools, polygons, remittance corridors, topup intents, agent float ops
ALTER TABLE mobility_corridors
  ADD COLUMN IF NOT EXISTS origin_polygon JSONB,
  ADD COLUMN IF NOT EXISTS dest_polygon JSONB;

CREATE TABLE IF NOT EXISTS share_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(24) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'matching', 'full', 'en_route', 'completed', 'cancelled')),
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  dest_lat DOUBLE PRECISION NOT NULL,
  dest_lng DOUBLE PRECISION NOT NULL,
  pickup_radius_km NUMERIC(6,2) NOT NULL DEFAULT 1.2,
  dropoff_radius_km NUMERIC(6,2) NOT NULL DEFAULT 1.5,
  max_riders INT NOT NULL DEFAULT 3,
  rider_count INT NOT NULL DEFAULT 0,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ride_ids UUID[] NOT NULL DEFAULT '{}',
  fare_mode VARCHAR(32) NOT NULL DEFAULT 'share',
  vehicle_code VARCHAR(32) NOT NULL DEFAULT 'shared',
  country_code VARCHAR(8) DEFAULT 'GH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_pools_open
  ON share_pools (status, created_at)
  WHERE status IN ('open', 'matching');

CREATE TABLE IF NOT EXISTS share_pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES share_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ride_id UUID,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  status VARCHAR(24) NOT NULL DEFAULT 'joined',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, user_id)
);

CREATE TABLE IF NOT EXISTS remittance_corridors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  from_country VARCHAR(8) NOT NULL,
  to_country VARCHAR(8) NOT NULL,
  currency_from VARCHAR(8) NOT NULL,
  currency_to VARCHAR(8) NOT NULL,
  fx_rate NUMERIC(14,6) NOT NULL DEFAULT 1,
  fee_percent NUMERIC(6,3) NOT NULL DEFAULT 1.5,
  fee_flat NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_amount NUMERIC(12,2) NOT NULL DEFAULT 10,
  max_amount NUMERIC(12,2) NOT NULL DEFAULT 5000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO remittance_corridors (name, from_country, to_country, currency_from, currency_to, fx_rate, fee_percent, fee_flat, compliance_note)
SELECT * FROM (VALUES
  ('UK → Ghana rides', 'GB', 'GH', 'GBP', 'GHS', 16.5, 1.2, 1.0, 'Custodial mobility credit — not a licensed MSB product'),
  ('US → Nigeria rides', 'US', 'NG', 'USD', 'NGN', 1550, 1.5, 0.5, 'Custodial mobility credit — not a licensed MSB product'),
  ('UAE → Ghana rides', 'AE', 'GH', 'AED', 'GHS', 3.5, 1.4, 1.0, 'Custodial mobility credit — not a licensed MSB product'),
  ('Ghana → Nigeria rides', 'GH', 'NG', 'GHS', 'NGN', 95, 1.0, 0, 'Regional P2P mobility credit')
) AS v(name, from_country, to_country, currency_from, currency_to, fx_rate, fee_percent, fee_flat, compliance_note)
WHERE NOT EXISTS (SELECT 1 FROM remittance_corridors LIMIT 1);

CREATE TABLE IF NOT EXISTS mobility_topup_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  source VARCHAR(32) NOT NULL, -- momo | card | airtime | salary | cash_agent | dvt
  provider VARCHAR(32), -- paystack | flutterwave | airtime_gateway | payroll
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_payment', 'completed', 'failed', 'cancelled')),
  payment_reference VARCHAR(128),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobility_topup_user ON mobility_topup_intents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cash_agent_float_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES cash_agents(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(14,2),
  kind VARCHAR(32) NOT NULL, -- deposit_confirm | withdraw_confirm | float_topup | adjust
  receipt_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed polygons for existing Accra/Lagos corridors (approx boxes)
UPDATE mobility_corridors
SET origin_polygon = jsonb_build_object(
      'type','Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(origin_lng - 0.02, origin_lat - 0.02),
        jsonb_build_array(origin_lng + 0.02, origin_lat - 0.02),
        jsonb_build_array(origin_lng + 0.02, origin_lat + 0.02),
        jsonb_build_array(origin_lng - 0.02, origin_lat + 0.02),
        jsonb_build_array(origin_lng - 0.02, origin_lat - 0.02)
      ))
    ),
    dest_polygon = jsonb_build_object(
      'type','Polygon',
      'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(dest_lng - 0.02, dest_lat - 0.02),
        jsonb_build_array(dest_lng + 0.02, dest_lat - 0.02),
        jsonb_build_array(dest_lng + 0.02, dest_lat + 0.02),
        jsonb_build_array(dest_lng - 0.02, dest_lat + 0.02),
        jsonb_build_array(dest_lng - 0.02, dest_lat - 0.02)
      ))
    )
WHERE origin_lat IS NOT NULL AND dest_lat IS NOT NULL
  AND origin_polygon IS NULL;

INSERT INTO platform_settings (key, value)
VALUES (
  'africa_rails_providers',
  '{
    "momo": true,
    "airtime": true,
    "salary": true,
    "share_pools": true,
    "remittance_corridors": true,
    "agent_float": true
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
