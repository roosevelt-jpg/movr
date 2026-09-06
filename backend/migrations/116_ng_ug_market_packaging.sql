-- 116: Nigeria + Uganda market packaging after global platform exits
-- Corridors, UG subscription fees, payment provider, CMS positioning.

-- Kampala corridors (UG)
INSERT INTO mobility_corridors (
  name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
  radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
)
SELECT
  'City centre · Kampala corridor',
  'Kampala',
  'UG',
  0.3476,
  32.5825,
  0.3136,
  32.5811,
  3.5,
  15000,
  16000,
  'KCCA-CORE-01',
  ARRAY['okada','keke','shared','economy','standard','motorcycle']
WHERE NOT EXISTS (SELECT 1 FROM mobility_corridors WHERE municipal_code = 'KCCA-CORE-01');

INSERT INTO mobility_corridors (
  name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
  radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
)
SELECT
  'Airport link · Entebbe–Kampala',
  'Kampala',
  'UG',
  0.0423,
  32.4435,
  0.3476,
  32.5825,
  8,
  80000,
  85000,
  'KCCA-EBB-01',
  ARRAY['economy','standard','suv','shared']
WHERE NOT EXISTS (SELECT 1 FROM mobility_corridors WHERE municipal_code = 'KCCA-EBB-01');

-- Extra Lagos corridors (NG demand after global exit)
INSERT INTO mobility_corridors (
  name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
  radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
)
SELECT
  'Island–Mainland · Lagos corridor',
  'Lagos',
  'NG',
  6.4281,
  3.4219,
  6.6018,
  3.3515,
  6,
  4500,
  5000,
  'LASG-BRIDGE-01',
  ARRAY['okada','keke','shared','economy','standard']
WHERE NOT EXISTS (SELECT 1 FROM mobility_corridors WHERE municipal_code = 'LASG-BRIDGE-01');

INSERT INTO mobility_corridors (
  name, city, country_code, origin_lat, origin_lng, dest_lat, dest_lng,
  radius_km, max_rider_fare, driver_min_payout, municipal_code, vehicle_codes
)
SELECT
  'Airport · MMIA–Lekki corridor',
  'Lagos',
  'NG',
  6.5774,
  3.3212,
  6.4474,
  3.4721,
  8,
  8000,
  9000,
  'LASG-MMIA-01',
  ARRAY['economy','standard','suv','shared']
WHERE NOT EXISTS (SELECT 1 FROM mobility_corridors WHERE municipal_code = 'LASG-MMIA-01');

-- Uganda driver + merchant plans (UGX)
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, vehicle_category, size_tier,
  country_code, headline, subtitle, sort_order, is_active, description
) VALUES
  ('drv_ug_moto_m', 'Driver · Motorcycle · Monthly', '["0% commission","Unlimited trips","Keep 100%"]'::jsonb,
   35000, 'UGX', 'monthly', 'driver', 'motorcycle', 's', 'UG', 'Motorcycle', 'Kampala · high volume', 50, TRUE,
   'Uganda motorcycle — keep 100% of every fare'),
  ('drv_ug_sedan_m', 'Driver · Sedan · Monthly', '["0% commission","Priority matching","Keep 100%"]'::jsonb,
   70000, 'UGX', 'monthly', 'driver', 'sedan', 'm', 'UG', 'Sedan', 'Most popular', 51, TRUE, NULL),
  ('drv_ug_suv_m', 'Driver · SUV · Monthly', '["0% commission","Priority matching","Keep 100%"]'::jsonb,
   95000, 'UGX', 'monthly', 'driver', 'suv', 'l', 'UG', 'SUV', 'Larger vehicle', 52, TRUE, NULL),
  ('merch_ug_store_m', 'Merchant · Store · Monthly', '["Storefront","Orders","Payouts"]'::jsonb,
   50000, 'UGX', 'monthly', 'merchant', NULL, 'm', 'UG', 'Store', 'Merchant subscription', 53, TRUE, NULL)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  is_active = TRUE,
  country_code = EXCLUDED.country_code;

INSERT INTO subscription_fee_rules (
  audience, vehicle_category, country_code, interval, plan_id, priority, label, is_active
)
SELECT v.audience, v.vehicle_category, v.country_code, 'monthly', v.plan_id, v.priority, v.label, TRUE
FROM (VALUES
  ('driver', 'motorcycle', 'UG', 'drv_ug_moto_m', 200, 'UG motorcycle'),
  ('driver', 'sedan', 'UG', 'drv_ug_sedan_m', 200, 'UG sedan'),
  ('driver', 'suv', 'UG', 'drv_ug_suv_m', 200, 'UG SUV'),
  ('driver', NULL, 'UG', 'drv_ug_sedan_m', 40, 'UG driver default'),
  ('merchant', NULL, 'UG', 'merch_ug_store_m', 100, 'UG merchant store')
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

-- Flutterwave covers Uganda MoMo/card checkout
INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
SELECT 'country', 'UG', 'flutterwave'::payment_provider_name, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM payment_provider_config p
  WHERE p.scope = 'country' AND p.country_code = 'UG' AND p.is_active = TRUE
);

-- Market priority: fill the gap where global platforms leave
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'africa_market_focus',
  '{
    "priorityCountries": ["NG", "UG", "GH"],
    "message": "Commission-free mobility where global apps leave — drivers keep 100%.",
    "defaultTripPay": "wallet_then_momo",
    "uberExitMarkets": ["NG", "UG"]
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- CMS: drivers page — keep 100% + fill the vacuum (payload patches)
UPDATE cms_sections s
SET payload = jsonb_set(
  jsonb_set(
    jsonb_set(
      payload,
      '{subhead}',
      '"No commission. Ever. When global apps leave, local drivers still need to earn — Movr lets you keep 100% of every fare with one flexible subscription."'::jsonb
    ),
    '{headline}',
    '"Keep 100% of\nevery fare."'::jsonb
  ),
  '{eyebrow}',
  '"Built for African drivers"'::jsonb
)
WHERE type = 'choice_hero'
  AND page_id IN (SELECT id FROM cms_pages WHERE slug = 'drivers');

UPDATE cms_sections s
SET payload = jsonb_set(
  payload,
  '{items}',
  '[
    {"iconKey":"wallet","title":"100% earnings","body":"Every fare, yours. No per-ride cut — unlike commission apps."},
    {"iconKey":"sparkles","title":"Pay how Africa pays","body":"Wallet, MoMo, or card. Top up and renew in local currency."},
    {"iconKey":"shield","title":"Verified identity","body":"National ID–linked onboarding with attested trust."}
  ]'::jsonb
)
WHERE type = 'why_grid'
  AND page_id IN (SELECT id FROM cms_pages WHERE slug = 'drivers');

UPDATE cms_sections s
SET payload = jsonb_set(
  jsonb_set(
    payload,
    '{heading}',
    '"Ready when other apps leave?"'::jsonb
  ),
  '{body}',
  '"Join drivers in Nigeria, Uganda, Ghana and beyond who keep 100% of every fare."'::jsonb
)
WHERE type = 'final_cta'
  AND page_id IN (SELECT id FROM cms_pages WHERE slug = 'drivers');

-- CMS home: Africa positioning after global exits
UPDATE cms_sections s
SET payload = jsonb_set(
  payload,
  '{items}',
  COALESCE(payload->'items', '[]'::jsonb) ||
  '[{"iconKey":"map","title":"Stays when others leave","body":"Commission-free economics built for African cities — not Silicon Valley take rates."}]'::jsonb
)
WHERE type = 'why_grid'
  AND page_id IN (SELECT id FROM cms_pages WHERE slug = 'home')
  AND NOT (payload::text ILIKE '%Stays when others leave%');

UPDATE cms_sections s
SET payload = jsonb_set(
  jsonb_set(
    payload,
    '{headline}',
    '"Drive and keep 100% of every fare"'::jsonb
  ),
  '{body}',
  '"No per-ride commission. Wallet and MoMo native. Built for cities where riders and drivers both need a fair deal."'::jsonb
)
WHERE type = 'cta_banner'
  AND page_id IN (SELECT id FROM cms_pages WHERE slug = 'home');
