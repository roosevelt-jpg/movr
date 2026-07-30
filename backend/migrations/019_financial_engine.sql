-- Phase 18 — Financial & settlement engine (019; was 017_financial_engine.sql)

CREATE TABLE IF NOT EXISTS gmv_daily_rollup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  country VARCHAR(8) NOT NULL DEFAULT 'GH',
  service_type VARCHAR(32) NOT NULL,
  gmv_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'GHS',
  UNIQUE (date, country, service_type, currency)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(32) DEFAULT 'draft',
  recipient_type VARCHAR(32) NOT NULL,
  total_amount NUMERIC(16,2) DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'GHS',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  initiated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payout_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  merchant_id UUID REFERENCES merchants(id),
  amount NUMERIC(14,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  tx_reference VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmv_daily ON gmv_daily_rollup(date, country);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch ON payout_batch_items(batch_id);
