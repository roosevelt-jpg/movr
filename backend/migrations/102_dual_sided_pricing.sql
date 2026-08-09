-- Dual-sided intelligent pricing: rider discounts ≠ driver payouts + fare modes
ALTER TABLE pricing_zones
  ADD COLUMN IF NOT EXISTS min_rider_mult NUMERIC(6,3) NOT NULL DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS driver_incentive_flat NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_incentive_mult NUMERIC(6,3) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS destination_bonus_flat NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rider_discount_budget_pct NUMERIC(6,3) NOT NULL DEFAULT 0.20;

ALTER TABLE pricing_multiplier_log
  ADD COLUMN IF NOT EXISTS rider_multiplier NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS driver_multiplier NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS rider_fare NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS driver_payout NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_subsidy NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fare_mode VARCHAR(32);

CREATE TABLE IF NOT EXISTS fare_modes (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description TEXT,
  rider_mult NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  driver_keep_mult NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  eta_extra_minutes INT NOT NULL DEFAULT 0,
  walk_meters INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO fare_modes (code, name, description, rider_mult, driver_keep_mult, eta_extra_minutes, walk_meters, sort_order)
VALUES
  ('now', 'Go now', 'Standard pickup at current price', 1.00, 1.00, 0, 0, 10),
  ('wait', 'Wait 8 min', 'Slightly cheaper if you can wait — helps balance demand', 0.90, 1.00, 8, 0, 20),
  ('shoulder', 'Off-peak slot', 'Cheaper shoulder window near rush hour', 0.85, 1.05, 12, 0, 30),
  ('walk', 'Walk & save', 'Walk a short distance to a cheaper pickup micro-zone', 0.82, 1.02, 5, 400, 40),
  ('share', 'Share', 'Shared ride — lowest rider fare, drivers still earn well via pool fill', 0.70, 1.08, 10, 0, 50)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  rider_mult = EXCLUDED.rider_mult,
  driver_keep_mult = EXCLUDED.driver_keep_mult,
  eta_extra_minutes = EXCLUDED.eta_extra_minutes,
  walk_meters = EXCLUDED.walk_meters,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS fare_mode VARCHAR(32) DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS platform_subsidy NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_meta JSONB DEFAULT '{}'::jsonb;

-- Seed off-peak / shoulder bands on active time_of_day factors (sub-1.0 rider mult)
UPDATE pricing_factors
SET weight_or_config_json = COALESCE(weight_or_config_json, '{}'::jsonb) || jsonb_build_object(
  'bands', COALESCE(
    weight_or_config_json->'bands',
    '[
      {"start":6,"end":8,"mult":0.92,"label":"early shoulder"},
      {"start":8,"end":10,"mult":1.25,"label":"morning peak"},
      {"start":10,"end":16,"mult":0.88,"label":"midday off-peak"},
      {"start":16,"end":19,"mult":1.35,"label":"evening peak"},
      {"start":19,"end":22,"mult":0.95,"label":"evening shoulder"},
      {"start":22,"end":24,"mult":0.85,"label":"late night discount"},
      {"start":0,"end":6,"mult":0.80,"label":"overnight discount"}
    ]'::jsonb
  )
)
WHERE factor_type = 'time_of_day';

-- Default zone incentives so drivers gain in hotspots while riders can still pick discounts
UPDATE pricing_zones
SET driver_incentive_flat = COALESCE(NULLIF(driver_incentive_flat, 0), 50),
    driver_incentive_mult = GREATEST(COALESCE(driver_incentive_mult, 1), 1.05),
    destination_bonus_flat = COALESCE(destination_bonus_flat, 30),
    min_rider_mult = LEAST(COALESCE(min_rider_mult, 0.7), 0.7)
WHERE is_active = TRUE;

INSERT INTO platform_settings (key, value)
VALUES
  ('dual_pricing', '{"enabled":true,"zero_take_rate":true,"subsidy_from":"platform"}'::jsonb),
  ('pricing_fare_modes', '{"enabled":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
