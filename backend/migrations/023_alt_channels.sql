-- Phase 22 — Alt booking channels (023; was 021_alt_channels.sql)

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(32) DEFAULT 'app';

CREATE TABLE IF NOT EXISTS user_channel_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_rides_source_channel ON rides(source_channel);
CREATE INDEX IF NOT EXISTS idx_channel_links_user ON user_channel_links(user_id);
