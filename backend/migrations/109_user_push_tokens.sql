-- Device push tokens for FCM / Expo notifications (customer + driver apps).

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(16) NOT NULL DEFAULT 'android',
  app VARCHAR(24) NOT NULL DEFAULT 'customer',
  provider VARCHAR(16) NOT NULL DEFAULT 'fcm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON user_push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_app ON user_push_tokens (user_id, app);
