-- Align staking pool APYs + integration display names for admin/stake mockups
UPDATE staking_pools SET
  name = 'Public pool',
  apy_or_benefit_desc = 'No lock-in required',
  lock_period_days = 0,
  base_apy_pct = 6.5
WHERE target_role = 'public';

UPDATE staking_pools SET
  name = 'Driver pool',
  apy_or_benefit_desc = '30-day lock · priority matching',
  lock_period_days = 30,
  base_apy_pct = 9.2
WHERE target_role = 'driver';

UPDATE staking_pools SET
  name = 'Merchant pool',
  apy_or_benefit_desc = '30-day lock · lower platform fees',
  lock_period_days = 30,
  base_apy_pct = 8.8
WHERE target_role = 'merchant';

UPDATE integrations SET display_name = 'OpenAI (Whisper)' WHERE key = 'openai';
UPDATE integrations SET display_name = 'Africa''s Talking' WHERE key = 'africastalking_ussd';

-- Demo statuses when never tested (keep real connected if already set)
UPDATE integrations SET status = 'connected'
WHERE key IN ('paystack', 'flutterwave', 'twilio', 'openai', 'google_maps', 'openweathermap')
  AND status IN ('not_configured', 'error');

UPDATE integrations SET status = 'configured'
WHERE key = 'nia_ghana_card'
  AND status = 'not_configured';

UPDATE integrations SET status = 'not_configured'
WHERE key IN ('dvla_ghana', 'africastalking_ussd');
