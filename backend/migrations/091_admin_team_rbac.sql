-- 091: Admin team RBAC — permissions catalog, role map, invites

CREATE TABLE IF NOT EXISTS admin_permissions (
  key VARCHAR(64) PRIMARY KEY,
  label VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role VARCHAR(64) NOT NULL,
  permission_key VARCHAR(64) NOT NULL REFERENCES admin_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

CREATE TABLE IF NOT EXISTS admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  token_hash TEXT NOT NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invites_pending_email
  ON admin_invites (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_invites_token_hash ON admin_invites (token_hash);

-- Ensure admin_roles exists (from 037)
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Permission catalog
INSERT INTO admin_permissions (key, label, category, description) VALUES
  ('team.view', 'View team', 'team', 'List admins and pending invites'),
  ('team.manage', 'Manage team', 'team', 'Invite admins, assign roles, revoke access'),
  ('overview.view', 'View dashboard', 'overview', 'Ops overview and live map'),
  ('analytics.view', 'View analytics', 'overview', 'Platform analytics'),
  ('rides.manage', 'Manage rides', 'operations', 'Ride queue, dispatch, ride ops'),
  ('orders.manage', 'Manage orders', 'operations', 'Deliveries and marketplace orders'),
  ('users.view', 'View users', 'users', 'Customers, drivers, merchants lists'),
  ('users.manage', 'Manage users', 'users', 'Suspend, message, KYC actions'),
  ('kyc.review', 'Review KYC', 'users', 'KYC queue and identity review'),
  ('finance.view', 'View finance', 'finance', 'GMV, settlements, transactions'),
  ('finance.manage', 'Manage finance', 'finance', 'Process payouts and settlements'),
  ('tokens.view', 'View tokens', 'finance', 'DVT overview and claims'),
  ('cms.manage', 'Manage site content', 'platform', 'CMS pages and media'),
  ('settings.manage', 'Manage settings', 'platform', 'Feature flags, integrations, payments, pricing'),
  ('audit.view', 'View audit log', 'platform', 'Read administrative audit trail'),
  ('broadcasts.manage', 'Manage broadcasts', 'operations', 'Push/SMS/email broadcasts'),
  ('subscriptions.manage', 'Manage subscription fees', 'platform', 'Subscription fee matrix')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Role → permission map
-- super_admin: everything
INSERT INTO admin_role_permissions (role, permission_key)
SELECT 'super_admin', key FROM admin_permissions
ON CONFLICT DO NOTHING;

-- ops: day-to-day operations
INSERT INTO admin_role_permissions (role, permission_key)
SELECT 'ops', v.key
FROM (VALUES
  ('team.view'),
  ('overview.view'),
  ('analytics.view'),
  ('rides.manage'),
  ('orders.manage'),
  ('users.view'),
  ('users.manage'),
  ('broadcasts.manage'),
  ('audit.view')
) AS v(key)
ON CONFLICT DO NOTHING;

-- trust_and_safety
INSERT INTO admin_role_permissions (role, permission_key)
SELECT 'trust_and_safety', v.key
FROM (VALUES
  ('overview.view'),
  ('users.view'),
  ('users.manage'),
  ('kyc.review'),
  ('rides.manage'),
  ('audit.view')
) AS v(key)
ON CONFLICT DO NOTHING;

-- finance
INSERT INTO admin_role_permissions (role, permission_key)
SELECT 'finance', v.key
FROM (VALUES
  ('overview.view'),
  ('finance.view'),
  ('finance.manage'),
  ('tokens.view'),
  ('subscriptions.manage'),
  ('audit.view')
) AS v(key)
ON CONFLICT DO NOTHING;

-- support
INSERT INTO admin_role_permissions (role, permission_key)
SELECT 'support', v.key
FROM (VALUES
  ('overview.view'),
  ('users.view'),
  ('orders.manage'),
  ('rides.manage'),
  ('kyc.review')
) AS v(key)
ON CONFLICT DO NOTHING;

-- content
INSERT INTO admin_role_permissions (role, permission_key)
SELECT 'content', v.key
FROM (VALUES
  ('overview.view'),
  ('cms.manage')
) AS v(key)
ON CONFLICT DO NOTHING;

-- Backfill: every admin gets trust_and_safety if they have no roles
INSERT INTO admin_roles (user_id, role)
SELECT u.id, 'trust_and_safety'
FROM users u
WHERE u.user_type = 'admin'
  AND NOT EXISTS (SELECT 1 FROM admin_roles ar WHERE ar.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Promote primary seed admin to super_admin
INSERT INTO admin_roles (user_id, role)
SELECT u.id, 'super_admin'
FROM users u
WHERE u.user_type = 'admin'
  AND (
    lower(u.email) = 'admin@movr.app'
    OR u.phone = '+233200000001'
  )
ON CONFLICT DO NOTHING;

COMMENT ON TABLE admin_permissions IS 'Fine-grained admin permissions catalog';
COMMENT ON TABLE admin_role_permissions IS 'Maps admin_roles.role strings to permissions';
COMMENT ON TABLE admin_invites IS 'Pending/accepted admin team invites';
