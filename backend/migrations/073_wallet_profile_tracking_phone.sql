-- 073: Wallet portfolio, profile stats, live tracking, phone OTP entry

ALTER TABLE wallet_transactions_v2
  ADD COLUMN IF NOT EXISTS currency_unit VARCHAR(16) DEFAULT 'fiat',
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS icon_key VARCHAR(32);

-- Unread notifications counter helper
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications (user_id, is_read);

-- Seed sample notifications if empty (demo)
INSERT INTO user_notifications (user_id, title, body, is_read)
SELECT u.id, v.title, v.body, false
FROM users u
CROSS JOIN (VALUES
  ('Welcome to Movr', 'Your wallet is ready.'),
  ('DVT rewards live', 'Earn tokens on every ride.'),
  ('Trip shared', 'Someone viewed your live trip.')
) AS v(title, body)
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND NOT EXISTS (SELECT 1 FROM user_notifications LIMIT 1)
LIMIT 3;

-- Ride share token already exists via ride_share_links; ensure status timeline helpers
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS eta_minutes INT,
  ADD COLUMN IF NOT EXISTS driver_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS driver_lng DOUBLE PRECISION;

-- Auth OTP purpose for phone-entry login
-- auth_otps already supports purpose; allow 'login'
DO $$
BEGIN
  -- no-op if table missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_otps') THEN
    NULL;
  END IF;
END $$;
