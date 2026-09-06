-- Pan-Africa listing names: every market can select any common African vehicle name.
-- Country rows still override display labels where useful; * is the full shared catalog.

INSERT INTO vehicle_listing_names
  (country_code, code, display_name, category, body_style, vehicle_type_code, aliases, sort_order)
VALUES
  -- Two-wheelers
  ('*', 'okada', 'Okada (motorcycle taxi)', 'motorcycle', 'Motorcycle', 'okada',
    ARRAY['achaba','going','inaga','moto-taxi','bike','motor'], 11),
  ('*', 'boda', 'Boda boda', 'motorcycle', 'Motorcycle', 'boda',
    ARRAY['boda','bodaboda','piki piki','moto','bike'], 12),
  ('*', 'zemidjan', 'Zémidjan (moto-taxi)', 'motorcycle', 'Motorcycle', 'okada',
    ARRAY['zémidjan','zem','moto'], 13),
  ('*', 'oleyia', 'Oléyia (moto-taxi)', 'motorcycle', 'Motorcycle', 'okada',
    ARRAY['oléyia','oleyia','moto'], 14),
  ('*', 'phenphen', 'Phen-phen (moto-taxi)', 'motorcycle', 'Motorcycle', 'okada',
    ARRAY['phen-phen','phenphen','moto'], 15),
  ('*', 'pikipiki', 'Piki piki', 'motorcycle', 'Motorcycle', 'boda',
    ARRAY['piki piki','pikipiki','boda','moto'], 16),
  ('*', 'kabaza', 'Kabaza (motorcycle taxi)', 'motorcycle', 'Motorcycle', 'motorcycle',
    ARRAY['kabaza','boda','moto','bike'], 17),
  ('*', 'motorcycle', 'Motorcycle / Bike', 'motorcycle', 'Motorcycle', 'motorcycle',
    ARRAY['bike','motor','moto'], 18),

  -- Three-wheelers
  ('*', 'keke', 'Keke / Keke Napep', 'tricycle', 'Tricycle', 'keke',
    ARRAY['keke napep','tricycle','tuk tuk'], 21),
  ('*', 'pragia', 'Pragia / Yellow-yellow', 'tricycle', 'Tricycle', 'keke',
    ARRAY['pragia','yellow yellow','tricycle'], 22),
  ('*', 'tuktuk', 'Tuk tuk', 'tricycle', 'Tricycle', 'keke',
    ARRAY['tuk tuk','tuktuk','tricycle'], 23),
  ('*', 'tricycle', 'Tricycle / 3-wheeler', 'tricycle', 'Tricycle', 'tricycle',
    ARRAY['3-wheeler','keke'], 24),

  -- Cars
  ('*', 'sedan', 'Sedan / Salon / Saloon', 'sedan', 'Sedan', 'sedan',
    ARRAY['car','salon','saloon','sedan'], 30),
  ('*', 'hatchback', 'Hatchback', 'hatchback', 'Hatchback', 'hatchback',
    ARRAY['hatch'], 40),
  ('*', 'suv', 'SUV / 4x4 / Jeep', 'suv', 'SUV', 'suv',
    ARRAY['4x4','jeep'], 50),
  ('*', 'luxury', 'Luxury / Premium / Executive', 'luxury', 'Luxury', 'luxury',
    ARRAY['premium','executive'], 55),

  -- Pickups
  ('*', 'bakkie', 'Bakkie (pickup)', 'pickup', 'Pickup', 'bakkie',
    ARRAY['pickup','ute','bakkie'], 60),
  ('*', 'pickup', 'Pickup', 'pickup', 'Pickup', 'pickup',
    ARRAY['ute','bakkie'], 61),

  -- Vans / shared minibuses
  ('*', 'danfo', 'Danfo (minibus)', 'van', 'Van', 'danfo',
    ARRAY['molue','bus','minibus'], 70),
  ('*', 'trotro', 'Trotro (minibus)', 'van', 'Van', 'trotro',
    ARRAY['tro tro','bus','minibus'], 71),
  ('*', 'matatu', 'Matatu (minibus)', 'van', 'Van', 'matatu',
    ARRAY['matatu','bus','minibus'], 72),
  ('*', 'daladala', 'Dala-dala (minibus)', 'van', 'Van', 'matatu',
    ARRAY['daladala','dala dala','matatu','bus'], 73),
  ('*', 'gbaka', 'Gbaka / Sotrama', 'van', 'Van', 'van',
    ARRAY['gbaka','sotrama','foula-foula','bus','minibus'], 74),
  ('*', 'kombi', 'Kombi / Minibus taxi', 'van', 'Van', 'van',
    ARRAY['kombi','taxi','minibus','combi','bus'], 75),
  ('*', 'candongueiro', 'Candongueiro (minibus)', 'van', 'Van', 'van',
    ARRAY['candongueiro','minibus','bus'], 76),
  ('*', 'van', 'Van / Minibus', 'van', 'Van', 'van',
    ARRAY['bus','minibus'], 77),

  ('*', 'bicycle', 'Bicycle', 'bicycle', 'Bicycle', 'bicycle',
    ARRAY['cycle','bike pedal'], 90)
ON CONFLICT (country_code, code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  body_style = EXCLUDED.body_style,
  vehicle_type_code = EXCLUDED.vehicle_type_code,
  aliases = EXCLUDED.aliases,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- Ensure ride-type codes exist for the new aliases
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order, is_active)
SELECT v.name, v.code, v.category::vehicle_category, v.cap, v.sort, TRUE
FROM (VALUES
  ('Tuk tuk', 'tuktuk', 'tricycle', 3, 2),
  ('Kombi', 'kombi', 'van', 14, 7),
  ('Gbaka', 'gbaka', 'van', 14, 7)
) AS v(name, code, category, cap, sort)
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types vt WHERE vt.code = v.code);
