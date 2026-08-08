-- 087: Add bicycle to vehicle_category (must commit before use)
DO $$ BEGIN
  ALTER TYPE vehicle_category ADD VALUE IF NOT EXISTS 'bicycle';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
