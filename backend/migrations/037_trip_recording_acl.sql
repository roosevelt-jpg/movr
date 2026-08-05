-- Phase 28 ACL + retention config (append-only after 036)
-- Rollback: DROP TABLE admin_roles; DELETE FROM feature_flags WHERE key = 'trip_recording';
--          ALTER TABLE drivers DROP COLUMN IF EXISTS trip_recording_consented_at;

CREATE TABLE IF NOT EXISTS admin_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role);

COMMENT ON TABLE admin_roles IS
  'Admin RBAC claims (e.g. trust_and_safety). Phase 28 recording playback requires trust_and_safety.';

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS trip_recording_consented_at TIMESTAMPTZ;

COMMENT ON COLUMN drivers.trip_recording_consented_at IS
  'Driver consented to in-cabin trip recording during onboarding (Phase 28).';

-- Feature flag OFF until privacy/legal review (Act 843 etc.)
INSERT INTO feature_flags (key, enabled, rollout_pct, metadata)
VALUES (
  'trip_recording',
  FALSE,
  0,
  jsonb_build_object(
    'label', 'In-trip camera recording',
    'phase', 'Phase 28',
    'rolloutLabel', '0% · privacy/legal review pending',
    'retentionHours', 72
  )
)
ON CONFLICT (key) DO NOTHING;

-- Grant trust_and_safety to existing admin users so T&S tooling is usable in ops
INSERT INTO admin_roles (user_id, role)
SELECT id, 'trust_and_safety'
FROM users
WHERE user_type = 'admin'
ON CONFLICT DO NOTHING;
