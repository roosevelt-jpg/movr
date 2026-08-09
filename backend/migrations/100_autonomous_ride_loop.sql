-- Phase 1 autonomous ride loop: offer / reassign tracking on rides
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS offered_driver_id UUID,
  ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assign_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offered_driver_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_reassign_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unmatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rides_offered_at
  ON rides (offered_at)
  WHERE offered_driver_id IS NOT NULL AND status IN ('requested', 'searching', 'pending', 'offered');

CREATE INDEX IF NOT EXISTS idx_rides_autonomy_noshow
  ON rides (accepted_at)
  WHERE driver_id IS NOT NULL AND status IN ('accepted', 'arrived', 'en_route', 'driver_arrived');
