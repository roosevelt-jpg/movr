-- 077: Rewards hub / leaderboard, safety center, activity feed, refer & earn promo

-- Align earn rates to Rewards mockup (+10 ride, +5 shop, +8 deliver, +50 referral)
UPDATE rewards_rules SET points_amount = 10, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'ride_completed';
UPDATE rewards_rules SET points_amount = 5, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'order_completed';
UPDATE rewards_rules SET points_amount = 8, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'delivery_completed';
UPDATE rewards_rules SET points_amount = 50, dvt_amount = 0, active = TRUE, updated_at = NOW()
WHERE event_type = 'referral_qualified';

INSERT INTO rewards_rules (event_type, points_amount, dvt_amount, active) VALUES
  ('ride_completed', 10, 0, TRUE),
  ('order_completed', 5, 0, TRUE),
  ('delivery_completed', 8, 0, TRUE),
  ('referral_qualified', 50, 0, TRUE)
ON CONFLICT (event_type) DO UPDATE
SET points_amount = EXCLUDED.points_amount,
    dvt_amount = 0,
    active = TRUE,
    updated_at = NOW();

-- Display catalog for Earn Points grid
CREATE TABLE IF NOT EXISTS rewards_earn_catalog (
  id VARCHAR(32) PRIMARY KEY,
  label VARCHAR(64) NOT NULL,
  subtitle VARCHAR(120) NOT NULL,
  icon_key VARCHAR(32) NOT NULL,
  event_type VARCHAR(64),
  points_amount INT NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO rewards_earn_catalog (id, label, subtitle, icon_key, event_type, points_amount, sort_order) VALUES
  ('ride', 'Ride', '+10 pts per ride', 'car', 'ride_completed', 10, 1),
  ('shop', 'Shop', '+5 pts per order', 'bag', 'order_completed', 5, 2),
  ('refer', 'Refer Friends', '+50 pts per referral', 'people', 'referral_qualified', 50, 3),
  ('deliver', 'Deliver', '+8 pts per parcel', 'box', 'delivery_completed', 8, 4)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    subtitle = EXCLUDED.subtitle,
    points_amount = EXCLUDED.points_amount,
    is_active = TRUE;

-- Ensure loyalty tiers match Gold(500) / Platinum(1000)
INSERT INTO loyalty_thresholds (tier, min_points, sort_order) VALUES
  ('bronze', 0, 1),
  ('silver', 200, 2),
  ('gold', 500, 3),
  ('platinum', 1000, 4)
ON CONFLICT (tier) DO UPDATE SET min_points = EXCLUDED.min_points, sort_order = EXCLUDED.sort_order;

-- Refer & Earn promo: Give ₦500, Get 50 pts
ALTER TABLE referral_reward_config
  ADD COLUMN IF NOT EXISTS give_fiat_amount NUMERIC(12,2) DEFAULT 500,
  ADD COLUMN IF NOT EXISTS give_currency VARCHAR(8) DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS headline VARCHAR(120),
  ADD COLUMN IF NOT EXISTS body TEXT;

UPDATE referral_reward_config
SET points_amount = 50,
    give_fiat_amount = 500,
    give_currency = 'NGN',
    headline = 'Give ₦500, Get 50 pts',
    body = 'Share your code. When a friend completes their first ride, you both win.',
    reward_type = 'points',
    updated_at = NOW()
WHERE id = 1;

INSERT INTO referral_reward_config (id, reward_type, points_amount, dvt_amount, give_fiat_amount, give_currency, headline, body)
VALUES (1, 'points', 50, 0, 500, 'NGN', 'Give ₦500, Get 50 pts',
        'Share your code. When a friend completes their first ride, you both win.')
ON CONFLICT (id) DO NOTHING;

-- Safety center config + audio recordings
CREATE TABLE IF NOT EXISTS safety_center_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_emergency VARCHAR(16) NOT NULL DEFAULT '199',
  secondary_emergency VARCHAR(16) NOT NULL DEFAULT '112',
  sos_hold_seconds INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO safety_center_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS safety_audio_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ride_id UUID,
  cloud_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'recording',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_safety_audio_user ON safety_audio_recordings(user_id, started_at DESC);

ALTER TABLE emergency_contacts
  ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT TRUE;

-- Seed a few trusted contacts for demo riders if none exist
INSERT INTO emergency_contacts (user_id, user_type, contact_name, phone_number, relationship, is_primary, is_trusted)
SELECT u.id, 'customer', v.name, v.phone, v.rel, v.prim, TRUE
FROM users u
CROSS JOIN (VALUES
  ('Ada Okonkwo', '+2348010000001', 'Sister', TRUE),
  ('Tunde Bakare', '+2348010000002', 'Friend', FALSE),
  ('Funke Adeyemi', '+2348010000003', 'Partner', FALSE)
) AS v(name, phone, rel, prim)
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND NOT EXISTS (SELECT 1 FROM emergency_contacts ec WHERE ec.user_id = u.id)
LIMIT 9;

-- Lightweight activity feed materialization (optional cache; API can also live-aggregate)
CREATE TABLE IF NOT EXISTS user_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(32) NOT NULL, -- ride | parcel | order | rental
  ref_id UUID,
  title VARCHAR(160),
  subtitle VARCHAR(240),
  pickup_label TEXT,
  dropoff_label TEXT,
  dvt_earned NUMERIC(14,4) DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_activity_feed_user
  ON user_activity_feed(user_id, occurred_at DESC);

-- Seed demo activity rows for empty feeds
INSERT INTO user_activity_feed (user_id, activity_type, title, pickup_label, dropoff_label, dvt_earned, occurred_at, metadata)
SELECT u.id, v.atype, v.title, v.pickup, v.dropoff, v.dvt, NOW() - (v.mins || ' minutes')::interval, v.meta::jsonb
FROM users u
CROSS JOIN (VALUES
  ('ride', 'Ride', 'Victoria Island, Lagos', 'Lekki Phase 1, Lagos', 120, 180,
   '{"actions":["receipt","rebook","rate"]}'),
  ('parcel', 'Parcel', '24 Admiralty Way, Lekki', 'Marina Square, Lagos Island', 80, 1440, '{}'),
  ('rental', 'Rental', NULL, NULL, 200, 7200, '{"duration":"1 day"}'),
  ('order', 'Order', NULL, NULL, 50, 8640, '{}')
) AS v(atype, title, pickup, dropoff, dvt, mins, meta)
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND NOT EXISTS (SELECT 1 FROM user_activity_feed f WHERE f.user_id = u.id)
LIMIT 20;
