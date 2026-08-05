-- Enable all remaining gated feature flags (token/staking are env-gated)
-- Rollback: set enabled=FALSE for keys you want off again

UPDATE feature_flags
SET
  enabled = TRUE,
  rollout_pct = GREATEST(COALESCE(rollout_pct, 0), 100),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'rolloutLabel', '100% · enabled'
  ),
  updated_at = NOW()
WHERE enabled = FALSE OR COALESCE(rollout_pct, 0) < 100;

-- Ensure known product flags exist and are on
INSERT INTO feature_flags (key, enabled, rollout_pct, metadata)
VALUES
  (
    'cross_border_transfers',
    TRUE,
    100,
    jsonb_build_object(
      'label', 'Cross-border transfers',
      'phase', 'Phase 27',
      'rolloutLabel', '100% · enabled'
    )
  ),
  (
    'trip_recording',
    TRUE,
    100,
    jsonb_build_object(
      'label', 'In-trip camera recording',
      'phase', 'Phase 28',
      'rolloutLabel', '100% · enabled',
      'retentionHours', 72
    )
  ),
  (
    'self_drive_rentals',
    TRUE,
    100,
    jsonb_build_object(
      'label', 'Self-drive rentals',
      'phase', 'Phase 15',
      'rolloutLabel', '100% · enabled'
    )
  ),
  (
    'voice_booking',
    TRUE,
    100,
    jsonb_build_object(
      'label', 'Voice booking',
      'phase', 'Phase 23',
      'rolloutLabel', '100% · enabled'
    )
  ),
  (
    'ussd_booking',
    TRUE,
    100,
    jsonb_build_object(
      'label', 'USSD booking',
      'phase', 'Phase 22',
      'rolloutLabel', '100% · enabled'
    )
  )
ON CONFLICT (key) DO UPDATE SET
  enabled = TRUE,
  rollout_pct = 100,
  metadata = feature_flags.metadata || EXCLUDED.metadata,
  updated_at = NOW();
