-- Phase 0C — Integrations Hub

CREATE TYPE integration_key AS ENUM (
  'paystack',
  'flutterwave',
  'twilio',
  'telegram_bot',
  'google_maps',
  'openai',
  'openweathermap',
  'africastalking_ussd',
  'nia_ghana_card',
  'dvla_ghana',
  'aws_s3',
  'sentry'
);

CREATE TYPE integration_category AS ENUM (
  'payments',
  'messaging',
  'maps_location',
  'ai_voice',
  'identity_verification',
  'infrastructure'
);

CREATE TYPE integration_status AS ENUM (
  'not_configured',
  'configured',
  'connected',
  'error'
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key integration_key NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  category integration_category NOT NULL,
  status integration_status NOT NULL DEFAULT 'not_configured',
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  credential_key VARCHAR(64) NOT NULL,
  encrypted_value TEXT NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_admin_id UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, credential_key)
);

CREATE TABLE IF NOT EXISTS integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  config_key VARCHAR(64) NOT NULL,
  config_value TEXT NOT NULL,
  UNIQUE (integration_id, config_key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO integrations (key, display_name, category, is_required) VALUES
  ('paystack', 'Paystack', 'payments', TRUE),
  ('flutterwave', 'Flutterwave', 'payments', TRUE),
  ('twilio', 'Twilio', 'messaging', FALSE),
  ('telegram_bot', 'Telegram Bot', 'messaging', FALSE),
  ('google_maps', 'Google Maps', 'maps_location', TRUE),
  ('openai', 'OpenAI', 'ai_voice', FALSE),
  ('openweathermap', 'OpenWeatherMap', 'maps_location', FALSE),
  ('africastalking_ussd', 'Africa''s Talking USSD', 'messaging', FALSE),
  ('nia_ghana_card', 'NIA Ghana Card', 'identity_verification', FALSE),
  ('dvla_ghana', 'DVLA Ghana', 'identity_verification', FALSE),
  ('aws_s3', 'AWS S3', 'infrastructure', FALSE),
  ('sentry', 'Sentry', 'infrastructure', FALSE)
ON CONFLICT (key) DO NOTHING;
