-- 067: Customer tiers, token admin config, dispatcher broadcasts

-- Customer loyalty tier + last activity for Customer Management mockup
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(32) NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

COMMENT ON COLUMN users.loyalty_tier IS 'bronze | silver | gold | platinum (customers)';

CREATE INDEX IF NOT EXISTS idx_users_loyalty_tier ON users (loyalty_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users (last_active_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users (user_type);

-- Backfill last_active_at from created_at where null
UPDATE users SET last_active_at = COALESCE(last_active_at, created_at)
WHERE last_active_at IS NULL;

-- Token distribution allocation (1B supply breakdown for admin UI)
CREATE TABLE IF NOT EXISTS token_distribution (
  id SERIAL PRIMARY KEY,
  category VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(128) NOT NULL,
  pct NUMERIC(6, 2) NOT NULL,
  color VARCHAR(16),
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO token_distribution (category, label, pct, color, sort_order) VALUES
  ('riders', 'Riders', 30, '#3B82F6', 1),
  ('drivers', 'Drivers', 30, '#60A5FA', 2),
  ('treasury', 'Treasury', 20, '#22C55E', 3),
  ('community', 'Community', 10, '#F97316', 4),
  ('reserve', 'Reserve', 10, '#A855F7', 5)
ON CONFLICT (category) DO NOTHING;

-- Dispatcher broadcast alerts
CREATE TABLE IF NOT EXISTS dispatch_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  zone VARCHAR(128),
  audience VARCHAR(64) NOT NULL DEFAULT 'drivers',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_broadcasts_created ON dispatch_broadcasts (created_at DESC);

-- Dispatcher shift reports (end-of-shift summary snapshots)
CREATE TABLE IF NOT EXISTS dispatch_shift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone VARCHAR(128) NOT NULL DEFAULT 'default',
  dispatcher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  active_rides INT NOT NULL DEFAULT 0,
  queued_rides INT NOT NULL DEFAULT 0,
  drivers_online INT NOT NULL DEFAULT 0,
  avg_match_seconds NUMERIC(10, 2),
  notes TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure merchants have operable status for marketplace tabs
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS category VARCHAR(64),
  ADD COLUMN IF NOT EXISTS city VARCHAR(128),
  ADD COLUMN IF NOT EXISTS rating NUMERIC(4, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants (status);

-- Soft-assign customer tiers from spend heuristics (safe defaults)
UPDATE users u
SET loyalty_tier = CASE
  WHEN COALESCE((
    SELECT SUM(COALESCE(r.actual_fare, r.estimated_fare, 0)) FROM rides r WHERE r.customer_id = u.id AND r.status = 'completed'
  ), 0) >= 5000 THEN 'platinum'
  WHEN COALESCE((
    SELECT SUM(COALESCE(r.actual_fare, r.estimated_fare, 0)) FROM rides r WHERE r.customer_id = u.id AND r.status = 'completed'
  ), 0) >= 2000 THEN 'gold'
  WHEN COALESCE((
    SELECT SUM(COALESCE(r.actual_fare, r.estimated_fare, 0)) FROM rides r WHERE r.customer_id = u.id AND r.status = 'completed'
  ), 0) >= 500 THEN 'silver'
  ELSE 'bronze'
END
WHERE u.user_type IN ('customer', 'rider', 'user')
  AND COALESCE(u.loyalty_tier, 'bronze') = 'bronze';
