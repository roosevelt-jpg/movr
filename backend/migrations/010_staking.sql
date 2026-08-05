-- Phase 7 — Staking (010; was 008_staking.sql)
-- Gated by STAKING_SYSTEM_ENABLED / compliance review.

CREATE TABLE IF NOT EXISTS staking_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  target_role VARCHAR(32) NOT NULL CHECK (target_role IN ('driver', 'merchant', 'public')),
  apy_or_benefit_desc TEXT NOT NULL,
  min_amount NUMERIC(28,8) NOT NULL DEFAULT 0,
  lock_period_days INT NOT NULL DEFAULT 30,
  base_apy_pct NUMERIC(8,4) DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES staking_pools(id),
  amount NUMERIC(28,8) NOT NULL CHECK (amount > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unstaking', 'withdrawn')),
  staked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlock_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS staking_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_role VARCHAR(32) NOT NULL CHECK (target_role IN ('driver', 'merchant')),
  tier_name VARCHAR(64) NOT NULL,
  min_stake NUMERIC(28,8) NOT NULL,
  priority_weight NUMERIC(8,4) NOT NULL DEFAULT 1,
  fee_discount_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
  UNIQUE (target_role, tier_name)
);

CREATE INDEX IF NOT EXISTS idx_stakes_user ON stakes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stakes_pool ON stakes(pool_id, status);

INSERT INTO staking_pools (name, target_role, apy_or_benefit_desc, min_amount, lock_period_days, base_apy_pct)
SELECT * FROM (VALUES
  ('Driver Priority Pool', 'driver', 'Priority matching + commission discount by tier', 100::numeric, 30, 0::numeric),
  ('Merchant Growth Pool', 'merchant', 'Lower platform fee + boosted store placement', 200::numeric, 30, 0::numeric),
  ('Public Pre-Launch', 'public', 'APY-style points accrual into points_ledger', 50::numeric, 14, 8::numeric)
) AS v(name, target_role, apy_or_benefit_desc, min_amount, lock_period_days, base_apy_pct)
WHERE NOT EXISTS (SELECT 1 FROM staking_pools LIMIT 1);

INSERT INTO staking_tiers (target_role, tier_name, min_stake, priority_weight, fee_discount_pct)
SELECT * FROM (VALUES
  ('driver', 'bronze', 100::numeric, 1.05::numeric, 2::numeric),
  ('driver', 'silver', 500::numeric, 1.15::numeric, 5::numeric),
  ('driver', 'gold', 2000::numeric, 1.30::numeric, 10::numeric),
  ('merchant', 'bronze', 200::numeric, 1.05::numeric, 2::numeric),
  ('merchant', 'silver', 1000::numeric, 1.15::numeric, 5::numeric),
  ('merchant', 'gold', 5000::numeric, 1.30::numeric, 12::numeric)
) AS v(target_role, tier_name, min_stake, priority_weight, fee_discount_pct)
WHERE NOT EXISTS (SELECT 1 FROM staking_tiers LIMIT 1);
