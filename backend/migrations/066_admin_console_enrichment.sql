-- 066: Admin console enrichment for Dashboard / Live Map / Drivers / Finance mockups

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';

COMMENT ON COLUMN drivers.status IS 'active | suspended | pending_kyc | offline_forced';

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers (status);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON drivers (is_online);

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

UPDATE rides SET requested_at = COALESCE(requested_at, created_at) WHERE requested_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  audience VARCHAR(64) NOT NULL DEFAULT 'all',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_status ON admin_announcements (status, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(32) NOT NULL DEFAULT 'complaint',
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  title VARCHAR(200) NOT NULL,
  body TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  merchant_id UUID,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  source_table VARCHAR(64),
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_incidents_status ON ops_incidents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_kind ON ops_incidents (kind);

CREATE TABLE IF NOT EXISTS merchant_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales NUMERIC(14, 2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_payout NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  due_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  payout_reference VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_settlements_status ON merchant_settlements (status, due_date);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_merchant ON merchant_settlements (merchant_id);

CREATE TABLE IF NOT EXISTS revenue_daily_rollup (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  country VARCHAR(8) NOT NULL DEFAULT '',
  category VARCHAR(64) NOT NULL,
  gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  UNIQUE (date, country, category, currency)
);

CREATE INDEX IF NOT EXISTS idx_revenue_daily_date ON revenue_daily_rollup (date DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_dashboard_stats') THEN
    ALTER TABLE admin_dashboard_stats
      ADD COLUMN IF NOT EXISTS active_drivers INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS active_drivers_delta NUMERIC(8, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS marketplace_orders_today INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS marketplace_orders_delta NUMERIC(8, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS avg_driver_rating NUMERIC(4, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS subscribed_drivers INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS weekly_revenue NUMERIC(14, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_revenue_30d NUMERIC(14, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS dvt_distributed NUMERIC(14, 2) DEFAULT 0;
  END IF;
END $$;

INSERT INTO ops_incidents (kind, severity, title, body, status)
SELECT 'sos', 'critical', 'SOS Alert — sample', 'Seeded SOS for live map feed', 'open'
WHERE NOT EXISTS (SELECT 1 FROM ops_incidents WHERE title = 'SOS Alert — sample');

INSERT INTO ops_incidents (kind, severity, title, body, status)
SELECT 'complaint', 'medium', 'Driver Complaint — Late pickup', 'Seeded complaint for live map feed', 'open'
WHERE NOT EXISTS (SELECT 1 FROM ops_incidents WHERE title = 'Driver Complaint — Late pickup');
