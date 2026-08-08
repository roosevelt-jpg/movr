// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import winston from 'winston';

const logger = winston.createLogger({
  defaultMeta: { service: 'auth-middleware' }
});

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    userType: string;
    roles?: string[];
  };
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No authentication token provided'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err: any, user: any) => {
      if (err) {
        logger.warn(`Invalid token: ${err.message}`);
        return res.status(403).json({
          status: 'error',
          message: 'Invalid or expired token'
        });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Check if user is driver
 */
export const requireDriver = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.userType !== 'driver') {
    return res.status(403).json({
      status: 'error',
      message: 'Only drivers can access this resource'
    });
  }
  next();
};

/**
 * Check if user is customer
 */
export const requireCustomer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.userType !== 'customer') {
    return res.status(403).json({
      status: 'error',
      message: 'Only customers can access this resource'
    });
  }
  next();
};

/**
 * Check if user is admin
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Require one of the given roles (userType or roles[] claim).
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const claimed = [
      req.user?.userType,
      ...(req.user?.roles || []),
    ].filter(Boolean) as string[];

    const ok = roles.some((r) => claimed.includes(r));
    if (!req.user || !ok) {
      return res.status(403).json({
        status: 'error',
        message: `Requires role: ${roles.join(' | ')}`,
      });
    }
    next();
  };
};

export const requireMerchant = requireRole('merchant');

/**
 * Phase 28 — recording playback: admin + trust_and_safety role (not general admin).
 * Loads admin_roles from DB so stale JWTs without the claim still work after migration 037.
 */
export const requireTrustAndSafety = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Admin access required',
    });
  }
  let roles = req.user.roles || [];
  if (!roles.includes('trust_and_safety') && !roles.includes('super_admin')) {
    try {
      const { DatabaseService } = await import('../services/database.service');
      const db = new DatabaseService();
      const rr = await db.query(`SELECT role FROM admin_roles WHERE user_id = $1`, [req.user.id]);
      roles = rr.rows.map((r: any) => r.role);
      req.user.roles = roles;
    } catch {
      /* keep JWT roles */
    }
  }
  if (!roles.includes('trust_and_safety') && !roles.includes('super_admin')) {
    return res.status(403).json({
      status: 'error',
      message: 'trust-and-safety role required',
    });
  }
  next();
};

/** Load roles for an admin from DB (and cache on req.user). */
export async function loadAdminRoles(userId: string): Promise<string[]> {
  const { DatabaseService } = await import('../services/database.service');
  const db = new DatabaseService();
  const rr = await db.query(`SELECT role FROM admin_roles WHERE user_id = $1`, [userId]);
  return rr.rows.map((r: any) => String(r.role));
}

/** Resolve permission keys for a set of roles. super_admin → all permissions. */
export async function loadPermissionsForRoles(roles: string[]): Promise<string[]> {
  if (!roles.length) return [];
  const { DatabaseService } = await import('../services/database.service');
  const db = new DatabaseService();
  if (roles.includes('super_admin')) {
    const all = await db.query(`SELECT key FROM admin_permissions ORDER BY key`);
    return all.rows.map((r: any) => String(r.key));
  }
  const rr = await db.query(
    `SELECT DISTINCT permission_key AS key
     FROM admin_role_permissions
     WHERE role = ANY($1::text[])
     ORDER BY permission_key`,
    [roles]
  );
  return rr.rows.map((r: any) => String(r.key));
}

/**
 * Require at least one of the given permissions.
 * Reloads roles from DB when JWT claims may be stale.
 */
export const requirePermission = (...perms: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required',
      });
    }
    try {
      let roles = req.user.roles || [];
      if (!roles.length || !roles.includes('super_admin')) {
        roles = await loadAdminRoles(req.user.id);
        req.user.roles = roles;
      }
      const permissions = await loadPermissionsForRoles(roles);
      (req.user as any).permissions = permissions;
      const ok = perms.some((p) => permissions.includes(p));
      if (!ok) {
        return res.status(403).json({
          status: 'error',
          message: `Requires permission: ${perms.join(' | ')}`,
        });
      }
      next();
    } catch (error: any) {
      logger.error('requirePermission failed', { error: error?.message });
      return res.status(500).json({ status: 'error', message: 'Permission check failed' });
    }
  };
};
