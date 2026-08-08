-- 069: Promotions admin, KYC review metadata, profile helpers

-- Platform-wide promotions (admin Coupons mockup)
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  promo_type VARCHAR(64) NOT NULL DEFAULT 'ride_discount',
  discount_unit VARCHAR(32) NOT NULL DEFAULT 'percent',
  discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(12, 2) DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_redemptions INT,
  current_redemptions INT NOT NULL DEFAULT 0,
  applies_to VARCHAR(64) NOT NULL DEFAULT 'all',
  new_users_only BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  dvt_bonus_amount NUMERIC(14, 2) DEFAULT 0,
  revenue_impact NUMERIC(14, 2) DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions (status, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions (code);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID,
  ride_id UUID,
  discount_applied NUMERIC(12, 2) DEFAULT 0,
  dvt_bonus NUMERIC(14, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON promotion_redemptions (promotion_id);

-- Extend coupons with admin-friendly fields (keep store coupons working)
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS min_order_value NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_redemptions INT,
  ADD COLUMN IF NOT EXISTS current_redemptions INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_type VARCHAR(64) DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS new_users_only BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status VARCHAR(32);

UPDATE coupons SET status = CASE
  WHEN COALESCE(is_active, true) = false THEN 'expired'
  WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
  WHEN starts_at IS NOT NULL AND starts_at > NOW() THEN 'scheduled'
  ELSE 'active'
END
WHERE status IS NULL;

-- KYC review notes + timing
CREATE TABLE IF NOT EXISTS kyc_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(32) NOT NULL,
  subject_id UUID NOT NULL,
  status VARCHAR(32) NOT NULL,
  note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_reviews_subject ON kyc_reviews (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_kyc_reviews_reviewed ON kyc_reviews (reviewed_at DESC);

-- Admin inbox / messages to users
CREATE TABLE IF NOT EXISTS admin_user_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(200),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Loyalty thresholds for customer reward progress
CREATE TABLE IF NOT EXISTS loyalty_thresholds (
  tier VARCHAR(32) PRIMARY KEY,
  min_points INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO loyalty_thresholds (tier, min_points, sort_order) VALUES
  ('bronze', 0, 1),
  ('silver', 200, 2),
  ('gold', 500, 3),
  ('platinum', 1000, 4)
ON CONFLICT (tier) DO NOTHING;

-- Seed a few sample promotions for empty envs
INSERT INTO promotions (code, promo_type, discount_unit, discount_value, min_order_value, max_redemptions, current_redemptions, status, ends_at, applies_to)
SELECT * FROM (VALUES
  ('MOVR50', 'ride_discount', 'percent', 50::numeric, 500::numeric, 2000, 1241, 'active', NOW() + INTERVAL '30 days', 'rides'),
  ('MOVRGRO20', 'grocery', 'percent', 20::numeric, 2000::numeric, 5000, 892, 'active', NOW() + INTERVAL '14 days', 'shop'),
  ('DOUBLDVT', 'token_bonus', 'multiplier', 2::numeric, 0::numeric, NULL::int, 3200, 'permanent', NULL::timestamptz, 'all'),
  ('WELCOME500', 'new_user', 'fixed', 500::numeric, 0::numeric, 10000, 4100, 'active', NULL::timestamptz, 'all')
) AS v(code, promo_type, discount_unit, discount_value, min_order_value, max_redemptions, current_redemptions, status, ends_at, applies_to)
WHERE NOT EXISTS (SELECT 1 FROM promotions LIMIT 1);
