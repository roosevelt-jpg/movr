-- Ensure messaging/payments catalog keys exist (enum first — required on fresh DBs)
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'sendgrid';
ALTER TYPE integration_key ADD VALUE IF NOT EXISTS 'mapbox';

-- Inserts may need a later migration on some PG versions if enum was just added in this file;
-- 107 also upserts these rows safely.
INSERT INTO integrations (key, display_name, category, is_required) VALUES
  ('stripe', 'Stripe', 'payments', FALSE),
  ('whatsapp', 'WhatsApp (Twilio)', 'messaging', FALSE),
  ('sendgrid', 'SendGrid', 'messaging', FALSE),
  ('mapbox', 'Mapbox', 'maps_location', FALSE)
ON CONFLICT (key) DO NOTHING;
