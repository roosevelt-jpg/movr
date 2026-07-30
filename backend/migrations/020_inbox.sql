-- Phase 19 — In-app inbox (020; was 018_inbox.sql)

DO $$ BEGIN
  CREATE TYPE inbox_category AS ENUM (
    'system', 'promo', 'order_update', 'ride_update', 'rewards', 'security'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category inbox_category NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  deep_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_unread ON inbox_messages(user_id) WHERE read = FALSE;
