-- Phase 8 — Merkle airdrop claims (011; was 009_claims.sql)

CREATE TABLE IF NOT EXISTS airdrop_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  merkle_root VARCHAR(66) NOT NULL,
  label VARCHAR(128),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS airdrop_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES airdrop_snapshots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  address VARCHAR(64) NOT NULL,
  amount NUMERIC(28,8) NOT NULL,
  leaf_index INT NOT NULL,
  proof JSONB NOT NULL DEFAULT '[]'::jsonb,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  claim_tx_hash VARCHAR(128),
  UNIQUE (snapshot_id, leaf_index),
  UNIQUE (snapshot_id, address)
);

CREATE INDEX IF NOT EXISTS idx_airdrop_alloc_user ON airdrop_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_airdrop_alloc_snapshot ON airdrop_allocations(snapshot_id);
