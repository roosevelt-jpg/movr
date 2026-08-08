-- 089: Subscription purchase intervals — weekly, monthly, quarterly, yearly

-- Featured driver plans for all billing cadences
INSERT INTO plans (
  id, name, features, amount, currency, interval, headline, subtitle, badge_label,
  is_featured, sort_order, audience, country_code, is_active, description
) VALUES
  (
    'weekly_driver',
    'Weekly',
    '["0% commission on all rides","Unlimited trips","DVT token rewards included"]'::jsonb,
    2500, 'NGN', 'weekly', 'Weekly', 'Flexible · Cancel anytime', NULL,
    FALSE, 1, 'driver', 'NG', TRUE,
    'Pay weekly — keep 100% of ride earnings'
  ),
  (
    'monthly_driver',
    'Monthly',
    '["0% commission on all rides","Priority ride matching","2x DVT token rewards","Gold driver badge"]'::jsonb,
    7000, 'NGN', 'monthly', 'Monthly', 'Most popular · Auto-renews', 'POPULAR',
    TRUE, 2, 'driver', 'NG', TRUE,
    'Pay monthly — best balance of price and flexibility'
  ),
  (
    'quarterly_driver',
    'Quarterly',
    '["0% commission on all rides","Priority ride matching","2x DVT token rewards","Gold driver badge"]'::jsonb,
    18000, 'NGN', 'quarterly', 'Quarterly', '3 months · Save vs monthly', 'SAVE 14%',
    FALSE, 3, 'driver', 'NG', TRUE,
    'Pay every 3 months — discounted vs three monthly payments'
  ),
  (
    'yearly_driver',
    'Yearly',
    '["0% commission on all rides","Priority ride matching","3x DVT token rewards","Gold driver badge","Annual loyalty bonus"]'::jsonb,
    60000, 'NGN', 'yearly', 'Yearly', '12 months · Best value', 'BEST VALUE · SAVE 29%',
    FALSE, 4, 'driver', 'NG', TRUE,
    'Pay yearly — largest discount; renews once a year'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  features = EXCLUDED.features,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  interval = EXCLUDED.interval,
  headline = EXCLUDED.headline,
  subtitle = EXCLUDED.subtitle,
  badge_label = EXCLUDED.badge_label,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order,
  audience = EXCLUDED.audience,
  country_code = COALESCE(plans.country_code, EXCLUDED.country_code),
  is_active = TRUE,
  description = EXCLUDED.description;

-- Merchant store: quarterly + yearly (weekly/monthly already seeded in 088)
INSERT INTO plans (
  id, name, features, amount, currency, interval, audience, country_code,
  headline, subtitle, sort_order, is_active, description
) VALUES
  (
    'merch_ng_store_q',
    'Merchant store · Quarterly',
    '["Keep store live","Orders + delivery","Analytics"]'::jsonb,
    13500, 'NGN', 'quarterly', 'merchant', 'NG',
    'Store · Quarterly', '3 months · Save vs monthly', 53, TRUE,
    'Quarterly storefront subscription'
  ),
  (
    'merch_ng_store_y',
    'Merchant store · Yearly',
    '["Keep store live","Orders + delivery","Analytics","Priority placement"]'::jsonb,
    48000, 'NGN', 'yearly', 'merchant', 'NG',
    'Store · Yearly', '12 months · Best value', 54, TRUE,
    'Annual storefront subscription'
  ),
  (
    'merch_gh_store_q',
    'Merchant store · Quarterly',
    '["Keep store live","Orders + delivery"]'::jsonb,
    320, 'GHS', 'quarterly', 'merchant', 'GH',
    'Store · Quarterly', '3 months', 55, TRUE, NULL
  ),
  (
    'merch_gh_store_y',
    'Merchant store · Yearly',
    '["Keep store live","Orders + delivery"]'::jsonb,
    1100, 'GHS', 'yearly', 'merchant', 'GH',
    'Store · Yearly', '12 months · Best value', 56, TRUE, NULL
  )
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  interval = EXCLUDED.interval,
  is_active = TRUE,
  audience = EXCLUDED.audience;

-- Rules so resolve() finds weekly / quarterly / yearly defaults
INSERT INTO subscription_fee_rules (
  audience, vehicle_category, country_code, interval, plan_id, priority, label, is_active
)
SELECT v.audience, NULL, v.country_code, v.interval, v.plan_id, v.priority, v.label, TRUE
FROM (VALUES
  ('driver', 'NG', 'weekly', 'weekly_driver', 60, 'NG driver weekly'),
  ('driver', 'NG', 'quarterly', 'quarterly_driver', 60, 'NG driver quarterly'),
  ('driver', 'NG', 'yearly', 'yearly_driver', 60, 'NG driver yearly'),
  ('driver', 'NG', 'monthly', 'monthly_driver', 55, 'NG driver monthly featured'),
  ('merchant', 'NG', 'weekly', 'merch_ng_store_w', 110, 'NG merchant weekly'),
  ('merchant', 'NG', 'quarterly', 'merch_ng_store_q', 110, 'NG merchant quarterly'),
  ('merchant', 'NG', 'yearly', 'merch_ng_store_y', 110, 'NG merchant yearly'),
  ('merchant', 'GH', 'quarterly', 'merch_gh_store_q', 110, 'GH merchant quarterly'),
  ('merchant', 'GH', 'yearly', 'merch_gh_store_y', 110, 'GH merchant yearly')
) AS v(audience, country_code, interval, plan_id, priority, label)
WHERE EXISTS (SELECT 1 FROM plans p WHERE p.id = v.plan_id)
  AND NOT EXISTS (
    SELECT 1 FROM subscription_fee_rules r
    WHERE r.audience = v.audience
      AND r.plan_id = v.plan_id
      AND COALESCE(r.interval, '') = v.interval
      AND COALESCE(r.country_code, '') = v.country_code
      AND r.vehicle_category IS NULL
  );

COMMENT ON COLUMN plans.interval IS 'Billing cadence: weekly | monthly | quarterly | yearly';
COMMENT ON COLUMN subscription_fee_rules.interval IS 'Billing cadence: weekly | monthly | quarterly | yearly';
