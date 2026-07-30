"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.io = exports.app = void 0;
// backend/src/index-v2.ts - Clean MOVR Backend Implementation
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const winston_1 = __importDefault(require("winston"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ============================================
// LOGGER CONFIGURATION
// ============================================
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'movr-backend' },
    transports: [
        new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'combined.log' }),
        ...(process.env.NODE_ENV !== 'production'
            ? [new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp }) => {
                        return `${timestamp} [${level}]: ${message}`;
                    }))
                })]
            : [])
    ]
});
exports.logger = logger;
// ============================================
// EXPRESS APP INITIALIZATION
// ============================================
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});
exports.io = io;
// ============================================
// MIDDLEWARE
// ============================================
// Security middleware
app.use((0, helmet_1.default)());
// CORS
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
    credentials: true
}));
// Body parser
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests, please try again later'
});
app.use(limiter);
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});
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
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
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
// In-memory storage for MVP
const users = new Map();
const rides = new Map();
const sessions = new Map();
// ============================================
// MOCK SERVICES
// ============================================
const services = {
    calculateFare: (distance, duration, rideType) => {
        const baseRate = 50; // NGN
        const perKm = 15;
        const perMin = 2;
        const multiplier = rideType === 'premium' ? 1.5 : 1;
        return Math.round((baseRate + (distance * perKm) + (duration * perMin)) * multiplier);
    },
    findNearbyDrivers: (lat, lng, count = 5) => {
        const drivers = Array.from(users.values()).filter(u => u.userType === 'driver' && u.verified);
        return drivers.slice(0, count);
    },
    notifyDrivers: (drivers, rideData) => {
        io.emit('ride:new-request', rideData);
        logger.info(`Notified ${drivers.length} drivers`);
    }
};
// ============================================
// ROUTES: AUTHENTICATION
// ============================================
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        const { email, phone, name, password, userType } = req.body;
        if (!email || !phone || !name || !userType) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields'
            });
        }
        const userId = 'user_' + Math.random().toString(36).substr(2, 9);
        const user = {
            id: userId,
            email,
            phone,
            name,
            userType,
            verified: false
        };
        users.set(userId, user);
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ id: userId, email, userType }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.status(201).json({
            status: 'success',
            message: 'Account created successfully',
            data: {
                userId,
                email,
                token
            }
        });
    }
    catch (error) {
        logger.error('Signup error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Signup failed'
        });
    }
});
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password required'
            });
        }
        // Find user by email (mock)
        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, userType: user.userType }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.status(200).json({
            status: 'success',
            data: {
                userId: user.id,
                email: user.email,
                name: user.name,
                userType: user.userType,
                token
            }
        });
    }
    catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Login failed'
        });
    }
});
// ============================================
// ROUTES: RIDES
// ============================================
app.post('/api/v1/rides/request', authenticateToken, async (req, res) => {
    try {
        const { pickupLat, pickupLng, dropoffLat, dropoffLng, rideType = 'standard' } = req.body;
        const customerId = req.user?.id;
        if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required location fields'
            });
        }
        // Calculate distance (simplified)
        const distance = Math.sqrt(Math.pow(dropoffLat - pickupLat, 2) + Math.pow(dropoffLng - pickupLng, 2)) * 111;
        const duration = Math.ceil(distance * 2);
        const estimatedFare = services.calculateFare(distance, duration, rideType);
        const rideId = 'ride_' + Math.random().toString(36).substr(2, 9);
        const ride = {
            id: rideId,
            customerId: customerId,
            pickupLat,
            pickupLng,
            dropoffLat,
            dropoffLng,
            status: 'pending',
            estimatedFare,
            rideType,
            createdAt: new Date()
        };
        rides.set(rideId, ride);
        // Notify nearby drivers
        const nearbyDrivers = services.findNearbyDrivers(pickupLat, pickupLng);
        services.notifyDrivers(nearbyDrivers, {
            rideId,
            pickupLat,
            pickupLng,
            dropoffLat,
            dropoffLng,
            estimatedFare,
            rideType
        });
        res.status(201).json({
            status: 'success',
            message: 'Ride requested successfully',
            data: {
                rideId,
                estimatedFare,
                estimatedDistance: distance.toFixed(2),
                estimatedDuration: duration,
                driversNotified: nearbyDrivers.length
            }
        });
    }
    catch (error) {
        logger.error('Ride request error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to request ride'
        });
    }
});
app.get('/api/v1/rides/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const ride = rides.get(id);
        if (!ride) {
            return res.status(404).json({
                status: 'error',
                message: 'Ride not found'
            });
        }
        res.status(200).json({
            status: 'success',
            data: ride
        });
    }
    catch (error) {
        logger.error('Get ride error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get ride'
        });
    }
});
app.get('/api/v1/rides', authenticateToken, async (req, res) => {
    try {
        const customerId = req.user?.id;
        const userRides = Array.from(rides.values()).filter(r => r.customerId === customerId);
        res.status(200).json({
            status: 'success',
            data: userRides
        });
    }
    catch (error) {
        logger.error('Get rides error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get rides'
        });
    }
});
// ============================================
// ROUTES: MARKETPLACE (STUBS)
// ============================================
app.get('/api/v1/marketplace/stores', async (req, res) => {
    res.json({ status: 'success', data: [] });
});
app.get('/api/v1/marketplace/products', async (req, res) => {
    res.json({ status: 'success', data: [] });
});
app.post('/api/v1/marketplace/orders', authenticateToken, async (req, res) => {
    res.status(201).json({ status: 'success', message: 'Order created' });
});
// ============================================
// ROUTES: WALLET (STUBS)
// ============================================
app.get('/api/v1/wallet/balance', authenticateToken, async (req, res) => {
    res.json({ status: 'success', data: { balance: 0, currency: 'NGN' } });
});
app.post('/api/v1/wallet/topup', authenticateToken, async (req, res) => {
    res.status(201).json({ status: 'success', message: 'Top-up initiated' });
});
// ============================================
// HEALTH & ROOT ROUTES
// ============================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'MOVR Platform API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/v1/auth',
            rides: '/api/v1/rides',
            marketplace: '/api/v1/marketplace',
            wallet: '/api/v1/wallet'
        }
    });
});
// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found',
        path: req.path
    });
});
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
});
// ============================================
// SOCKET.IO EVENTS
// ============================================
io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);
    socket.on('location:update', (data) => {
        io.emit('location:updated', { ...data, timestamp: Date.now() });
    });
    socket.on('ride:status', (data) => {
        io.emit('ride:status-changed', { ...data, timestamp: Date.now() });
    });
    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});
// ============================================
// SERVER START
// ============================================
const PORT = process.env.APP_PORT || 3000;
async function startServer() {
    try {
        logger.info('Initializing MOVR Platform Backend...');
        server.listen(PORT, () => {
            logger.info(`
╔═══════════════════════════════════════╗
║   MOVR Platform Backend Running       ║
╠═══════════════════════════════════════╣
║ Port: ${PORT}
║ Environment: ${process.env.NODE_ENV || 'development'}
║ API: http://localhost:${PORT}
║ Health: http://localhost:${PORT}/health
╚═══════════════════════════════════════╝
      `);
        });
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map