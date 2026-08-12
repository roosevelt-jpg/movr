-- 107: Insert Play / messaging integrations (enum values from 106)
INSERT INTO integrations (key, display_name, category, is_required) VALUES
  ('firebase_fcm', 'Firebase Cloud Messaging', 'infrastructure', FALSE),
  ('expo_push', 'Expo Push Notifications', 'infrastructure', FALSE),
  ('google_play', 'Google Play Developer', 'infrastructure', FALSE),
  ('whatsapp', 'WhatsApp (Twilio)', 'messaging', FALSE),
  ('sendgrid', 'SendGrid', 'messaging', FALSE),
  ('mapbox', 'Mapbox', 'maps_location', FALSE),
  ('stripe', 'Stripe', 'payments', FALSE)
ON CONFLICT (key) DO NOTHING;
