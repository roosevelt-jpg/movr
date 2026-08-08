-- 070: Broadcast center, dispatch queue settings, analytics helpers

-- Notification / broadcast campaigns
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  target_audience VARCHAR(64) NOT NULL DEFAULT 'all_users',
  channels TEXT[] NOT NULL DEFAULT ARRAY['push','in_app'],
  schedule_mode VARCHAR(32) NOT NULL DEFAULT 'immediate',
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  sent_count INT NOT NULL DEFAULT 0,
  open_count INT NOT NULL DEFAULT 0,
  unsubscribe_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_sent ON notification_broadcasts (sent_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS notification_broadcast_events (
  id BIGSERIAL PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES notification_broadcasts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_events_broadcast ON notification_broadcast_events (broadcast_id, event_type);

-- Broadcast templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT ARRAY['push'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_templates (name, title, body, channels)
SELECT * FROM (VALUES
  ('Double DVT', 'Double DVT Weekend Is Live!', 'Earn 2x DriveTokens on every ride and order this weekend only.', ARRAY['push','in_app']),
  ('Subscription Reminder', 'Your plan expires soon', 'Renew your driver subscription to keep earning without interruption.', ARRAY['push','email'])
) AS v(name, title, body, channels)
WHERE NOT EXISTS (SELECT 1 FROM notification_templates LIMIT 1);

-- Ride priority for dispatcher queue
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS priority VARCHAR(16) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rides_priority ON rides (priority) WHERE status IN ('requested','searching','pending');

-- Dispatcher automation settings
CREATE TABLE IF NOT EXISTS dispatch_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_assign BOOLEAN NOT NULL DEFAULT true,
  nearest_first BOOLEAN NOT NULL DEFAULT true,
  zone VARCHAR(128) DEFAULT 'Lagos Zone',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO dispatch_settings (id, auto_assign, nearest_first)
VALUES (1, true, true)
ON CONFLICT (id) DO NOTHING;

-- Platform analytics snapshots (optional cache)
CREATE TABLE IF NOT EXISTS platform_analytics_daily (
  date DATE PRIMARY KEY,
  mau INT DEFAULT 0,
  gmv NUMERIC(14, 2) DEFAULT 0,
  rides_count INT DEFAULT 0,
  new_users INT DEFAULT 0,
  retention_pct NUMERIC(6, 2) DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'GHS'
);

-- User acquisition channel on users if missing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS acquisition_channel VARCHAR(64);

-- Seed a couple of broadcast history rows for empty envs
INSERT INTO notification_broadcasts (title, body, target_audience, channels, status, sent_count, open_count, sent_at)
SELECT * FROM (VALUES
  ('Double DVT Weekend!', 'Earn 2x DriveTokens this weekend.', 'all_users', ARRAY['push','in_app'], 'sent', 48291, 34770, NOW() - INTERVAL '1 day'),
  ('Renew before you lose rides', 'Your subscription expires soon.', 'expiring_soon', ARRAY['push'], 'sent', 1204, 710, NOW() - INTERVAL '2 days')
) AS v(title, body, target_audience, channels, status, sent_count, open_count, sent_at)
WHERE NOT EXISTS (SELECT 1 FROM notification_broadcasts LIMIT 1);
