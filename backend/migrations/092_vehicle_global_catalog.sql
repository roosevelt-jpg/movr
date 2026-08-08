-- Global automobile catalog (cached from NHTSA vPIC) + structured vehicle fields
-- for driver / rental-owner listings with make · model · year · chassis autocomplete.

CREATE TABLE IF NOT EXISTS vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  name_norm VARCHAR(128) NOT NULL,
  nhtsa_make_id INT,
  source VARCHAR(32) NOT NULL DEFAULT 'seed',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name_norm)
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id UUID NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  name_norm VARCHAR(128) NOT NULL,
  body_style VARCHAR(64),
  nhtsa_model_id INT,
  year_start INT,
  year_end INT,
  source VARCHAR(32) NOT NULL DEFAULT 'seed',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (make_id, name_norm)
);

CREATE TABLE IF NOT EXISTS vehicle_model_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  year INT NOT NULL CHECK (year >= 1950 AND year <= 2100),
  UNIQUE (model_id, year)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_makes_name ON vehicle_makes (name_norm);
CREATE INDEX IF NOT EXISTS idx_vehicle_makes_active ON vehicle_makes (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_vehicle_models_make ON vehicle_models (make_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_name ON vehicle_models (name_norm);
CREATE INDEX IF NOT EXISTS idx_vehicle_model_years_year ON vehicle_model_years (year);

-- Structured fields on driver vehicles
ALTER TABLE driver_vehicles
  ADD COLUMN IF NOT EXISTS make_id UUID REFERENCES vehicle_makes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year INT,
  ADD COLUMN IF NOT EXISTS vin VARCHAR(32),
  ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS body_style VARCHAR(64),
  ADD COLUMN IF NOT EXISTS transmission VARCHAR(32),
  ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(32);

-- Rental owner listings + catalog links
ALTER TABLE rental_vehicles
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS make_id UUID REFERENCES vehicle_makes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year INT,
  ADD COLUMN IF NOT EXISTS vin VARCHAR(32),
  ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS body_style VARCHAR(64),
  ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(8),
  ADD COLUMN IF NOT EXISTS city VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_rental_vehicles_owner ON rental_vehicles (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Seed Africa-common makes (instant autocomplete before NHTSA sync)
INSERT INTO vehicle_makes (name, name_norm, source) VALUES
  ('Toyota', 'toyota', 'seed'),
  ('Honda', 'honda', 'seed'),
  ('Hyundai', 'hyundai', 'seed'),
  ('Kia', 'kia', 'seed'),
  ('Nissan', 'nissan', 'seed'),
  ('Mercedes-Benz', 'mercedes-benz', 'seed'),
  ('BMW', 'bmw', 'seed'),
  ('Volkswagen', 'volkswagen', 'seed'),
  ('Ford', 'ford', 'seed'),
  ('Mazda', 'mazda', 'seed'),
  ('Mitsubishi', 'mitsubishi', 'seed'),
  ('Suzuki', 'suzuki', 'seed'),
  ('Peugeot', 'peugeot', 'seed'),
  ('Renault', 'renault', 'seed'),
  ('Land Rover', 'land rover', 'seed'),
  ('Lexus', 'lexus', 'seed'),
  ('Audi', 'audi', 'seed'),
  ('Chevrolet', 'chevrolet', 'seed'),
  ('Isuzu', 'isuzu', 'seed'),
  ('Volvo', 'volvo', 'seed'),
  ('Jeep', 'jeep', 'seed'),
  ('Tesla', 'tesla', 'seed'),
  ('BYD', 'byd', 'seed'),
  ('Chery', 'chery', 'seed'),
  ('Geely', 'geely', 'seed')
ON CONFLICT (name_norm) DO NOTHING;

-- Seed popular models per make
INSERT INTO vehicle_models (make_id, name, name_norm, body_style, year_start, year_end, source)
SELECT m.id, x.model, lower(x.model), x.body, x.ys, x.ye, 'seed'
FROM vehicle_makes m
JOIN (
  VALUES
    ('toyota', 'Corolla', 'Sedan', 1990, 2026),
    ('toyota', 'Camry', 'Sedan', 1990, 2026),
    ('toyota', 'Yaris', 'Hatchback', 2000, 2026),
    ('toyota', 'RAV4', 'SUV', 1995, 2026),
    ('toyota', 'Hilux', 'Pickup', 1990, 2026),
    ('toyota', 'Land Cruiser', 'SUV', 1990, 2026),
    ('toyota', 'Fortuner', 'SUV', 2005, 2026),
    ('toyota', 'Hiace', 'Van', 1990, 2026),
    ('toyota', 'Prado', 'SUV', 1995, 2026),
    ('honda', 'Civic', 'Sedan', 1990, 2026),
    ('honda', 'Accord', 'Sedan', 1990, 2026),
    ('honda', 'CR-V', 'SUV', 1997, 2026),
    ('honda', 'HR-V', 'SUV', 2015, 2026),
    ('honda', 'Fit', 'Hatchback', 2001, 2020),
    ('honda', 'Pilot', 'SUV', 2003, 2026),
    ('hyundai', 'Accent', 'Sedan', 1994, 2026),
    ('hyundai', 'Elantra', 'Sedan', 1990, 2026),
    ('hyundai', 'Tucson', 'SUV', 2004, 2026),
    ('hyundai', 'Santa Fe', 'SUV', 2000, 2026),
    ('hyundai', 'i10', 'Hatchback', 2007, 2026),
    ('kia', 'Rio', 'Sedan', 2000, 2026),
    ('kia', 'Sportage', 'SUV', 1993, 2026),
    ('kia', 'Sorento', 'SUV', 2002, 2026),
    ('kia', 'Picanto', 'Hatchback', 2004, 2026),
    ('nissan', 'Altima', 'Sedan', 1993, 2026),
    ('nissan', 'Sentra', 'Sedan', 1990, 2026),
    ('nissan', 'X-Trail', 'SUV', 2001, 2026),
    ('nissan', 'Patrol', 'SUV', 1990, 2026),
    ('nissan', 'Navara', 'Pickup', 1997, 2026),
    ('mercedes-benz', 'C-Class', 'Sedan', 1993, 2026),
    ('mercedes-benz', 'E-Class', 'Sedan', 1990, 2026),
    ('mercedes-benz', 'GLC', 'SUV', 2015, 2026),
    ('mercedes-benz', 'GLE', 'SUV', 2015, 2026),
    ('bmw', '3 Series', 'Sedan', 1990, 2026),
    ('bmw', '5 Series', 'Sedan', 1990, 2026),
    ('bmw', 'X3', 'SUV', 2003, 2026),
    ('bmw', 'X5', 'SUV', 1999, 2026),
    ('volkswagen', 'Golf', 'Hatchback', 1990, 2026),
    ('volkswagen', 'Passat', 'Sedan', 1990, 2026),
    ('volkswagen', 'Tiguan', 'SUV', 2007, 2026),
    ('ford', 'Focus', 'Hatchback', 1998, 2026),
    ('ford', 'Ranger', 'Pickup', 1990, 2026),
    ('ford', 'Explorer', 'SUV', 1991, 2026),
    ('ford', 'Escape', 'SUV', 2000, 2026),
    ('mazda', '3', 'Sedan', 2003, 2026),
    ('mazda', 'CX-5', 'SUV', 2012, 2026),
    ('mitsubishi', 'Pajero', 'SUV', 1990, 2026),
    ('mitsubishi', 'L200', 'Pickup', 1990, 2026),
    ('suzuki', 'Swift', 'Hatchback', 2004, 2026),
    ('peugeot', '208', 'Hatchback', 2012, 2026),
    ('peugeot', '3008', 'SUV', 2009, 2026),
    ('land rover', 'Range Rover', 'SUV', 1990, 2026),
    ('land rover', 'Discovery', 'SUV', 1990, 2026),
    ('lexus', 'RX', 'SUV', 1998, 2026),
    ('lexus', 'ES', 'Sedan', 1990, 2026),
    ('isuzu', 'D-Max', 'Pickup', 2002, 2026),
    ('jeep', 'Wrangler', 'SUV', 1990, 2026),
    ('tesla', 'Model 3', 'Sedan', 2017, 2026),
    ('tesla', 'Model Y', 'SUV', 2020, 2026)
) AS x(make_norm, model, body, ys, ye) ON m.name_norm = x.make_norm
ON CONFLICT (make_id, name_norm) DO NOTHING;

-- Expand model years for seeded models (every year in range — keep lean: every 1 year)
INSERT INTO vehicle_model_years (model_id, year)
SELECT vm.id, y.year
FROM vehicle_models vm
CROSS JOIN LATERAL generate_series(
  COALESCE(vm.year_start, 2000),
  COALESCE(vm.year_end, EXTRACT(YEAR FROM NOW())::INT)
) AS y(year)
WHERE vm.source = 'seed'
ON CONFLICT (model_id, year) DO NOTHING;
