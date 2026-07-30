-- Phase 6 — Pre-launch points (009; was 007_points.sql)

CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(64) NOT NULL,
  points_earned NUMERIC(14,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_conversion_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type VARCHAR(64) NOT NULL UNIQUE,
  points_per_action NUMERIC(14,2) NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_global_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dvt_conversion_rate NUMERIC(18,8) NOT NULL DEFAULT 0.01,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO points_conversion_config (activity_type, points_per_action) VALUES
  ('ride_completed', 50),
  ('order_completed', 30),
  ('referral_confirmed', 100),
  ('staking_accrual', 10)
ON CONFLICT (activity_type) DO NOTHING;

INSERT INTO points_global_config (id, dvt_conversion_rate)
VALUES (1, 0.01)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_activity ON points_ledger(activity_type);
