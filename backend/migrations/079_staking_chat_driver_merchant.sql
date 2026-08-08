-- 079: Staking dashboard pools, ride chat UX, driver earnings activity, merchant order board

-- Align pool APYs / copy to Staking mockup (Flexible 8.5%, 30-day 14.5%, 90-day 24%)
ALTER TABLE staking_pools
  ADD COLUMN IF NOT EXISTS icon_key VARCHAR(32) DEFAULT 'lock';

UPDATE staking_pools SET
  display_name = 'Flexible Pool',
  tagline = 'No lock · Withdraw anytime',
  base_apy_pct = 8.5,
  min_stake = COALESCE(NULLIF(min_stake, 0), 50),
  min_amount = COALESCE(NULLIF(min_amount, 0), 50),
  icon_key = 'sprout',
  is_popular = FALSE
WHERE name ILIKE '%flex%' OR COALESCE(lock_period_days, 0) = 0;

UPDATE staking_pools SET
  display_name = '30-Day Lock',
  tagline = 'Min 100 DVT · Best balance',
  base_apy_pct = 14.5,
  min_stake = 100,
  min_amount = 100,
  icon_key = 'bolt',
  is_popular = TRUE
WHERE name ILIKE '%30%' OR COALESCE(lock_period_days, 0) BETWEEN 25 AND 45;

UPDATE staking_pools SET
  display_name = '90-Day Lock',
  tagline = 'Min 500 DVT · High rewards',
  base_apy_pct = 24,
  min_stake = 500,
  min_amount = 500,
  icon_key = 'lock',
  is_popular = FALSE
WHERE name ILIKE '%90%' OR COALESCE(lock_period_days, 0) >= 80;

INSERT INTO staking_pools (name, display_name, tagline, target_role, apy_or_benefit_desc, min_amount, lock_period_days, base_apy_pct, min_stake, is_popular, active, icon_key)
SELECT v.name, v.display_name, v.tagline, 'public', v.tagline, v.min_stake, v.lock_days, v.apy, v.min_stake, v.popular, true, v.icon
FROM (VALUES
  ('flexible', 'Flexible Pool', 'No lock · Withdraw anytime', 0, 8.5::numeric, 50::numeric, false, 'sprout'),
  ('30-day-lock', '30-Day Lock', 'Min 100 DVT · Best balance', 30, 14.5::numeric, 100::numeric, true, 'bolt'),
  ('90-day-lock', '90-Day Lock', 'Min 500 DVT · High rewards', 90, 24::numeric, 500::numeric, false, 'lock')
) AS v(name, display_name, tagline, lock_days, apy, min_stake, popular, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM staking_pools p WHERE p.name = v.name OR COALESCE(p.display_name,'') = v.display_name
);

-- Seed a demo active stake in 30-day pool for customers without stakes
INSERT INTO stakes (user_id, pool_id, amount, status, rewards_earned, unlock_at)
SELECT u.id, p.id, 500, 'active', 72.5, NOW() + INTERVAL '20 days'
FROM users u
CROSS JOIN LATERAL (
  SELECT id FROM staking_pools
  WHERE COALESCE(lock_period_days, 0) BETWEEN 25 AND 45 AND COALESCE(active, true) = TRUE
  LIMIT 1
) p
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND NOT EXISTS (SELECT 1 FROM stakes s WHERE s.user_id = u.id AND COALESCE(s.status,'active') = 'active')
LIMIT 15;

-- Ride chat enrichment
ALTER TABLE ride_messages
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ride_chat_quick_replies (
  id SERIAL PRIMARY KEY,
  label VARCHAR(64) NOT NULL,
  body VARCHAR(160) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO ride_chat_quick_replies (label, body, sort_order)
SELECT v.label, v.body, v.sort_order
FROM (VALUES
  ('👍 OK', '👍 OK', 1),
  ('I am ready', 'I am ready', 2),
  ('Wait 2 mins', 'Wait 2 mins', 3)
) AS v(label, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM ride_chat_quick_replies LIMIT 1);

-- Driver earnings activity feed
CREATE TABLE IF NOT EXISTS driver_earnings_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(32) NOT NULL DEFAULT 'ride', -- ride | delivery
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INT DEFAULT 0,
  dvt_earned NUMERIC(14,4) DEFAULT 0,
  fiat_earned NUMERIC(14,2) DEFAULT 0,
  currency_code VARCHAR(8) DEFAULT 'NGN',
  ref_id UUID
);

CREATE INDEX IF NOT EXISTS idx_driver_earn_act ON driver_earnings_activity(driver_id, occurred_at DESC);

INSERT INTO driver_earnings_activity (driver_id, activity_type, occurred_at, duration_minutes, dvt_earned, fiat_earned)
SELECT u.id, v.atype, date_trunc('day', NOW()) + (v.mins || ' minutes')::interval, v.dur, v.dvt, v.fiat
FROM users u
CROSS JOIN (VALUES
  ('ride', 9 * 60 + 12, 18, 60, 1200),
  ('ride', 10 * 60 + 45, 42, 120, 2800),
  ('delivery', 12 * 60 + 10, 25, 40, 900)
) AS v(atype, mins, dur, dvt, fiat)
WHERE COALESCE(u.user_type, 'customer') = 'driver'
  AND NOT EXISTS (SELECT 1 FROM driver_earnings_activity a WHERE a.driver_id = u.id)
LIMIT 30;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS hours_online_today NUMERIC(8,2) DEFAULT 0;

-- Merchant board: ensure customer display on orders
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS customer_display_name VARCHAR(128);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketplace_orders' AND column_name = 'customer_id'
  ) THEN
    UPDATE marketplace_orders o
    SET customer_display_name = COALESCE(
      NULLIF(o.customer_display_name, ''),
      NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', LEFT(COALESCE(u.last_name,''), 1), '.')), ' .'),
      'Customer'
    )
    FROM users u
    WHERE u.id = o.customer_id
      AND (o.customer_display_name IS NULL OR o.customer_display_name = '');
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketplace_orders' AND column_name = 'user_id'
  ) THEN
    UPDATE marketplace_orders o
    SET customer_display_name = COALESCE(
      NULLIF(o.customer_display_name, ''),
      NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', LEFT(COALESCE(u.last_name,''), 1), '.')), ' .'),
      'Customer'
    )
    FROM users u
    WHERE u.id = o.user_id
      AND (o.customer_display_name IS NULL OR o.customer_display_name = '');
  END IF;
END $$;