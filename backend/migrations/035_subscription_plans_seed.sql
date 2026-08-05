-- Seed driver subscription plans (Phase 14)
INSERT INTO plans (id, name, features, amount, currency) VALUES
  ('weekly_driver', 'Weekly Driver', '["Priority matching","Support"]'::jsonb, 60, 'GHS'),
  ('pro_driver', 'Pro Driver', '["Priority matching","Lower fees"]'::jsonb, 120, 'GHS')
ON CONFLICT (id) DO NOTHING;

-- Ensure stake_created is available for rewards engine (Phase 16)
UPDATE rewards_rules SET active = TRUE
WHERE event_type = 'stake_created';
