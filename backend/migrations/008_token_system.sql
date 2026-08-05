-- Phase 5B — DVT token system (008; was 006_token_system.sql)
-- Regulatory note: launch gated by TOKEN_SYSTEM_ENABLED / compliance review.

CREATE TABLE IF NOT EXISTS custodial_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  address VARCHAR(64) NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pending_amount NUMERIC(28,8) NOT NULL DEFAULT 0,
  onchain_amount NUMERIC(28,8) NOT NULL DEFAULT 0,
  last_synced_block BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(64) NOT NULL,
  dvt_amount NUMERIC(28,8) NOT NULL,
  tx_hash VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_redeem_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dvt_per_fiat_unit NUMERIC(18,8) NOT NULL DEFAULT 10,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'GHS',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO token_redeem_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_token_activity_user ON token_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custodial_wallets_address ON custodial_wallets(address);
