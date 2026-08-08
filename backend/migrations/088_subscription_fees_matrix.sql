-- 088: Platform subscription fees matrix (drivers / bikes / rentals / merchants)
-- Intelligent assignment by vehicle category, country, city; admin-configurable plans + rules.

INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order)
VALUES ('Bicycle', 'bicycle', 'bicycle', 0, 0)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS audience VARCHAR(32) DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(32),
  ADD COLUMN IF NOT EXISTS vehicle_type_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(8),
  ADD COLUMN IF NOT EXISTS city VARCHAR(128),
  ADD COLUMN IF NOT EXISTS size_tier VARCHAR(16),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_plans_audience ON plans (audience);
CREATE INDEX IF NOT EXISTS idx_plans_geo ON plans (audience, country_code, vehicle_category);

-- Rule engine: match specificity → plan (higher priority wins, then more specific dims)
CREATE TABLE IF NOT EXISTS subscription_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience VARCHAR(32) NOT NULL,
  vehicle_category VARCHAR(32),
  vehicle_type_code VARCHAR(32),
  country_code VARCHAR(8),
  city VARCHAR(128),
  interval VARCHAR(16) NOT NULL DEFAULT 'monthly',
  plan_id VARCHAR(64) NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  amount_override NUMERIC(12,2),
  currency_override VARCHAR(8),
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  label VARCHAR(128),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_fee_rules_lookup
  ON subscription_fee_rules (audience, is_active, priority DESC);

-- Mark existing driver plans
UPDATE plans
SET audience = 'driver',
    is_active = TRUE,
    country_code = COALESCE(country_code, 'NG')
WHERE id IN ('weekly_driver', 'monthly_driver');

UPDATE plans
SET audience = COALESCE(audience, 'driver')
WHERE audience IS NULL;

-- ── Driver monthly by vehicle size (NG) ─────────────────────────────────────
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, headline, subtitle, sort_order, is_active, description
) VALUES
  ('drv_ng_bike_m', 'Driver · Bicycle · Monthly', '["0% commission","Delivery listing","Unlimited trips"]'::jsonb,
   1500, 'NGN', 'monthly', 'driver', 'bicycle', 'xs', 'NG', 'Bicycle', 'Smallest footprint', 10, TRUE,
   'Monthly subscription for bicycle couriers — keep 100% of delivery fees'),
  ('drv_ng_moto_m', 'Driver · Motorcycle · Monthly', '["0% commission","Unlimited trips","DVT rewards"]'::jsonb,
   3500, 'NGN', 'monthly', 'driver', 'motorcycle', 's', 'NG', 'Motorcycle', 'Compact · high volume', 11, TRUE,
   'Monthly fee scales with motorcycle size'),
  ('drv_ng_tri_m', 'Driver · Tricycle · Monthly', '["0% commission","Unlimited trips","DVT rewards"]'::jsonb,
   4500, 'NGN', 'monthly', 'driver', 'tricycle', 'm', 'NG', 'Tricycle', 'City cargo / passenger', 12, TRUE, NULL),
  ('drv_ng_sedan_m', 'Driver · Sedan · Monthly', '["0% commission","Priority matching","2x DVT"]'::jsonb,
   7000, 'NGN', 'monthly', 'driver', 'sedan', 'm', 'NG', 'Sedan', 'Most popular', 13, TRUE, NULL),
  ('drv_ng_suv_m', 'Driver · SUV · Monthly', '["0% commission","Priority matching","2x DVT"]'::jsonb,
   9000, 'NGN', 'monthly', 'driver', 'suv', 'l', 'NG', 'SUV', 'Larger vehicle premium', 14, TRUE, NULL),
  ('drv_ng_van_m', 'Driver · Van · Monthly', '["0% commission","Priority matching","Cargo ready"]'::jsonb,
   10000, 'NGN', 'monthly', 'driver', 'van', 'l', 'NG', 'Van', 'High capacity', 15, TRUE, NULL),
  ('drv_ng_lux_m', 'Driver · Luxury · Monthly', '["0% commission","VIP matching","3x DVT","Gold badge"]'::jsonb,
   15000, 'NGN', 'monthly', 'driver', 'luxury', 'xl', 'NG', 'Luxury', 'Premium fleet', 16, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  audience = EXCLUDED.audience,
  vehicle_category = EXCLUDED.vehicle_category,
  size_tier = EXCLUDED.size_tier,
  country_code = EXCLUDED.country_code,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

-- Ghana driver monthly (GHS)
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, headline, subtitle, sort_order, is_active
) VALUES
  ('drv_gh_moto_m', 'Driver · Motorcycle · Monthly', '["0% commission","Unlimited trips"]'::jsonb,
   80, 'GHS', 'monthly', 'driver', 'motorcycle', 's', 'GH', 'Motorcycle', 'GH pricing', 20, TRUE),
  ('drv_gh_sedan_m', 'Driver · Sedan · Monthly', '["0% commission","Priority matching"]'::jsonb,
   150, 'GHS', 'monthly', 'driver', 'sedan', 'm', 'GH', 'Sedan', 'GH pricing', 21, TRUE),
  ('drv_gh_suv_m', 'Driver · SUV · Monthly', '["0% commission","Priority matching"]'::jsonb,
   200, 'GHS', 'monthly', 'driver', 'suv', 'l', 'GH', 'SUV', 'GH pricing', 22, TRUE),
  ('drv_gh_lux_m', 'Driver · Luxury · Monthly', '["0% commission","VIP matching"]'::jsonb,
   320, 'GHS', 'monthly', 'driver', 'luxury', 'xl', 'GH', 'Luxury', 'GH pricing', 23, TRUE)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount, currency = EXCLUDED.currency, is_active = TRUE;

-- Align legacy monthly_driver with sedan NG default
UPDATE plans
SET amount = 7000, currency = 'NGN', audience = 'driver', vehicle_category = 'sedan',
    size_tier = 'm', country_code = 'NG', is_active = TRUE
WHERE id = 'monthly_driver';

-- ── Bicycle delivery listing (courier who lists bike for delivery) ───────────
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, headline, subtitle, sort_order, is_active, description
) VALUES
  ('bike_list_ng_m', 'Bike listing · Monthly', '["Appear in delivery map","Unlimited jobs","Keep 100% of delivery fees"]'::jsonb,
   1200, 'NGN', 'monthly', 'bike_listing', 'bicycle', 'xs', 'NG', 'Bicycle listing', 'Delivery network access', 30, TRUE,
   'Recurring fee to list a bicycle for platform deliveries'),
  ('bike_list_gh_m', 'Bike listing · Monthly', '["Appear in delivery map","Unlimited jobs"]'::jsonb,
   35, 'GHS', 'monthly', 'bike_listing', 'bicycle', 'xs', 'GH', 'Bicycle listing', 'Delivery network access', 31, TRUE, NULL),
  ('bike_list_moto_ng_m', 'Moto courier listing · Monthly', '["Delivery + parcel jobs","Keep 100% of fees"]'::jsonb,
   2000, 'NGN', 'monthly', 'bike_listing', 'motorcycle', 's', 'NG', 'Motorcycle listing', 'Delivery network', 32, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, is_active = TRUE, audience = EXCLUDED.audience;

-- ── Car rental owners (by vehicle class) ────────────────────────────────────
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, headline, subtitle, sort_order, is_active, description
) VALUES
  ('rent_ng_sedan_m', 'Rental owner · Economy', '["List sedan/hatchback","Calendar sync","Payouts"]'::jsonb,
   8000, 'NGN', 'monthly', 'rental_owner', 'sedan', 'm', 'NG', 'Economy / Sedan', 'Owner listing fee', 40, TRUE,
   'Monthly subscription for rental fleet owners — sedan class'),
  ('rent_ng_suv_m', 'Rental owner · SUV', '["List SUV/crossover","Calendar sync","Payouts"]'::jsonb,
   12000, 'NGN', 'monthly', 'rental_owner', 'suv', 'l', 'NG', 'SUV', 'Owner listing fee', 41, TRUE, NULL),
  ('rent_ng_lux_m', 'Rental owner · Luxury', '["List luxury cars","Priority placement","Payouts"]'::jsonb,
   20000, 'NGN', 'monthly', 'rental_owner', 'luxury', 'xl', 'NG', 'Luxury', 'Owner listing fee', 42, TRUE, NULL),
  ('rent_ng_van_m', 'Rental owner · Van', '["List vans","Calendar sync","Payouts"]'::jsonb,
   14000, 'NGN', 'monthly', 'rental_owner', 'van', 'l', 'NG', 'Van', 'Owner listing fee', 43, TRUE, NULL),
  ('rent_gh_sedan_m', 'Rental owner · Economy', '["List sedan","Payouts"]'::jsonb,
   180, 'GHS', 'monthly', 'rental_owner', 'sedan', 'm', 'GH', 'Economy / Sedan', 'Owner listing fee', 44, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, is_active = TRUE, audience = EXCLUDED.audience;

-- ── Merchant store subscription (recurring) ─────────────────────────────────
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, headline, subtitle, sort_order, is_active, description
) VALUES
  ('merch_ng_store_m', 'Merchant store · Monthly', '["Keep store live","Orders + delivery","Analytics"]'::jsonb,
   5000, 'NGN', 'monthly', 'merchant', NULL, NULL, 'NG', 'Store subscription', 'Recurring platform access', 50, TRUE,
   'Monthly fee to maintain an active storefront on MOVR'),
  ('merch_gh_store_m', 'Merchant store · Monthly', '["Keep store live","Orders + delivery"]'::jsonb,
   120, 'GHS', 'monthly', 'merchant', NULL, NULL, 'GH', 'Store subscription', 'Recurring platform access', 51, TRUE, NULL),
  ('merch_ng_store_w', 'Merchant store · Weekly', '["Keep store live","Flexible billing"]'::jsonb,
   1500, 'NGN', 'weekly', 'merchant', NULL, NULL, 'NG', 'Store · Weekly', 'Try before monthly', 52, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, is_active = TRUE, audience = EXCLUDED.audience;

-- ── Intelligent rules (specificity via priority) ────────────────────────────
INSERT INTO subscription_fee_rules (
  audience, vehicle_category, country_code, interval, plan_id, priority, label, is_active
)
SELECT v.audience, v.vehicle_category, v.country_code, 'monthly', v.plan_id, v.priority, v.label, TRUE
FROM (VALUES
  -- Drivers NG
  ('driver', 'bicycle', 'NG', 'drv_ng_bike_m', 200, 'NG bicycle driver'),
  ('driver', 'motorcycle', 'NG', 'drv_ng_moto_m', 200, 'NG motorcycle driver'),
  ('driver', 'tricycle', 'NG', 'drv_ng_tri_m', 200, 'NG tricycle driver'),
  ('driver', 'sedan', 'NG', 'drv_ng_sedan_m', 200, 'NG sedan driver'),
  ('driver', 'suv', 'NG', 'drv_ng_suv_m', 200, 'NG SUV driver'),
  ('driver', 'van', 'NG', 'drv_ng_van_m', 200, 'NG van driver'),
  ('driver', 'luxury', 'NG', 'drv_ng_lux_m', 200, 'NG luxury driver'),
  -- Drivers GH
  ('driver', 'motorcycle', 'GH', 'drv_gh_moto_m', 200, 'GH motorcycle driver'),
  ('driver', 'sedan', 'GH', 'drv_gh_sedan_m', 200, 'GH sedan driver'),
  ('driver', 'suv', 'GH', 'drv_gh_suv_m', 200, 'GH SUV driver'),
  ('driver', 'luxury', 'GH', 'drv_gh_lux_m', 200, 'GH luxury driver'),
  -- Fallbacks (any vehicle in country)
  ('driver', NULL, 'NG', 'monthly_driver', 50, 'NG driver default monthly'),
  ('driver', NULL, 'GH', 'drv_gh_sedan_m', 50, 'GH driver default monthly'),
  -- Bike listing
  ('bike_listing', 'bicycle', 'NG', 'bike_list_ng_m', 200, 'NG bike listing'),
  ('bike_listing', 'bicycle', 'GH', 'bike_list_gh_m', 200, 'GH bike listing'),
  ('bike_listing', 'motorcycle', 'NG', 'bike_list_moto_ng_m', 200, 'NG moto courier listing'),
  ('bike_listing', NULL, 'NG', 'bike_list_ng_m', 40, 'NG bike listing default'),
  -- Rental owners
  ('rental_owner', 'sedan', 'NG', 'rent_ng_sedan_m', 200, 'NG rental sedan'),
  ('rental_owner', 'suv', 'NG', 'rent_ng_suv_m', 200, 'NG rental SUV'),
  ('rental_owner', 'luxury', 'NG', 'rent_ng_lux_m', 200, 'NG rental luxury'),
  ('rental_owner', 'van', 'NG', 'rent_ng_van_m', 200, 'NG rental van'),
  ('rental_owner', 'sedan', 'GH', 'rent_gh_sedan_m', 200, 'GH rental sedan'),
  ('rental_owner', NULL, 'NG', 'rent_ng_sedan_m', 40, 'NG rental default'),
  -- Merchants
  ('merchant', NULL, 'NG', 'merch_ng_store_m', 100, 'NG merchant store'),
  ('merchant', NULL, 'GH', 'merch_gh_store_m', 100, 'GH merchant store')
) AS v(audience, vehicle_category, country_code, plan_id, priority, label)
WHERE EXISTS (SELECT 1 FROM plans p WHERE p.id = v.plan_id)
  AND NOT EXISTS (
    SELECT 1 FROM subscription_fee_rules r
    WHERE r.audience = v.audience
      AND r.plan_id = v.plan_id
      AND COALESCE(r.vehicle_category, '') = COALESCE(v.vehicle_category, '')
      AND COALESCE(r.country_code, '') = COALESCE(v.country_code, '')
      AND r.interval = 'monthly'
  );

-- Lagos city premium example (intelligent location bump via dedicated plan + rule)
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, city, headline, subtitle, sort_order, is_active, description
) VALUES (
  'drv_ng_sedan_lagos_m', 'Driver · Sedan · Lagos · Monthly',
  '["0% commission","Lagos priority matching","2x DVT"]'::jsonb,
  8500, 'NGN', 'monthly', 'driver', 'sedan', 'm', 'NG', 'Lagos',
  'Sedan · Lagos', 'City premium', 17, TRUE,
  'Location-aware fee — Lagos sedan drivers'
)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, city = EXCLUDED.city, is_active = TRUE;

INSERT INTO subscription_fee_rules (
  audience, vehicle_category, country_code, city, interval, plan_id, priority, label, is_active
)
SELECT 'driver', 'sedan', 'NG', 'Lagos', 'monthly', 'drv_ng_sedan_lagos_m', 300, 'Lagos sedan premium', TRUE
WHERE EXISTS (SELECT 1 FROM plans WHERE id = 'drv_ng_sedan_lagos_m')
  AND NOT EXISTS (
    SELECT 1 FROM subscription_fee_rules
    WHERE plan_id = 'drv_ng_sedan_lagos_m' AND city = 'Lagos'
  );

-- Platform settings hint for admin
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'subscription_fees',
  '{"model":"flat_subscription_not_commission","audiences":["driver","bike_listing","rental_owner","merchant"],"resolver":"subscription_fee_rules","note":"Drivers keep 100% of fare; MOVR bills recurring subscriptions by vehicle size, country, and city."}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
