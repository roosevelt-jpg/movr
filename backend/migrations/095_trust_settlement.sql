-- Trust & Settlement foundations: cash rails, receipts, reliability compensation, KYC payout gates

CREATE TABLE IF NOT EXISTS cash_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  city VARCHAR(120),
  country_code VARCHAR(8) DEFAULT 'GH',
  address TEXT,
  phone VARCHAR(40),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  hours_text VARCHAR(120) DEFAULT '7am–9pm',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_agents_city ON cash_agents(city) WHERE is_active;

CREATE TABLE IF NOT EXISTS wallet_rail_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rail_type VARCHAR(24) NOT NULL CHECK (rail_type IN ('wallet', 'momo', 'bank', 'cash_agent')),
  provider VARCHAR(80),
  account_mask VARCHAR(80),
  account_number VARCHAR(80),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_rail_user ON wallet_rail_methods(user_id, rail_type);

CREATE TABLE IF NOT EXISTS settlement_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  reference VARCHAR(80) NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  channel VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'completed',
  counterparty VARCHAR(160),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_receipts_user ON settlement_receipts(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_receipts_ref ON settlement_receipts(reference);

CREATE TABLE IF NOT EXISTS reliability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ride_id UUID,
  order_id UUID,
  event_type VARCHAR(40) NOT NULL,
  sla_seconds INT,
  wait_seconds INT,
  compensation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  status VARCHAR(24) NOT NULL DEFAULT 'credited'
    CHECK (status IN ('pending', 'credited', 'denied', 'waived')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reliability_events_user ON reliability_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reliability_events_ride ON reliability_events(ride_id);

CREATE TABLE IF NOT EXISTS unified_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain VARCHAR(24) NOT NULL CHECK (domain IN ('ride', 'shop', 'wallet', 'parcel', 'rental')),
  subject_id UUID,
  reason TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'rejected')),
  refund_amount NUMERIC(12,2),
  currency VARCHAR(8) DEFAULT 'GHS',
  ops_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_disputes_status ON unified_disputes(status, created_at DESC);

-- Platform trust knobs (value is JSONB)
INSERT INTO platform_settings (key, value)
VALUES
  ('trust_match_sla_seconds', '180'::jsonb),
  ('trust_no_show_credit', '500'::jsonb),
  ('trust_kyc_payout_threshold', '2000'::jsonb),
  ('trust_merchant_prep_buffer_min', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed cash agents (idempotent by name+city)
INSERT INTO cash_agents (name, city, country_code, address, phone, lat, lng, hours_text)
SELECT v.name, v.city, v.country_code, v.address, v.phone, v.lat, v.lng, v.hours_text
FROM (VALUES
  ('Movr Agent · Osu', 'Accra', 'GH', 'Oxford St, Osu', '+233201111001', 5.5557, -0.1826, '7am–9pm'),
  ('Movr Agent · Madina', 'Accra', 'GH', 'Madina Market Gate', '+233201111002', 5.6680, -0.1670, '7am–8pm'),
  ('Movr Agent · VI', 'Lagos', 'NG', 'Adeola Odeku, VI', '+2348011110001', 6.4281, 3.4219, '8am–9pm'),
  ('Movr Agent · Lekki', 'Lagos', 'NG', 'Admiralty Way, Lekki', '+2348011110002', 6.4474, 3.4721, '8am–9pm')
) AS v(name, city, country_code, address, phone, lat, lng, hours_text)
WHERE NOT EXISTS (
  SELECT 1 FROM cash_agents c WHERE c.name = v.name AND c.city = v.city
);

-- Ensure ride_share_links exists for trip sharing
CREATE TABLE IF NOT EXISTS ride_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_share_token ON ride_share_links(token);

-- Soften sos_emergencies for non-ride SOS (safety center)
DO $$
BEGIN
  ALTER TABLE sos_emergencies ALTER COLUMN ride_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE sos_emergencies ALTER COLUMN driver_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
