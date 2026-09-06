-- Country-aware vehicle listing names for East / West / Southern Africa.
-- Drivers pick from a dropdown (local names like Okada, Boda, Bakkie, Trotro)
-- instead of free-typing category labels.

-- Prefer existing vehicle_category values so this migration can run in one transaction.
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order, is_active)
SELECT v.name, v.code, v.category::vehicle_category, v.cap, v.sort, TRUE
FROM (VALUES
  ('Keke', 'keke', 'tricycle', 3, 2),
  ('Boda', 'boda', 'motorcycle', 1, 1),
  ('Matatu', 'matatu', 'van', 14, 7),
  ('Trotro', 'trotro', 'van', 14, 7),
  ('Danfo', 'danfo', 'van', 14, 7),
  ('Bakkie', 'bakkie', 'van', 4, 6),
  ('Pickup', 'pickup', 'van', 4, 6),
  ('Hatchback', 'hatchback', 'sedan', 4, 4),
  ('Sedan', 'sedan', 'sedan', 4, 4)
) AS v(name, code, category, cap, sort)
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types vt WHERE vt.code = v.code);

CREATE TABLE IF NOT EXISTS vehicle_listing_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(8) NOT NULL,
  code VARCHAR(48) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL,
  body_style VARCHAR(64) NOT NULL,
  vehicle_type_code VARCHAR(32),
  aliases TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, code)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_listing_names_country
  ON vehicle_listing_names (country_code, sort_order)
  WHERE is_active;

COMMENT ON TABLE vehicle_listing_names IS
  'Local names for vehicle categories by country (* = continental defaults). Used for driver/rental listing dropdowns.';

-- Continental defaults (*). Country rows override same code.
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
VALUES
  ('*', 'motorcycle', 'Motorcycle', 'motorcycle', 'Motorcycle', 'motorcycle', ARRAY['bike','motor','moto'], 10),
  ('*', 'tricycle', 'Tricycle', 'tricycle', 'Tricycle', 'tricycle', ARRAY['3-wheeler','tuk tuk'], 20),
  ('*', 'sedan', 'Sedan / Salon', 'sedan', 'Sedan', 'sedan', ARRAY['car','salon','saloon'], 30),
  ('*', 'hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('*', 'suv', 'SUV', 'suv', 'SUV', 'suv', ARRAY['4x4','jeep'], 50),
  ('*', 'pickup', 'Pickup', 'pickup', 'Pickup', 'pickup', ARRAY['ute'], 60),
  ('*', 'van', 'Van / Minibus', 'van', 'Van', 'van', ARRAY['minibus','bus'], 70),
  ('*', 'luxury', 'Luxury', 'luxury', 'Luxury', 'luxury', ARRAY['premium','executive'], 80),
  ('*', 'bicycle', 'Bicycle', 'bicycle', 'Bicycle', 'bicycle', ARRAY['cycle','bike pedal'], 90)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  body_style = EXCLUDED.body_style,
  vehicle_type_code = EXCLUDED.vehicle_type_code,
  aliases = EXCLUDED.aliases,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- ─── West Africa ───────────────────────────────────────────────
-- Nigeria
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
VALUES
  ('NG', 'okada', 'Okada (motorcycle)', 'motorcycle', 'Motorcycle', 'okada', ARRAY['achaba','going','inaga','bike','motor'], 10),
  ('NG', 'keke', 'Keke / Keke Napep', 'tricycle', 'Tricycle', 'keke', ARRAY['keke napep','tricycle','tuk tuk'], 20),
  ('NG', 'sedan', 'Salon car', 'sedan', 'Sedan', 'sedan', ARRAY['car','sedan','saloon'], 30),
  ('NG', 'hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('NG', 'suv', 'SUV / Jeep', 'suv', 'SUV', 'suv', ARRAY['jeep','4x4'], 50),
  ('NG', 'pickup', 'Pickup', 'pickup', 'Pickup', 'pickup', ARRAY['ute'], 60),
  ('NG', 'danfo', 'Danfo (minibus)', 'van', 'Van', 'danfo', ARRAY['molue','bus','minibus'], 70),
  ('NG', 'van', 'Van', 'van', 'Van', 'van', ARRAY['bus'], 75),
  ('NG', 'luxury', 'Luxury / Premium', 'luxury', 'Luxury', 'luxury', ARRAY['executive'], 80)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name, aliases = EXCLUDED.aliases,
  vehicle_type_code = EXCLUDED.vehicle_type_code, sort_order = EXCLUDED.sort_order, is_active = TRUE;

-- Ghana
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
VALUES
  ('GH', 'okada', 'Okada / Motorbike', 'motorcycle', 'Motorcycle', 'okada', ARRAY['moto','bike','motor'], 10),
  ('GH', 'keke', 'Pragia / Tricycle', 'tricycle', 'Tricycle', 'keke', ARRAY['pragia','yellow yellow','tricycle'], 20),
  ('GH', 'sedan', 'Saloon car', 'sedan', 'Sedan', 'sedan', ARRAY['car','salon','sedan'], 30),
  ('GH', 'hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('GH', 'suv', 'SUV / 4x4', 'suv', 'SUV', 'suv', ARRAY['4x4','jeep'], 50),
  ('GH', 'pickup', 'Pickup', 'pickup', 'Pickup', 'pickup', ARRAY['ute'], 60),
  ('GH', 'trotro', 'Trotro (minibus)', 'van', 'Van', 'trotro', ARRAY['tro tro','bus','minibus'], 70),
  ('GH', 'van', 'Van', 'van', 'Van', 'van', ARRAY['bus'], 75),
  ('GH', 'luxury', 'Luxury', 'luxury', 'Luxury', 'luxury', ARRAY['premium'], 80)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name, aliases = EXCLUDED.aliases,
  vehicle_type_code = EXCLUDED.vehicle_type_code, sort_order = EXCLUDED.sort_order, is_active = TRUE;

-- Other West Africa (shared moto-taxi naming)
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
SELECT c.code, v.code, v.display_name, v.category, v.body_style, v.vehicle_type_code, v.aliases, v.sort_order
FROM (VALUES
  ('BJ'), ('TG'), ('BF'), ('ML'), ('NE'), ('SN'), ('CI'), ('GN'), ('GW'),
  ('SL'), ('LR'), ('GM'), ('CV'), ('MR')
) AS c(code)
CROSS JOIN (VALUES
  ('okada', 'Moto-taxi / Okada', 'motorcycle', 'Motorcycle', 'okada', ARRAY['moto','oléyia','zémidjan','phen-phen','bike'], 10),
  ('keke', 'Tricycle / Keke', 'tricycle', 'Tricycle', 'keke', ARRAY['tricycle','tuk tuk'], 20),
  ('sedan', 'Sedan / Salon', 'sedan', 'Sedan', 'sedan', ARRAY['car','salon'], 30),
  ('hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('suv', 'SUV', 'suv', 'SUV', 'suv', ARRAY['4x4','jeep'], 50),
  ('pickup', 'Pickup', 'pickup', 'Pickup', 'pickup', ARRAY['ute'], 60),
  ('van', 'Gbaka / Minibus', 'van', 'Van', 'van', ARRAY['gbaka','sotrama','foula-foula','bus','minibus'], 70),
  ('luxury', 'Luxury', 'luxury', 'Luxury', 'luxury', ARRAY['premium'], 80)
) AS v(code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name, aliases = EXCLUDED.aliases,
  vehicle_type_code = EXCLUDED.vehicle_type_code, sort_order = EXCLUDED.sort_order, is_active = TRUE;

-- Benin / Togo specific moto names
UPDATE vehicle_listing_names SET display_name = 'Zémidjan (moto-taxi)', aliases = ARRAY['zémidjan','zem','moto','okada']
WHERE country_code = 'BJ' AND code = 'okada';
UPDATE vehicle_listing_names SET display_name = 'Oléyia (moto-taxi)', aliases = ARRAY['oléyia','oleyia','moto','okada']
WHERE country_code = 'TG' AND code = 'okada';
UPDATE vehicle_listing_names SET display_name = 'Phen-phen (moto-taxi)', aliases = ARRAY['phen-phen','phenphen','moto','okada']
WHERE country_code = 'LR' AND code = 'okada';

-- ─── East Africa ───────────────────────────────────────────────
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
SELECT c.code, v.code, v.display_name, v.category, v.body_style, v.vehicle_type_code, v.aliases, v.sort_order
FROM (VALUES
  ('KE'), ('UG'), ('TZ'), ('RW'), ('BI'), ('ET'), ('SS'), ('SO'), ('DJ'), ('ER')
) AS c(code)
CROSS JOIN (VALUES
  ('boda', 'Boda boda', 'motorcycle', 'Motorcycle', 'boda', ARRAY['boda','bodaboda','piki piki','moto','bike'], 10),
  ('keke', 'Tuk tuk / Tricycle', 'tricycle', 'Tricycle', 'keke', ARRAY['tuk tuk','tuktuk','tricycle'], 20),
  ('sedan', 'Sedan / Salon', 'sedan', 'Sedan', 'sedan', ARRAY['car','salon','saloon'], 30),
  ('hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('suv', 'SUV / 4x4', 'suv', 'SUV', 'suv', ARRAY['4x4','jeep'], 50),
  ('pickup', 'Pickup', 'pickup', 'Pickup', 'pickup', ARRAY['ute'], 60),
  ('matatu', 'Matatu / Minibus', 'van', 'Van', 'matatu', ARRAY['matatu','daladala','hafla','bus','minibus'], 70),
  ('van', 'Van', 'van', 'Van', 'van', ARRAY['bus'], 75),
  ('luxury', 'Luxury', 'luxury', 'Luxury', 'luxury', ARRAY['premium'], 80)
) AS v(code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name, aliases = EXCLUDED.aliases,
  vehicle_type_code = EXCLUDED.vehicle_type_code, sort_order = EXCLUDED.sort_order, is_active = TRUE;

UPDATE vehicle_listing_names SET display_name = 'Piki piki / Boda', aliases = ARRAY['piki piki','pikipiki','boda','bodaboda','moto']
WHERE country_code = 'TZ' AND code = 'boda';
UPDATE vehicle_listing_names SET display_name = 'Dala-dala (minibus)', aliases = ARRAY['daladala','dala dala','matatu','bus']
WHERE country_code = 'TZ' AND code = 'matatu';
UPDATE vehicle_listing_names SET display_name = 'Boda boda', aliases = ARRAY['boda','bodaboda','moto','bike']
WHERE country_code IN ('UG', 'KE', 'RW') AND code = 'boda';

-- ─── Southern Africa ─────────────────────────────────────────
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
SELECT c.code, v.code, v.display_name, v.category, v.body_style, v.vehicle_type_code, v.aliases, v.sort_order
FROM (VALUES
  ('ZA'), ('BW'), ('NA'), ('ZW'), ('ZM'), ('MW'), ('MZ'), ('AO'), ('LS'), ('SZ')
) AS c(code)
CROSS JOIN (VALUES
  ('motorcycle', 'Motorcycle / Bike', 'motorcycle', 'Motorcycle', 'motorcycle', ARRAY['bike','moto','motor'], 10),
  ('keke', 'Tricycle', 'tricycle', 'Tricycle', 'keke', ARRAY['tuk tuk','tricycle'], 20),
  ('sedan', 'Sedan / Hatch', 'sedan', 'Sedan', 'sedan', ARRAY['car','salon'], 30),
  ('hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('suv', 'SUV / Bakkie-SUV', 'suv', 'SUV', 'suv', ARRAY['4x4','jeep'], 50),
  ('bakkie', 'Bakkie (pickup)', 'pickup', 'Pickup', 'bakkie', ARRAY['pickup','ute','bakkie'], 60),
  ('van', 'Taxi / Minibus', 'van', 'Van', 'van', ARRAY['kombi','taxi','minibus','bus','combi'], 70),
  ('luxury', 'Luxury', 'luxury', 'Luxury', 'luxury', ARRAY['premium'], 80)
) AS v(code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name, aliases = EXCLUDED.aliases,
  vehicle_type_code = EXCLUDED.vehicle_type_code, sort_order = EXCLUDED.sort_order, is_active = TRUE;

UPDATE vehicle_listing_names SET display_name = 'Kabaza (motorcycle taxi)', aliases = ARRAY['kabaza','boda','moto','bike']
WHERE country_code = 'MW' AND code = 'motorcycle';
UPDATE vehicle_listing_names SET display_name = 'Candongueiro / Minibus', aliases = ARRAY['candongueiro','minibus','bus']
WHERE country_code = 'AO' AND code = 'van';
UPDATE vehicle_listing_names SET display_name = 'Kombi / Minibus taxi', aliases = ARRAY['kombi','taxi','minibus','combi']
WHERE country_code IN ('ZA', 'BW', 'NA', 'ZW') AND code = 'van';

-- Central Africa shared pack (often uses moto + shared taxis)
INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
SELECT c.code, v.code, v.display_name, v.category, v.body_style, v.vehicle_type_code, v.aliases, v.sort_order
FROM (VALUES
  ('CM'), ('CG'), ('CD'), ('GA'), ('GQ'), ('CF'), ('TD')
) AS c(code)
CROSS JOIN (VALUES
  ('okada', 'Moto-taxi', 'motorcycle', 'Motorcycle', 'okada', ARRAY['moto','bike','okada'], 10),
  ('keke', 'Tricycle', 'tricycle', 'Tricycle', 'keke', ARRAY['tuk tuk','tricycle'], 20),
  ('sedan', 'Sedan / Salon', 'sedan', 'Sedan', 'sedan', ARRAY['car','salon'], 30),
  ('hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback', ARRAY['hatch'], 40),
  ('suv', 'SUV', 'suv', 'SUV', 'suv', ARRAY['4x4'], 50),
  ('pickup', 'Pickup', 'pickup', 'Pickup', 'pickup', ARRAY['ute'], 60),
  ('van', 'Minibus / Taxi', 'van', 'Van', 'van', ARRAY['bus','minibus','taxi'], 70),
  ('luxury', 'Luxury', 'luxury', 'Luxury', 'luxury', ARRAY['premium'], 80)
) AS v(code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name, aliases = EXCLUDED.aliases,
  vehicle_type_code = EXCLUDED.vehicle_type_code, sort_order = EXCLUDED.sort_order, is_active = TRUE;

-- Popular Africa 2-wheeler / 3-wheeler OEM makes & models for dropdown selection
INSERT INTO vehicle_makes (name, name_norm, source) VALUES
  ('Bajaj', 'bajaj', 'africa_seed'),
  ('TVS', 'tvs', 'africa_seed'),
  ('Hero', 'hero', 'africa_seed'),
  ('Yamaha', 'yamaha', 'africa_seed'),
  ('Haojue', 'haojue', 'africa_seed'),
  ('Lifan', 'lifan', 'africa_seed'),
  ('Dayun', 'dayun', 'africa_seed'),
  ('Royal Enfield', 'royal enfield', 'africa_seed'),
  ('Piaggio', 'piaggio', 'africa_seed'),
  ('Capri', 'capri', 'africa_seed'),
  ('Boxer', 'boxer', 'africa_seed'),
  ('Qlink', 'qlink', 'africa_seed'),
  ('Kentoya', 'kentoya', 'africa_seed'),
  ('Mahindra', 'mahindra', 'africa_seed'),
  ('Foton', 'foton', 'africa_seed')
ON CONFLICT (name_norm) DO NOTHING;

INSERT INTO vehicle_models (make_id, name, name_norm, body_style, source)
SELECT m.id, x.model, lower(x.model), x.body, 'africa_seed'
FROM vehicle_makes m
JOIN (VALUES
  ('bajaj', 'Boxer', 'Motorcycle'),
  ('bajaj', 'Pulsar', 'Motorcycle'),
  ('bajaj', 'CT 100', 'Motorcycle'),
  ('bajaj', 'RE', 'Tricycle'),
  ('bajaj', 'RE Compact', 'Tricycle'),
  ('tvs', 'Apache', 'Motorcycle'),
  ('tvs', 'Star HLX', 'Motorcycle'),
  ('tvs', 'King', 'Tricycle'),
  ('hero', 'Splendor', 'Motorcycle'),
  ('hero', 'HF Deluxe', 'Motorcycle'),
  ('honda', 'CG125', 'Motorcycle'),
  ('honda', 'Ace 125', 'Motorcycle'),
  ('honda', 'Navi', 'Motorcycle'),
  ('yamaha', 'Crux', 'Motorcycle'),
  ('yamaha', 'YZF-R15', 'Motorcycle'),
  ('haojue', 'HJ125', 'Motorcycle'),
  ('haojue', 'Lucky', 'Motorcycle'),
  ('lifan', 'LF150', 'Motorcycle'),
  ('dayun', 'DY150', 'Motorcycle'),
  ('royal enfield', 'Classic 350', 'Motorcycle'),
  ('piaggio', 'Ape', 'Tricycle'),
  ('capri', 'Scooter', 'Motorcycle'),
  ('mahindra', 'Alfa', 'Tricycle'),
  ('foton', 'View', 'Van'),
  ('foton', 'Tunland', 'Pickup'),
  ('isuzu', 'NPR', 'Van'),
  ('toyota', 'Coaster', 'Van'),
  ('toyota', 'Quantum', 'Van'),
  ('toyota', 'Avanza', 'Van'),
  ('nissan', 'NV350', 'Van'),
  ('hyundai', 'H1', 'Van'),
  ('volkswagen', 'Caddy', 'Van'),
  ('ford', 'Transit', 'Van')
) AS x(make_norm, model, body) ON m.name_norm = x.make_norm
ON CONFLICT (make_id, name_norm) DO UPDATE SET
  body_style = COALESCE(vehicle_models.body_style, EXCLUDED.body_style),
  source = COALESCE(vehicle_models.source, EXCLUDED.source),
  updated_at = NOW();
