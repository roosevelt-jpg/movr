-- 076: Rentals fleet, notifications categories, DVT claim breakdown, top-up methods

-- Rental vehicle inventory
CREATE TABLE IF NOT EXISTS rental_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make VARCHAR(64) NOT NULL,
  model VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'Economy',
  seats INT NOT NULL DEFAULT 5,
  transmission VARCHAR(16) NOT NULL DEFAULT 'Auto',
  daily_rate NUMERIC(12,2) NOT NULL,
  chauffeur_daily_rate NUMERIC(12,2),
  currency_code VARCHAR(8) NOT NULL DEFAULT 'NGN',
  rating NUMERIC(3,2) DEFAULT 4.8,
  is_popular BOOLEAN DEFAULT false,
  availability_status VARCHAR(32) NOT NULL DEFAULT 'available',
  emoji VARCHAR(16) DEFAULT '🚗',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rental_vehicles (id, make, model, category, seats, transmission, daily_rate, chauffeur_daily_rate, rating, is_popular, emoji)
VALUES
  ('e0000000-0000-4000-8000-000000000001'::uuid, 'Toyota', 'Corolla', 'Economy', 5, 'Auto', 25000, 35000, 4.8, false, '🚗'),
  ('e0000000-0000-4000-8000-000000000002'::uuid, 'Honda', 'CR-V', 'SUV', 5, 'Auto', 45000, 60000, 4.9, true, '🚙'),
  ('e0000000-0000-4000-8000-000000000003'::uuid, 'BMW', '3 Series', 'Luxury', 5, 'Auto', 85000, 110000, 4.9, false, '🚘')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rental_vehicle_id UUID REFERENCES rental_vehicles(id);

-- Enrich user_notifications for filter chips
ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS icon_key VARCHAR(32),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Seed richer notifications if table nearly empty for demo users
INSERT INTO user_notifications (user_id, title, body, is_read, category, icon_key, created_at)
SELECT u.id, v.title, v.body, v.is_read, v.category, v.icon_key, NOW() - (v.mins || ' minutes')::interval
FROM users u
CROSS JOIN (VALUES
  ('240 DVT tokens earned!', 'Your ride to Lekki earned you 240 DVT. Claim now.', false, 'tokens', 'dvt', 2),
  ('Your order is on its way!', 'Tunde is headed to you. ~8 min arrival.', false, 'orders', 'order', 18),
  ('Ride completed', 'You paid ₦1,200 for your ride to Victoria Island.', true, 'rides', 'ride', 120),
  ('New promo available', 'Get 20% off your first Grocery order. MOVRGRO20', true, 'promo', 'promo', 1440),
  ('Rate your last order', 'How was your ShopRite delivery?', true, 'orders', 'rating', 2880)
) AS v(title, body, is_read, category, icon_key, mins)
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND (SELECT COUNT(*) FROM user_notifications un WHERE un.user_id = u.id) < 3
LIMIT 25;

-- DVT claim earnings breakdown
CREATE TABLE IF NOT EXISTS dvt_claim_breakdown (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  from_rides NUMERIC(18,4) NOT NULL DEFAULT 0,
  from_orders NUMERIC(18,4) NOT NULL DEFAULT 0,
  from_referral NUMERIC(18,4) NOT NULL DEFAULT 0,
  wallet_address VARCHAR(128),
  merkle_proof_valid BOOLEAN DEFAULT true,
  network VARCHAR(32) DEFAULT 'Polygon',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Top-up payment method catalog
CREATE TABLE IF NOT EXISTS wallet_topup_methods (
  id VARCHAR(32) PRIMARY KEY,
  label VARCHAR(64) NOT NULL,
  subtitle VARCHAR(120),
  icon_key VARCHAR(32),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO wallet_topup_methods (id, label, subtitle, icon_key, sort_order) VALUES
  ('card', 'Debit/Credit Card', 'Visa, Mastercard', 'card', 1),
  ('momo', 'Mobile Money', 'MTN MoMo, Airtel', 'phone', 2),
  ('crypto', 'Crypto / DVT', 'Polygon, BSC', 'chain', 3)
ON CONFLICT (id) DO NOTHING;
