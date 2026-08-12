-- 105: Share pool dispatch fields + fare split columns
ALTER TABLE share_pools
  ADD COLUMN IF NOT EXISTS match_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS matching_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_fare NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS per_rider_fare NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS driver_payout NUMERIC(12,2);

ALTER TABLE share_pool_members
  ADD COLUMN IF NOT EXISTS fare_share NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pay_with_credit BOOLEAN NOT NULL DEFAULT FALSE;

-- waiting = collecting riders before single-vehicle dispatch
DO $$ BEGIN
  ALTER TABLE share_pools DROP CONSTRAINT IF EXISTS share_pools_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE share_pools DROP CONSTRAINT IF EXISTS share_pools_status_check;
ALTER TABLE share_pools
  ADD CONSTRAINT share_pools_status_check
  CHECK (status IN ('open', 'waiting', 'matching', 'full', 'en_route', 'completed', 'cancelled'));

UPDATE share_pools
SET match_after = COALESCE(match_after, created_at + INTERVAL '3 minutes'),
    matching_started_at = COALESCE(matching_started_at, created_at)
WHERE match_after IS NULL;

INSERT INTO platform_settings (key, value)
VALUES (
  'share_pool_dispatch',
  '{"waitSeconds":180,"maxRiders":3,"equalFareSplit":true}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
