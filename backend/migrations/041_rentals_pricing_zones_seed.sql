-- Luxury rental pricing + seed Accra pricing zones for admin panel live data
-- Rollback: DELETE FROM rental_pricing WHERE vehicle_type_id = 'luxury';
--          DELETE FROM pricing_zones WHERE name IN ('Osu & East Legon','Airport residential','Tema industrial');

INSERT INTO rental_pricing (vehicle_type_id, rental_type, rate_unit, rate_amount, currency_code)
SELECT * FROM (VALUES
  ('standard', 'self_drive'::rental_type, 'hourly'::rental_rate_unit, 45::numeric, 'GHS'),
  ('standard', 'self_drive'::rental_type, 'daily'::rental_rate_unit, 280::numeric, 'GHS'),
  ('standard', 'chauffeur'::rental_type, 'hourly'::rental_rate_unit, 55::numeric, 'GHS'),
  ('standard', 'chauffeur'::rental_type, 'daily'::rental_rate_unit, 320::numeric, 'GHS'),
  ('suv', 'self_drive'::rental_type, 'hourly'::rental_rate_unit, 70::numeric, 'GHS'),
  ('suv', 'self_drive'::rental_type, 'daily'::rental_rate_unit, 420::numeric, 'GHS'),
  ('suv', 'chauffeur'::rental_type, 'hourly'::rental_rate_unit, 85::numeric, 'GHS'),
  ('suv', 'chauffeur'::rental_type, 'daily'::rental_rate_unit, 480::numeric, 'GHS'),
  ('luxury', 'self_drive'::rental_type, 'hourly'::rental_rate_unit, 150::numeric, 'GHS'),
  ('luxury', 'self_drive'::rental_type, 'daily'::rental_rate_unit, 950::numeric, 'GHS'),
  ('luxury', 'chauffeur'::rental_type, 'hourly'::rental_rate_unit, 180::numeric, 'GHS'),
  ('luxury', 'chauffeur'::rental_type, 'daily'::rental_rate_unit, 1100::numeric, 'GHS')
) AS v(vehicle_type_id, rental_type, rate_unit, rate_amount, currency_code)
WHERE NOT EXISTS (
  SELECT 1 FROM rental_pricing p
  WHERE p.vehicle_type_id = v.vehicle_type_id
    AND p.rental_type = v.rental_type
    AND p.rate_unit = v.rate_unit
    AND p.currency_code = v.currency_code
);

-- Upsert mockup-aligned daily self-drive rates when rows already exist
UPDATE rental_pricing SET rate_amount = 280
WHERE vehicle_type_id = 'standard' AND rental_type = 'self_drive' AND rate_unit = 'daily';
UPDATE rental_pricing SET rate_amount = 420
WHERE vehicle_type_id = 'suv' AND rental_type = 'self_drive' AND rate_unit = 'daily';
UPDATE rental_pricing SET rate_amount = 950
WHERE vehicle_type_id = 'luxury' AND rental_type = 'self_drive' AND rate_unit = 'daily';

INSERT INTO pricing_zones (name, country_code, center_lat, center_lng, radius_km, max_surge_cap, is_active)
SELECT * FROM (VALUES
  ('Osu & East Legon', 'GH', 5.5557::float8, -0.1820::float8, 4.0::numeric, 2.0::numeric, TRUE),
  ('Airport residential', 'GH', 5.6052::float8, -0.1668::float8, 3.5::numeric, 2.0::numeric, TRUE),
  ('Tema industrial', 'GH', 5.6698::float8, -0.0166::float8, 5.0::numeric, 1.8::numeric, TRUE)
) AS v(name, country_code, center_lat, center_lng, radius_km, max_surge_cap, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_zones z WHERE z.name = v.name AND z.country_code = v.country_code
);
