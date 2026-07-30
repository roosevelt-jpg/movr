"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireCustomer = exports.requireDriver = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    defaultMeta: { service: 'auth-middleware' }
});
/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'No authentication token provided'
            });
        }
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '', (err, user) => {
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
    }
    catch (error) {
        logger.error('Authentication error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed'
        });
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Check if user is driver
 */
const requireDriver = (req, res, next) => {
    if (!req.user || req.user.userType !== 'driver') {
        return res.status(403).json({
            status: 'error',
            message: 'Only drivers can access this resource'
        });
    }
    next();
};
exports.requireDriver = requireDriver;
/**
 * Check if user is customer
 */
const requireCustomer = (req, res, next) => {
    if (!req.user || req.user.userType !== 'customer') {
        return res.status(403).json({
            status: 'error',
            message: 'Only customers can access this resource'
        });
    }
    next();
};
exports.requireCustomer = requireCustomer;
/**
 * Check if user is admin
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({
            status: 'error',
            message: 'Admin access required'
        });
    }
    next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.middleware.js.map