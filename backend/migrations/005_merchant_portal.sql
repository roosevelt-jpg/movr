-- Phase 3 — Merchant portal (005; was 004_merchant_portal.sql)

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS business_registration_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(32) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS country VARCHAR(8) DEFAULT 'GH',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS merchant_kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  document_type VARCHAR(64) NOT NULL,
  document_number VARCHAR(128),
  file_url TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'GHS',
  status VARCHAR(32) DEFAULT 'pending',
  reference_id VARCHAR(128),
  bank_account JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_kyc_merchant ON merchant_kyc_documents(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_payouts_merchant ON merchant_payouts(merchant_id);
