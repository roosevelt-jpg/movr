-- 068: Platform settings, store open flag, staking lock pools, ride list helpers

-- Store accepting orders toggle (merchant portal Store Open)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prep_time_minutes INT DEFAULT 15;

-- Platform settings (admin Settings & Audit mockup)
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO platform_settings (key, value) VALUES
  ('surge_pricing', '{"enabled": true, "label": "Surge Pricing", "description": "Auto-enable during high demand."}'::jsonb),
  ('dvt_rewards', '{"enabled": true, "label": "DVT Rewards", "description": "Credit tokens on all transactions."}'::jsonb),
  ('merchant_kyc_approval', '{"enabled": true, "label": "Merchant KYC Approval", "description": "Require manual review."}'::jsonb),
  ('maintenance_mode', '{"enabled": false, "label": "Maintenance Mode", "description": "Disable all public APIs."}'::jsonb),
  ('token_claims', '{"enabled": true, "label": "Token Claims", "description": "Allow users to claim DVT."}'::jsonb),
  ('pricing_fees', '{"base_fare_per_km": 120, "merchant_fee_pct": 5, "surge_max_multiplier": 3.0, "min_ride_fare": 500, "driver_sub_monthly": 7000, "currency": "NGN"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed feature flags for settings toggles (compatible with feature_flags table)
INSERT INTO feature_flags (key, enabled, rollout_pct, metadata)
SELECT v.key, v.enabled, 100, v.metadata::jsonb
FROM (VALUES
  ('surge_pricing', true, '{"label":"Surge Pricing","description":"Auto-enable during high demand."}'),
  ('dvt_rewards', true, '{"label":"DVT Rewards","description":"Credit tokens on all transactions."}'),
  ('merchant_kyc_approval', true, '{"label":"Merchant KYC Approval","description":"Require manual review."}'),
  ('maintenance_mode', false, '{"label":"Maintenance Mode","description":"Disable all public APIs."}'),
  ('token_claims', true, '{"label":"Token Claims","description":"Allow users to claim DVT."}')
) AS v(key, enabled, metadata)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feature_flags')
ON CONFLICT (key) DO NOTHING;

-- Staking pools aligned to Flexible / 30-Day / 90-Day product cards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staking_pools') THEN
    ALTER TABLE staking_pools
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(128),
      ADD COLUMN IF NOT EXISTS tagline VARCHAR(255),
      ADD COLUMN IF NOT EXISTS min_stake NUMERIC(28,8) DEFAULT 100,
      ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS staker_count INT DEFAULT 0;

    -- Upsert flexible / 30 / 90 if not present by lock days
    IF NOT EXISTS (SELECT 1 FROM staking_pools WHERE COALESCE(lock_period_days, lock_days, 0) = 0 AND COALESCE(display_name,'') ILIKE '%flex%') THEN
      INSERT INTO staking_pools (name, display_name, tagline, lock_period_days, base_apy_pct, min_stake, is_popular, target_role)
      VALUES ('flexible', 'Flexible Pool', 'No lock - Withdraw anytime', 0, 8.5, 100, false, 'public')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- schema variants across envs
END $$;

-- Public display name for existing pools (best-effort)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staking_pools' AND column_name = 'display_name'
  ) THEN
    UPDATE staking_pools
    SET display_name = COALESCE(NULLIF(display_name,''), name),
        tagline = COALESCE(tagline,
          CASE
            WHEN COALESCE(lock_period_days, 0) = 0 THEN 'No lock - Withdraw anytime'
            WHEN COALESCE(lock_period_days, 0) BETWEEN 1 AND 45 THEN 'Best balance of risk & reward'
            ELSE 'Maximum yield'
          END
        ),
        is_popular = CASE WHEN COALESCE(lock_period_days, 0) BETWEEN 25 AND 45 THEN true ELSE COALESCE(is_popular, false) END
    WHERE display_name IS NULL OR display_name = '';
  END IF;
END $$;

-- Merchant coupons link (ensure merchant_id on coupons if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons') THEN
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS merchant_id UUID;
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS store_id UUID;
  END IF;
END $$;
