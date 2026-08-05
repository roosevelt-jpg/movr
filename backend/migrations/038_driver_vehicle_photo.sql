-- Driver vehicle photo + profile columns used by PATCH /driver/vehicle
ALTER TABLE driver_vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE driver_vehicles ADD COLUMN IF NOT EXISTS make_model VARCHAR(128);
ALTER TABLE driver_vehicles ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(64);
ALTER TABLE driver_vehicles ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE driver_vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Allow inserts before a pricing vehicle type is chosen (nullable for soft profile edits)
ALTER TABLE driver_vehicles ALTER COLUMN vehicle_type_id DROP NOT NULL;
