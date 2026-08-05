-- Enable Phase 28 trip recording + Phase 8 custodial claims readiness
-- Rollback: UPDATE feature_flags SET enabled = FALSE WHERE key = 'trip_recording';

UPDATE feature_flags
SET
  enabled = TRUE,
  rollout_pct = 100,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'label', 'In-trip camera recording',
    'phase', 'Phase 28',
    'rolloutLabel', '100% · enabled',
    'retentionHours', COALESCE((metadata->>'retentionHours')::int, 72)
  ),
  updated_at = NOW()
WHERE key = 'trip_recording';

INSERT INTO feature_flags (key, enabled, rollout_pct, metadata)
VALUES (
  'trip_recording',
  TRUE,
  100,
  jsonb_build_object(
    'label', 'In-trip camera recording',
    'phase', 'Phase 28',
    'rolloutLabel', '100% · enabled',
    'retentionHours', 72
  )
)
ON CONFLICT (key) DO NOTHING;
