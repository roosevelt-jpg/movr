-- Phase 1 — Super-App Shell (renumbered from 002_super_app_shell.sql)

CREATE TABLE IF NOT EXISTS saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(64) NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, label)
);

-- wallets / wallet_transactions already exist in init.sql;
-- ensure Phase 1 columns are present for points balance naming used by the shell.

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS points_balance NUMERIC(14,2) DEFAULT 0;

UPDATE wallets
SET points_balance = COALESCE(points_balance, balance_points, 0)
WHERE points_balance IS NULL OR points_balance = 0;

CREATE TABLE IF NOT EXISTS wallet_transactions_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  reference VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user ON saved_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_v2_wallet ON wallet_transactions_v2(wallet_id);
