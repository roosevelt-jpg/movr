-- Phase 21 — Perf indexes (022; was 020_perf_indexes.sql)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_users_lat_lng ON users(latitude, longitude)
  WHERE user_type = 'driver';

CREATE INDEX IF NOT EXISTS idx_drivers_location_gist
  ON drivers USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_rides_status_created ON rides(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON rides(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_stores_geo ON stores(lat, lng);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status, created_at DESC);
