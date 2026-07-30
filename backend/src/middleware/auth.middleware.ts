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

    jwt.verify(token, process.env.JWT_SECRET || '', (err: any, user: any) => {
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
