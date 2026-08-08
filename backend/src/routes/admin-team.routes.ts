import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
  requirePermission,
  loadAdminRoles,
  loadPermissionsForRoles,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';

const db = new DatabaseService();

export const adminTeamRouter = Router();

const KNOWN_ROLES = [
  'super_admin',
  'ops',
  'trust_and_safety',
  'finance',
  'support',
  'content',
] as const;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

async function audit(
  adminId: string | undefined,
  action: string,
  resourceId: string | null,
  metadata: Record<string, unknown>
) {
  await db
    .query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, 'admin_team', $3, $4::jsonb)`,
      [adminId || null, action, resourceId, JSON.stringify(metadata)]
    )
    .catch(() => undefined);
}

/** Catalog of roles + permissions (for invite UI). */
adminTeamRouter.get(
  '/team/catalog',
  authenticateToken,
  requireAdmin,
  requirePermission('team.view', 'team.manage'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const perms = await db.query(
        `SELECT key, label, category, description FROM admin_permissions ORDER BY category, key`
      );
      const map = await db.query(
        `SELECT role, permission_key FROM admin_role_permissions ORDER BY role, permission_key`
      );
      const byRole: Record<string, string[]> = {};
      for (const row of map.rows) {
        byRole[row.role] = byRole[row.role] || [];
        byRole[row.role].push(row.permission_key);
      }
      res.json({
        status: 'success',
        data: {
          roles: KNOWN_ROLES.map((role) => ({
            id: role,
            label: role.replace(/_/g, ' '),
            permissions: byRole[role] || [],
          })),
          permissions: perms.rows,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** Current admin's roles + permissions. */
adminTeamRouter.get(
  '/team/me',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const roles = await loadAdminRoles(req.user!.id);
      const permissions = await loadPermissionsForRoles(roles);
      res.json({
        status: 'success',
        data: {
          id: req.user!.id,
          email: req.user!.email,
          roles,
          permissions,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** List admin users with roles. */
adminTeamRouter.get(
  '/team/admins',
  authenticateToken,
  requireAdmin,
  requirePermission('team.view', 'team.manage'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.query(
        `SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.is_active, u.created_at,
                COALESCE(
                  (SELECT array_agg(ar.role ORDER BY ar.role) FROM admin_roles ar WHERE ar.user_id = u.id),
                  '{}'::text[]
                ) AS roles
         FROM users u
         WHERE u.user_type = 'admin'
         ORDER BY u.created_at ASC`
      );
      res.json({ status: 'success', data: rows.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** List pending invites. */
adminTeamRouter.get(
  '/team/invites',
  authenticateToken,
  requireAdmin,
  requirePermission('team.view', 'team.manage'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await db.query(
        `SELECT i.id, i.email, i.roles, i.expires_at, i.created_at, i.accepted_at, i.revoked_at,
                u.email AS invited_by_email
         FROM admin_invites i
         LEFT JOIN users u ON u.id = i.invited_by
         WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL
         ORDER BY i.created_at DESC`
      );
      res.json({ status: 'success', data: rows.rows });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** Invite a new admin (or promote existing user to admin on accept). */
adminTeamRouter.post(
  '/team/invites',
  authenticateToken,
  requireAdmin,
  requirePermission('team.manage'),
  async (req: AuthRequest, res: Response) => {
    try {
      const email = normalizeEmail(req.body.email);
      const roles: string[] = Array.isArray(req.body.roles)
        ? req.body.roles.map(String).filter((r) => (KNOWN_ROLES as readonly string[]).includes(r))
        : [];
      if (!email || !email.includes('@')) {
        return res.status(400).json({ status: 'error', message: 'Valid email required' });
      }
      if (!roles.length) {
        return res.status(400).json({ status: 'error', message: 'Select at least one role' });
      }
      if (roles.includes('super_admin')) {
        const mine = await loadAdminRoles(req.user!.id);
        if (!mine.includes('super_admin')) {
          return res.status(403).json({
            status: 'error',
            message: 'Only super_admin can grant super_admin',
          });
        }
      }

      const existing = await db.query(
        `SELECT id, user_type FROM users WHERE lower(email) = $1 LIMIT 1`,
        [email]
      );
      if (existing.rows[0]?.user_type === 'admin') {
        return res.status(400).json({
          status: 'error',
          message: 'This email is already an admin — edit their roles instead',
        });
      }

      // Revoke any prior pending invite for this email
      await db.query(
        `UPDATE admin_invites SET revoked_at = NOW()
         WHERE lower(email) = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
        [email]
      );

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const days = Math.min(30, Math.max(1, Number(req.body.expiresInDays) || 7));
      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const inserted = await db.query(
        `INSERT INTO admin_invites (email, roles, token_hash, invited_by, expires_at)
         VALUES ($1, $2::text[], $3, $4, $5)
         RETURNING id, email, roles, expires_at, created_at`,
        [email, roles, tokenHash, req.user!.id, expires]
      );

      await audit(req.user!.id, 'admin_invite.create', inserted.rows[0].id, {
        email,
        roles,
      });

      const acceptPath = `/admin/invite/accept?token=${rawToken}`;
      res.status(201).json({
        status: 'success',
        data: {
          invite: inserted.rows[0],
          /** Raw token returned once for sharing (email delivery optional). */
          inviteToken: rawToken,
          acceptUrl: acceptPath,
          acceptAbsoluteUrl: `${(process.env.ADMIN_URL || 'http://localhost:3002').replace(/\/$/, '')}/admin/invite/accept?token=${rawToken}`,
        },
        message: 'Invite created — share the accept link with the teammate',
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** Revoke a pending invite. */
adminTeamRouter.post(
  '/team/invites/:id/revoke',
  authenticateToken,
  requireAdmin,
  requirePermission('team.manage'),
  async (req: AuthRequest, res: Response) => {
    try {
      const row = await db.query(
        `UPDATE admin_invites SET revoked_at = NOW()
         WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
         RETURNING id, email`,
        [req.params.id]
      );
      if (!row.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Invite not found' });
      }
      await audit(req.user!.id, 'admin_invite.revoke', row.rows[0].id, {
        email: row.rows[0].email,
      });
      res.json({ status: 'success', data: row.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** Preview invite (public). */
adminTeamRouter.get('/team/invites/preview', async (req: any, res: Response) => {
  try {
    const token = String(req.query.token || '');
    if (!token) {
      return res.status(400).json({ status: 'error', message: 'token required' });
    }
    const row = await db.query(
      `SELECT email, roles, expires_at, accepted_at, revoked_at
       FROM admin_invites WHERE token_hash = $1 LIMIT 1`,
      [hashToken(token)]
    );
    const invite = row.rows[0];
    if (!invite) {
      return res.status(404).json({ status: 'error', message: 'Invite not found' });
    }
    if (invite.revoked_at) {
      return res.status(410).json({ status: 'error', message: 'Invite was revoked' });
    }
    if (invite.accepted_at) {
      return res.status(410).json({ status: 'error', message: 'Invite already accepted' });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ status: 'error', message: 'Invite expired' });
    }
    res.json({
      status: 'success',
      data: { email: invite.email, roles: invite.roles, expiresAt: invite.expires_at },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Accept invite (public) — creates/updates admin user + roles. */
adminTeamRouter.post('/team/invites/accept', async (req: any, res: Response) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    const firstName = String(req.body.firstName || req.body.first_name || '').trim() || 'Admin';
    const lastName = String(req.body.lastName || req.body.last_name || '').trim() || 'User';
    if (!token || password.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid invite token and password (8+ chars) required',
      });
    }

    const row = await db.query(
      `SELECT * FROM admin_invites WHERE token_hash = $1 LIMIT 1`,
      [hashToken(token)]
    );
    const invite = row.rows[0];
    if (!invite || invite.revoked_at || invite.accepted_at) {
      return res.status(410).json({ status: 'error', message: 'Invite is no longer valid' });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ status: 'error', message: 'Invite expired' });
    }

    const email = normalizeEmail(invite.email);
    const hash = await bcrypt.hash(password, 10);
    const existing = await db.query(
      `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );

    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await db.query(
        `UPDATE users SET
           password = $1,
           user_type = 'admin',
           first_name = COALESCE(NULLIF($2, ''), first_name),
           last_name = COALESCE(NULLIF($3, ''), last_name),
           is_active = TRUE,
           is_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW()),
           updated_at = NOW()
         WHERE id = $4`,
        [hash, firstName, lastName, userId]
      );
    } else {
      const created = await db.query(
        `INSERT INTO users (
           email, first_name, last_name, password, user_type, country, city,
           is_active, is_verified, email_verified_at
         ) VALUES ($1, $2, $3, $4, 'admin', 'GH', 'Accra', TRUE, TRUE, NOW())
         RETURNING id`,
        [email, firstName, lastName, hash]
      );
      userId = created.rows[0].id;
    }

    await db.query(`DELETE FROM admin_roles WHERE user_id = $1`, [userId]);
    const roles: string[] = invite.roles || [];
    for (const role of roles) {
      await db.query(
        `INSERT INTO admin_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, role]
      );
    }

    await db.query(
      `UPDATE admin_invites SET accepted_at = NOW() WHERE id = $1`,
      [invite.id]
    );

    await audit(invite.invited_by, 'admin_invite.accept', invite.id, {
      email,
      userId,
      roles,
    });

    res.status(201).json({
      status: 'success',
      data: { userId, email, roles },
      message: 'Invite accepted — you can sign in to the admin console',
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Replace roles for an admin. */
adminTeamRouter.put(
  '/team/admins/:id/roles',
  authenticateToken,
  requireAdmin,
  requirePermission('team.manage'),
  async (req: AuthRequest, res: Response) => {
    try {
      const targetId = req.params.id;
      const roles: string[] = Array.isArray(req.body.roles)
        ? req.body.roles.map(String).filter((r) => (KNOWN_ROLES as readonly string[]).includes(r))
        : [];

      const target = await db.query(
        `SELECT id, email, user_type FROM users WHERE id = $1 LIMIT 1`,
        [targetId]
      );
      if (!target.rows[0] || target.rows[0].user_type !== 'admin') {
        return res.status(404).json({ status: 'error', message: 'Admin not found' });
      }

      if (roles.includes('super_admin')) {
        const mine = await loadAdminRoles(req.user!.id);
        if (!mine.includes('super_admin')) {
          return res.status(403).json({
            status: 'error',
            message: 'Only super_admin can grant super_admin',
          });
        }
      }

      // Prevent removing last super_admin
      const currentRoles = await loadAdminRoles(targetId);
      if (currentRoles.includes('super_admin') && !roles.includes('super_admin')) {
        const supers = await db.query(
          `SELECT COUNT(*)::int AS n FROM admin_roles WHERE role = 'super_admin'`
        );
        if (Number(supers.rows[0]?.n || 0) <= 1) {
          return res.status(400).json({
            status: 'error',
            message: 'Cannot remove the last super_admin',
          });
        }
      }

      await db.query(`DELETE FROM admin_roles WHERE user_id = $1`, [targetId]);
      for (const role of roles) {
        await db.query(
          `INSERT INTO admin_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [targetId, role]
        );
      }

      await audit(req.user!.id, 'admin_roles.update', targetId, {
        email: target.rows[0].email,
        roles,
      });

      res.json({
        status: 'success',
        data: { id: targetId, roles },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** Activate / deactivate an admin account. */
adminTeamRouter.post(
  '/team/admins/:id/status',
  authenticateToken,
  requireAdmin,
  requirePermission('team.manage'),
  async (req: AuthRequest, res: Response) => {
    try {
      const active = Boolean(req.body.isActive ?? req.body.is_active);
      if (req.params.id === req.user!.id && !active) {
        return res.status(400).json({ status: 'error', message: 'Cannot deactivate yourself' });
      }
      const target = await db.query(
        `SELECT id, email, user_type FROM users WHERE id = $1 AND user_type = 'admin' LIMIT 1`,
        [req.params.id]
      );
      if (!target.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Admin not found' });
      }

      if (!active) {
        const roles = await loadAdminRoles(req.params.id);
        if (roles.includes('super_admin')) {
          const supers = await db.query(
            `SELECT COUNT(*)::int AS n FROM admin_roles WHERE role = 'super_admin'`
          );
          if (Number(supers.rows[0]?.n || 0) <= 1) {
            return res.status(400).json({
              status: 'error',
              message: 'Cannot deactivate the last super_admin',
            });
          }
        }
      }

      await db.query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, [
        active,
        req.params.id,
      ]);
      await audit(req.user!.id, active ? 'admin.activate' : 'admin.deactivate', req.params.id, {
        email: target.rows[0].email,
      });
      res.json({ status: 'success', data: { id: req.params.id, isActive: active } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);
