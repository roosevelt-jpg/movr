-- Align admin live map / finance / vehicle pricing / merchants CMS to mockups

-- Vehicle types: Ghana pricing exact mockup values; deactivate extras
UPDATE vehicle_types SET name = 'Sedan' WHERE code IN ('standard', 'sedan');
UPDATE vehicle_types SET is_active = FALSE WHERE code IN ('express', 'premium', 'bus');
UPDATE vehicle_types SET is_active = TRUE
WHERE code IN ('motorcycle', 'tricycle', 'standard', 'sedan', 'suv', 'van', 'luxury');

-- Force latest mockup rates for GH (update currently effective row)
UPDATE vehicle_type_pricing p SET
  base_fare = v.base,
  per_km_rate = v.per_km,
  per_minute_rate = v.per_min,
  minimum_fare = v.minimum
FROM vehicle_types vt
JOIN (VALUES
  ('motorcycle', 3.00, 0.90, 0.15, 6.00),
  ('tricycle', 4.00, 1.10, 0.18, 8.00),
  ('standard', 6.00, 1.50, 0.25, 12.00),
  ('sedan', 6.00, 1.50, 0.25, 12.00),
  ('suv', 9.00, 2.10, 0.35, 18.00),
  ('van', 12.00, 2.60, 0.40, 22.00),
  ('luxury', 20.00, 4.00, 0.60, 35.00)
) AS v(code, base, per_km, per_min, minimum) ON vt.code = v.code
WHERE p.vehicle_type_id = vt.id
  AND p.country_code = 'GH'
  AND p.id = (
    SELECT p2.id FROM vehicle_type_pricing p2
    WHERE p2.vehicle_type_id = vt.id AND p2.country_code = 'GH'
    ORDER BY p2.effective_from DESC LIMIT 1
  );

-- Insert pricing if a type has none for GH
INSERT INTO vehicle_type_pricing (
  vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, minimum_fare, currency_code
)
SELECT vt.id, 'GH', v.base, v.per_km, v.per_min, v.minimum, 'GHS'
FROM vehicle_types vt
JOIN (VALUES
  ('motorcycle', 3.00, 0.90, 0.15, 6.00),
  ('tricycle', 4.00, 1.10, 0.18, 8.00),
  ('standard', 6.00, 1.50, 0.25, 12.00),
  ('sedan', 6.00, 1.50, 0.25, 12.00),
  ('suv', 9.00, 2.10, 0.35, 18.00),
  ('van', 12.00, 2.60, 0.40, 22.00),
  ('luxury', 20.00, 4.00, 0.60, 35.00)
) AS v(code, base, per_km, per_min, minimum) ON vt.code = v.code
WHERE NOT EXISTS (
  SELECT 1 FROM vehicle_type_pricing p
  WHERE p.vehicle_type_id = vt.id AND p.country_code = 'GH'
);

-- Seed GMV rollup for finance chart (last 7 days) if empty
INSERT INTO gmv_daily_rollup (date, service_type, country, currency, gmv_amount)
SELECT d::date, 'ride', 'GH', 'GHS',
  CASE EXTRACT(DOW FROM d)
    WHEN 0 THEN 280000 WHEN 1 THEN 320000 WHEN 2 THEN 210000
    WHEN 3 THEN 410000 WHEN 4 THEN 360000 WHEN 5 THEN 480000
    ELSE 390000
  END
FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM gmv_daily_rollup g WHERE g.date = d::date AND g.service_type = 'ride' AND g.country = 'GH'
);

INSERT INTO gmv_daily_rollup (date, service_type, country, currency, gmv_amount)
SELECT d::date, 'shop', 'GH', 'GHS', 90000 + EXTRACT(DOW FROM d)::int * 12000
FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM gmv_daily_rollup g WHERE g.date = d::date AND g.service_type = 'shop' AND g.country = 'GH'
);

-- CMS merchants: Start selling CTA in hero
DO $$
BEGIN
  UPDATE cms_sections
  SET payload = payload || jsonb_build_object(
    'secondaryCta', jsonb_build_object('label', 'Start selling', 'href', '/merchant/onboarding')
  )
  WHERE page_id IN (SELECT id FROM cms_pages WHERE slug = 'merchants')
    AND type = 'hero';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
