-- African-first ride tiers + subscription pause for cash-flow empathy

-- Display names: Standard → Economy (code stays `standard` for compat)
UPDATE vehicle_types SET name = 'Economy' WHERE code = 'standard' AND name <> 'Economy';
UPDATE vehicle_types SET name = 'Okada' WHERE code = 'motorcycle' AND name IN ('Motorcycle', 'motorcycle');
UPDATE vehicle_types SET name = 'Keke' WHERE code = 'tricycle' AND name IN ('Tricycle', 'tricycle');

-- Shared / pool rides — affordable African option
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order, is_active)
SELECT 'Shared', 'shared', 'sedan', 4, 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types WHERE code = 'shared');

-- Alias economy code for voice/channels that say "economy"
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order, is_active)
SELECT 'Economy', 'economy', 'sedan', 4, 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types WHERE code = 'economy');

-- Alias okada code
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order, is_active)
SELECT 'Okada', 'okada', 'motorcycle', 1, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types WHERE code = 'okada');

-- Reorder: okada/moto → keke → shared → economy → express → xl/suv → premium
UPDATE vehicle_types SET sort_order = 1 WHERE code IN ('okada', 'motorcycle');
UPDATE vehicle_types SET sort_order = 2 WHERE code IN ('keke', 'tricycle');
UPDATE vehicle_types SET sort_order = 3 WHERE code = 'shared';
UPDATE vehicle_types SET sort_order = 4 WHERE code IN ('economy', 'standard');
UPDATE vehicle_types SET sort_order = 5 WHERE code = 'express';
UPDATE vehicle_types SET sort_order = 6 WHERE code IN ('xl', 'suv');
UPDATE vehicle_types SET sort_order = 7 WHERE code = 'van';
UPDATE vehicle_types SET sort_order = 8 WHERE code IN ('premium', 'luxury');

-- Ensure XL exists as display alias of SUV if missing
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order, is_active)
SELECT 'XL', 'xl', 'suv', 6, 6, TRUE
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types WHERE code = 'xl');

-- Affordable pricing for new tiers (GH + NG)
INSERT INTO vehicle_type_pricing (
  vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, minimum_fare, currency_code
)
SELECT vt.id, c.code,
  CASE vt.code
    WHEN 'okada' THEN 1.2 WHEN 'motorcycle' THEN 1.2
    WHEN 'shared' THEN 1.8 WHEN 'economy' THEN 2.2
    WHEN 'xl' THEN 4.0 ELSE 2.5 END,
  CASE vt.code
    WHEN 'okada' THEN 0.7 WHEN 'motorcycle' THEN 0.7
    WHEN 'shared' THEN 1.0 WHEN 'economy' THEN 1.3
    WHEN 'xl' THEN 2.2 ELSE 1.5 END,
  CASE vt.code
    WHEN 'okada' THEN 0.12 WHEN 'motorcycle' THEN 0.12
    WHEN 'shared' THEN 0.18 WHEN 'economy' THEN 0.22
    WHEN 'xl' THEN 0.4 ELSE 0.25 END,
  CASE WHEN vt.code IN ('okada', 'motorcycle') THEN 2.5 WHEN vt.code = 'shared' THEN 3.5 ELSE 5 END,
  CASE c.code WHEN 'NG' THEN 'NGN' ELSE 'GHS' END
FROM vehicle_types vt
CROSS JOIN (VALUES ('GH'), ('NG')) AS c(code)
WHERE vt.code IN ('okada', 'shared', 'economy', 'xl', 'motorcycle')
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_type_pricing p
    WHERE p.vehicle_type_id = vt.id AND p.country_code = c.code
  );

-- Copy standard pricing onto economy when still missing
INSERT INTO vehicle_type_pricing (
  vehicle_type_id, country_code, city, base_fare, per_km_rate, per_minute_rate,
  minimum_fare, currency_code, cancellation_fee
)
SELECT e.id, p.country_code, p.city, p.base_fare * 0.9, p.per_km_rate * 0.9, p.per_minute_rate * 0.9,
       p.minimum_fare * 0.9, p.currency_code, p.cancellation_fee
FROM vehicle_types e
JOIN vehicle_types s ON s.code = 'standard'
JOIN vehicle_type_pricing p ON p.vehicle_type_id = s.id
WHERE e.code = 'economy'
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_type_pricing x
    WHERE x.vehicle_type_id = e.id AND x.country_code = p.country_code
      AND COALESCE(x.city, '') = COALESCE(p.city, '')
  );

-- Shared = ~75% of economy/standard
INSERT INTO vehicle_type_pricing (
  vehicle_type_id, country_code, city, base_fare, per_km_rate, per_minute_rate,
  minimum_fare, currency_code, cancellation_fee
)
SELECT sh.id, p.country_code, p.city, p.base_fare * 0.75, p.per_km_rate * 0.75, p.per_minute_rate * 0.75,
       p.minimum_fare * 0.75, p.currency_code, p.cancellation_fee
FROM vehicle_types sh
JOIN vehicle_types s ON s.code IN ('standard', 'economy')
JOIN vehicle_type_pricing p ON p.vehicle_type_id = s.id
WHERE sh.code = 'shared'
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_type_pricing x
    WHERE x.vehicle_type_id = sh.id AND x.country_code = p.country_code
      AND COALESCE(x.city, '') = COALESCE(p.city, '')
  )
LIMIT 50;

-- Subscription pause (drivers can pause when offline / cash-tight)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

COMMENT ON COLUMN subscriptions.paused_until IS 'Driver subscription pause end; status=paused while set';
