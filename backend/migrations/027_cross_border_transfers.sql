-- Phase 27 — Cross-border wallet transfers (027; was 025_cross_border_transfers.sql)

DO $$ BEGIN
  CREATE TYPE wallet_transfer_status AS ENUM ('pending', 'completed', 'failed', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS handle VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_handle
  ON users (LOWER(handle)) WHERE handle IS NOT NULL;

CREATE TABLE IF NOT EXISTS wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_wallet_id UUID NOT NULL REFERENCES wallets(id),
  recipient_wallet_id UUID REFERENCES wallets(id),
  sender_user_id UUID NOT NULL REFERENCES users(id),
  recipient_user_id UUID REFERENCES users(id),
  recipient_identifier VARCHAR(128),
  sent_amount NUMERIC(14,2) NOT NULL,
  sent_currency VARCHAR(8) NOT NULL,
  received_amount NUMERIC(14,2),
  received_currency VARCHAR(8),
  fx_rate_used NUMERIC(18,8),
  fee_amount NUMERIC(14,2) DEFAULT 0,
  status wallet_transfer_status DEFAULT 'pending',
  claim_code VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transfer_limits_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_per_tx NUMERIC(14,2) DEFAULT 500,
  max_per_day NUMERIC(14,2) DEFAULT 2000,
  requires_identity_linked_above NUMERIC(14,2) DEFAULT 100,
  fee_percent NUMERIC(6,3) DEFAULT 1.5,
  fee_flat NUMERIC(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO transfer_limits_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_sender ON wallet_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_claim ON wallet_transfers(claim_code)
  WHERE claim_code IS NOT NULL;
