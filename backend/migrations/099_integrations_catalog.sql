-- Ensure all third-party integrations exist for admin hub (API-key ready).
INSERT INTO integrations (key, display_name, category, is_required) VALUES
  ('stripe', 'Stripe', 'payments', FALSE),
  ('whatsapp', 'WhatsApp (Twilio)', 'messaging', FALSE),
  ('sendgrid', 'SendGrid', 'messaging', FALSE),
  ('mapbox', 'Mapbox', 'maps_location', FALSE)
ON CONFLICT (key) DO NOTHING;
