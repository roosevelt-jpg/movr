INSERT INTO integrations (key, display_name, category, is_required) VALUES
  ('firebase_auth', 'Firebase Authentication', 'identity_verification', FALSE)
ON CONFLICT (key) DO NOTHING;
