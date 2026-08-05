-- Phase 24/25 gap closure — sedan naming, driver vehicles, zone demand helpers

-- Align seed naming: Standard → Sedan (code stays `standard` for backwards compat)
UPDATE vehicle_types SET name = 'Sedan' WHERE code = 'standard' AND name <> 'Sedan';

-- Preferred Sedan code alias if missing
INSERT INTO vehicle_types (name, code, category, passenger_capacity, sort_order)
SELECT 'Sedan', 'sedan', 'sedan', 4, 3
WHERE NOT EXISTS (SELECT 1 FROM vehicle_types WHERE code = 'sedan');

INSERT INTO vehicle_type_pricing (
  vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, minimum_fare, currency_code
)
SELECT vt.id, 'GH', 2.5, 1.5, 0.25, 5, 'GHS'
FROM vehicle_types vt
WHERE vt.code = 'sedan'
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_type_pricing p WHERE p.vehicle_type_id = vt.id AND p.country_code = 'GH'
  );

-- Driver registered vehicles (extends drivers.vehicle_type_id — do not duplicate pricing)
CREATE TABLE IF NOT EXISTS driver_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
  plate_number VARCHAR(32),
  make VARCHAR(64),
  model VARCHAR(64),
  color VARCHAR(32),
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver ON driver_vehicles(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_type ON driver_vehicles(vehicle_type_id);

-- Backfill primary vehicle from drivers.vehicle_type_id when present
INSERT INTO driver_vehicles (driver_user_id, vehicle_type_id, is_primary)
SELECT d.user_id, d.vehicle_type_id, TRUE
FROM drivers d
WHERE d.vehicle_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_vehicles dv
    WHERE dv.driver_user_id = d.user_id AND dv.vehicle_type_id = d.vehicle_type_id
  );

-- Ensure Accra zone has a demand snapshot row for zone-scoped surge
INSERT INTO zone_demand_snapshots (zone_id, active_rides, available_drivers)
SELECT z.id, 0, 10
FROM pricing_zones z
WHERE z.name = 'Accra Central'
  AND NOT EXISTS (
    SELECT 1 FROM zone_demand_snapshots s WHERE s.zone_id = z.id
  );
