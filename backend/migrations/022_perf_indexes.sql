-- Phase 21 — Perf indexes (022; was 020_perf_indexes.sql)
-- PostGIS optional: GIST geography index skipped when extension unavailable.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN OTHERS THEN NULL; -- PostGIS not installed on host
END $$;

DO $$ BEGIN
  ALTER TABLE drivers ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
EXCEPTION
  WHEN undefined_object THEN NULL; -- geography type missing
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_lat_lng ON users(latitude, longitude)
  WHERE user_type = 'driver';

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_drivers_location_gist ON drivers USING GIST (location);
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_status_created ON rides(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON rides(driver_id, status);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_stores_geo ON stores(lat, lng);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status, created_at DESC);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
