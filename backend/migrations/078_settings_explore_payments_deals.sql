-- 078: Settings prefs, explore merchants, payment instruments vault, customer deals

-- Extend user_settings for Settings mockup
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(8) DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ride_notifications BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS shopping_notifications BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS dvt_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS wallet_payment_enabled BOOLEAN DEFAULT FALSE;

UPDATE user_settings
SET currency_code = COALESCE(currency_code, 'NGN'),
    dark_mode = COALESCE(dark_mode, TRUE),
    location_enabled = COALESCE(location_enabled, TRUE),
    ride_notifications = COALESCE(ride_notifications, TRUE),
    shopping_notifications = COALESCE(shopping_notifications, TRUE),
    dvt_enabled = COALESCE(dvt_enabled, TRUE),
    wallet_payment_enabled = COALESCE(wallet_payment_enabled, FALSE);

INSERT INTO user_settings (user_id, language, region, currency_code, dark_mode)
SELECT id, 'English', 'Nigeria', 'NGN', TRUE
FROM users u
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND NOT EXISTS (SELECT 1 FROM user_settings s WHERE s.user_id = u.id)
LIMIT 50;

-- Soft-delete / account deletion request
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Enrich payment instruments for Payment Methods mockup
ALTER TABLE customer_payment_methods
  ADD COLUMN IF NOT EXISTS brand VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cardholder_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS expires_month INT,
  ADD COLUMN IF NOT EXISTS expires_year INT,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(128),
  ADD COLUMN IF NOT EXISTS network VARCHAR(32),
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Seed mockup payment methods for customer users (Visa default, MC, MoMo, MetaMask)
INSERT INTO customer_payment_methods (
  user_id, provider, method_type, label, last_four, is_default,
  brand, cardholder_name, expires_month, expires_year, phone_number,
  wallet_address, network, status, display_order
)
SELECT u.id, v.provider, v.method_type, v.label, v.last_four, v.is_default,
       v.brand, v.holder, v.exp_m, v.exp_y, v.phone, v.addr, v.network, v.status, v.ord
FROM users u
CROSS JOIN (VALUES
  ('Visa', 'card', 'Visa', '4821', TRUE, 'visa', 'Kwame Asante', 8, 2027, NULL, NULL, NULL, 'active', 1),
  ('Mastercard', 'card', 'Mastercard', '7732', FALSE, 'mastercard', 'Kwame Asante', 3, 2026, NULL, NULL, NULL, 'active', 2),
  ('MTN MoMo', 'momo', 'MTN MoMo', '5678', FALSE, 'momo', NULL, NULL, NULL, '+234 801 234 5678', NULL, NULL, 'active', 3),
  ('MetaMask', 'crypto', 'MetaMask', '9d2c', FALSE, 'metamask', NULL, NULL, NULL, NULL, '0x3a4F...9d2c', 'Polygon', 'active', 4)
) AS v(provider, method_type, label, last_four, is_default, brand, holder, exp_m, exp_y, phone, addr, network, status, ord)
WHERE COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
  AND NOT EXISTS (
    SELECT 1 FROM customer_payment_methods c
    WHERE c.user_id = u.id AND c.provider = 'Visa' AND c.last_four = '4821'
  )
LIMIT 40;

-- Explore merchant catalog (for Search Explore grid)
CREATE TABLE IF NOT EXISTS explore_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  emoji VARCHAR(16) DEFAULT '🏪',
  rating NUMERIC(3,2) DEFAULT 4.5,
  distance_km NUMERIC(6,2) DEFAULT 1.0,
  filter_tags TEXT[] DEFAULT ARRAY['shop'],
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO explore_merchants (id, name, category, emoji, rating, distance_km, filter_tags, sort_order) VALUES
  ('f0000000-0000-4000-8000-000000000001'::uuid, 'Chicken Republic', 'Fast Food', '🍔', 4.8, 1.2, ARRAY['shop','all'], 1),
  ('f0000000-0000-4000-8000-000000000002'::uuid, 'MedPlus', 'Pharmacy', '💊', 4.9, 0.8, ARRAY['shop','all'], 2),
  ('f0000000-0000-4000-8000-000000000003'::uuid, 'ShopRite', 'Grocery', '🛒', 4.5, 2.0, ARRAY['shop','all'], 3),
  ('f0000000-0000-4000-8000-000000000004'::uuid, 'Fashion Hub', 'Fashion', '👗', 4.6, 1.6, ARRAY['shop','all'], 4)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    emoji = EXCLUDED.emoji,
    rating = EXCLUDED.rating,
    distance_km = EXCLUDED.distance_km,
    is_active = TRUE;

-- Link Chicken Republic store if present
UPDATE explore_merchants em
SET store_id = s.id
FROM stores s
WHERE em.name = 'Chicken Republic'
  AND s.name ILIKE '%Chicken Republic%'
  AND em.store_id IS NULL;

-- Enrich promotions for customer Deals UI
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS title VARCHAR(128),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_auto_applied BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS icon_key VARCHAR(32),
  ADD COLUMN IF NOT EXISTS usage_limit_per_user INT;

UPDATE promotions SET
  title = '50% OFF',
  description = 'Your next 3 rides',
  category = 'rides',
  is_featured = TRUE,
  icon_key = 'ride',
  usage_limit_per_user = 3,
  ends_at = COALESCE(ends_at, TIMESTAMP '2026-04-15')
WHERE code = 'MOVR50';

UPDATE promotions SET
  title = '20% off Grocery Orders',
  description = 'Min order ₦2,000 · ShopRite',
  category = 'food',
  partner_name = 'ShopRite',
  icon_key = 'cart',
  ends_at = COALESCE(ends_at, TIMESTAMP '2026-04-20')
WHERE code = 'MOVRGRO20';

UPDATE promotions SET
  title = 'Double DVT Weekend',
  description = 'Earn 2x tokens on all rides',
  category = 'tokens',
  is_auto_applied = TRUE,
  icon_key = 'dvt',
  status = 'active'
WHERE code = 'DOUBLDVT';

INSERT INTO promotions (
  code, promo_type, discount_unit, discount_value, min_order_value, status,
  applies_to, title, description, category, icon_key, new_users_only, is_featured
) VALUES (
  'FREERENT1', 'rental_credit', 'fixed', 0, 0, 'active',
  'rentals', 'Free First Rental Day', 'New users only · Used', 'rides', 'car', TRUE, FALSE
)
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = 'rides',
    icon_key = 'car';

-- Per-user promo status
CREATE TABLE IF NOT EXISTS user_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'available', -- available | active | used | expired
  usage_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, promotion_id)
);

-- Mark Free First Rental as used for demo customers; Double DVT as active
INSERT INTO user_promotions (user_id, promotion_id, status, usage_count)
SELECT u.id, p.id,
  CASE WHEN p.code = 'FREERENT1' THEN 'used'
       WHEN p.code = 'DOUBLDVT' THEN 'active'
       ELSE 'available' END,
  CASE WHEN p.code = 'FREERENT1' THEN 1 ELSE 0 END
FROM users u
CROSS JOIN promotions p
WHERE p.code IN ('FREERENT1', 'DOUBLDVT', 'MOVR50', 'MOVRGRO20')
  AND COALESCE(u.user_type, 'customer') NOT IN ('driver','merchant','admin')
ON CONFLICT (user_id, promotion_id) DO NOTHING;
