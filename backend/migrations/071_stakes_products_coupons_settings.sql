-- 071: My Stakes rewards, merchant products/coupons/store settings enrichment

-- ——— Staking positions & rewards ———
ALTER TABLE staking_pools
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS tagline VARCHAR(255),
  ADD COLUMN IF NOT EXISTS min_stake NUMERIC(28,8) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

ALTER TABLE stakes
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(64),
  ADD COLUMN IF NOT EXISTS rewards_earned NUMERIC(28,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewards_claimed NUMERIC(28,8) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS stake_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id UUID NOT NULL REFERENCES stakes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  wallet_address VARCHAR(64),
  amount NUMERIC(28,8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakes_wallet ON stakes (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stake_claims_stake ON stake_reward_claims (stake_id);

-- Ensure Flexible / 30-Day / 90-Day public pools exist
INSERT INTO staking_pools (name, display_name, tagline, target_role, apy_or_benefit_desc, min_amount, lock_period_days, base_apy_pct, min_stake, is_popular, active)
SELECT v.name, v.display_name, v.tagline, 'public', v.tagline, v.min_stake, v.lock_days, v.apy, v.min_stake, v.popular, true
FROM (VALUES
  ('flexible', 'Flexible Pool', 'No lock - Withdraw anytime', 0, 8.5::numeric, 100::numeric, false),
  ('30-day-lock', '30-Day Lock', 'Best balance of risk & reward', 30, 14.5::numeric, 500::numeric, true),
  ('90-day-lock', '90-Day Lock', 'Maximum yield', 90, 18.5::numeric, 1000::numeric, false)
) AS v(name, display_name, tagline, lock_days, apy, min_stake, popular)
WHERE NOT EXISTS (
  SELECT 1 FROM staking_pools p
  WHERE p.name = v.name OR COALESCE(p.display_name,'') = v.display_name
);

UPDATE staking_pools
SET display_name = COALESCE(NULLIF(display_name,''), name),
    base_apy_pct = CASE
      WHEN COALESCE(lock_period_days,0) = 0 AND COALESCE(base_apy_pct,0) = 0 THEN 8.5
      WHEN COALESCE(lock_period_days,0) BETWEEN 25 AND 45 AND COALESCE(base_apy_pct,0) = 0 THEN 14.5
      WHEN COALESCE(lock_period_days,0) >= 90 AND COALESCE(base_apy_pct,0) = 0 THEN 18.5
      ELSE base_apy_pct
    END
WHERE active = TRUE;

-- ——— Products enrichment ———
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_qty INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE products SET
  is_available = COALESCE(is_available, in_stock, true),
  is_active = COALESCE(is_active, in_stock, true),
  stock_qty = COALESCE(stock_qty, CASE WHEN COALESCE(in_stock,true) THEN 50 ELSE 0 END);

-- ——— Coupons enrichment ———
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS usage_terms TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_label VARCHAR(64);

UPDATE coupons SET ends_at = COALESCE(ends_at, expires_at) WHERE ends_at IS NULL;

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  is_new_user BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions (coupon_id);

-- ——— Store settings enrichment ———
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS phone VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email VARCHAR(128),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(8,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS avg_prep_time_minutes INT DEFAULT 20,
  ADD COLUMN IF NOT EXISTS use_movr_courier BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS use_self_delivery BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_preorders BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS prep_time_minutes INT DEFAULT 15;

UPDATE stores SET
  avg_prep_time_minutes = COALESCE(avg_prep_time_minutes, prep_time_minutes, 20),
  store_code = COALESCE(store_code, 'STR-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 5)))
WHERE store_code IS NULL;

-- Default weekly hours when empty
UPDATE stores
SET hours_json = '{
  "monday":{"open":true,"from":"08:00","to":"22:00"},
  "tuesday":{"open":true,"from":"08:00","to":"22:00"},
  "wednesday":{"open":true,"from":"08:00","to":"22:00"},
  "thursday":{"open":true,"from":"08:00","to":"22:00"},
  "friday":{"open":true,"from":"08:00","to":"22:00"},
  "saturday":{"open":true,"from":"09:00","to":"22:00"},
  "sunday":{"open":false,"from":"09:00","to":"18:00"}
}'::jsonb
WHERE hours_json IS NULL OR hours_json = '{}'::jsonb OR NOT (hours_json ? 'monday');
