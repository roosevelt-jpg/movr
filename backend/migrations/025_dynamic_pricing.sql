-- Phase 25 — Dynamic pricing (025; was 023_dynamic_pricing.sql)

DO $$ BEGIN
  CREATE TYPE pricing_factor_type AS ENUM (
    'demand', 'time_of_day', 'day_of_week', 'weather', 'traffic', 'event'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pricing_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  country_code VARCHAR(8) REFERENCES countries(code),
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_km NUMERIC(8,2) NOT NULL DEFAULT 5,
  max_surge_cap NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_type pricing_factor_type NOT NULL,
  zone_id UUID REFERENCES pricing_zones(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  weight_or_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zone_demand_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES pricing_zones(id) ON DELETE CASCADE,
  active_rides INTEGER DEFAULT 0,
  available_drivers INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES pricing_zones(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.2,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pricing_multiplier_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID,
  zone_id UUID REFERENCES pricing_zones(id),
  demand_multiplier NUMERIC(6,3) DEFAULT 1,
  time_multiplier NUMERIC(6,3) DEFAULT 1,
  day_multiplier NUMERIC(6,3) DEFAULT 1,
  weather_multiplier NUMERIC(6,3) DEFAULT 1,
  traffic_multiplier NUMERIC(6,3) DEFAULT 1,
  event_multiplier NUMERIC(6,3) DEFAULT 1,
  final_multiplier NUMERIC(6,3) DEFAULT 1,
  reason_summary TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pricing_zones (name, country_code, center_lat, center_lng, radius_km, max_surge_cap)
SELECT 'Accra Central', 'GH', 5.6037, -0.1870, 8, 1.8
WHERE NOT EXISTS (SELECT 1 FROM pricing_zones WHERE name = 'Accra Central');

INSERT INTO pricing_factors (factor_type, zone_id, is_active, weight_or_config_json)
SELECT v.factor_type::pricing_factor_type, z.id, TRUE, v.config::jsonb
FROM pricing_zones z
CROSS JOIN (VALUES
  ('demand', '{"high":1.5,"medium":1.2,"low":1.0}'),
  ('time_of_day', '{"bands":[{"start":7,"end":9,"mult":1.15},{"start":17,"end":20,"mult":1.15}]}'),
  ('day_of_week', '{"fri":1.1,"sat":1.15,"default":1.0}'),
  ('weather', '{"Rain":1.1,"Thunderstorm":1.25,"Clear":1.0}'),
  ('traffic', '{"threshold":1.3,"mult":1.15}'),
  ('event', '{}')
) AS v(factor_type, config)
WHERE z.name = 'Accra Central'
  AND NOT EXISTS (
    SELECT 1 FROM pricing_factors f WHERE f.zone_id = z.id AND f.factor_type::text = v.factor_type
  );
