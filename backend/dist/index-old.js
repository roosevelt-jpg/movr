"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.io = exports.app = void 0;
// backend/src/index.ts - Main Application Entry Point
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const Sentry = __importStar(require("@sentry/node"));
const winston_1 = __importDefault(require("winston"));
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const rides_routes_1 = __importDefault(require("./routes/rides.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const payments_routes_1 = __importDefault(require("./routes/payments.routes"));
const marketplace_routes_1 = __importDefault(require("./routes/marketplace.routes"));
const subscriptions_routes_1 = __importDefault(require("./routes/subscriptions.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const rewards_routes_1 = __importDefault(require("./routes/rewards.routes"));
const drivers_routes_1 = __importDefault(require("./routes/drivers.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const blockchain_routes_1 = __importDefault(require("./routes/blockchain.routes"));
// Import services
const database_service_1 = require("./services/database.service");
const redis_service_1 = require("./services/redis.service");
const realtime_service_1 = require("./services/realtime.service");
const notification_service_1 = require("./services/notification.service");
const payment_service_1 = require("./services/payment.service");
const matching_engine_service_1 = require("./services/matching-engine.service");
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
// SENTRY MONITORING
// ============================================
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
        serverName: process.env.APP_NAME,
    });
}
// ============================================
// EXPRESS APP INITIALIZATION
// ============================================
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
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
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
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
// Sentry request handler
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
}
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});
// ============================================
// INITIALIZE SERVICES
// ============================================
class Application {
    async initialize() {
        logger.info('🚀 Initializing MOVR Platform...');
        try {
            // Database
            this.db = new database_service_1.DatabaseService();
            await this.db.connect();
            logger.info('✅ Database connected');
            // Redis
            this.redis = new redis_service_1.RedisService();
            await this.redis.connect();
            logger.info('✅ Redis connected');
            // Real-time service
            this.realtime = new realtime_service_1.RealTimeService(io);
            await this.realtime.initialize();
            logger.info('✅ Real-time service initialized');
            // Notification service
            this.notifications = new notification_service_1.NotificationService(this.db, this.redis);
            await this.notifications.initialize();
            logger.info('✅ Notification service initialized');
            // Payment service
            this.payments = new payment_service_1.PaymentService(this.db);
            await this.payments.initialize();
            logger.info('✅ Payment service initialized');
            // Matching engine
            this.matching = new matching_engine_service_1.MatchingEngineService(this.db, this.redis, this.realtime);
            await this.matching.initialize();
            logger.info('✅ Matching engine initialized');
            // Store services in app locals for middleware access
            app.locals.db = this.db;
            app.locals.redis = this.redis;
            app.locals.realtime = this.realtime;
            app.locals.notifications = this.notifications;
            app.locals.payments = this.payments;
            app.locals.matching = this.matching;
            app.locals.logger = logger;
            return true;
        }
        catch (error) {
            logger.error('❌ Initialization failed:', error);
            throw error;
        }
    }
}
// ============================================
// ROUTES
// ============================================
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/rides', rides_routes_1.default);
app.use('/api/v1/users', users_routes_1.default);
app.use('/api/v1/payments', payments_routes_1.default);
app.use('/api/v1/marketplace', marketplace_routes_1.default);
app.use('/api/v1/subscriptions', subscriptions_routes_1.default);
app.use('/api/v1/wallet', wallet_routes_1.default);
app.use('/api/v1/rewards', rewards_routes_1.default);
app.use('/api/v1/drivers', drivers_routes_1.default);
app.use('/api/v1/admin', admin_routes_1.default);
app.use('/api/v1/blockchain', blockchain_routes_1.default);
// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});
// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'MOVR Platform API',
        version: '1.0.0',
        status: 'running',
        docs: 'https://docs.movr.io/api'
    });
});
// ============================================
// ERROR HANDLING
// ============================================
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found',
        path: req.path,
        method: req.method
    });
});
// Sentry error handler
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
}
// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({
        status: 'error',
        message,
        path: req.path,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});
// ============================================
// SOCKET.IO REAL-TIME EVENTS
// ============================================
io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);
    // Driver location updates
    socket.on('location:update', (data) => {
        const { driverId, latitude, longitude } = data;
        logger.debug(`Location update from driver ${driverId}`);
        io.emit('location:updated', { driverId, latitude, longitude, timestamp: Date.now() });
    });
    // Ride status updates
    socket.on('ride:status', (data) => {
        const { rideId, status } = data;
        io.emit('ride:status-changed', { rideId, status, timestamp: Date.now() });
    });
    // Chat messages
    socket.on('chat:message', (data) => {
        const { rideId, message, senderId } = data;
        io.emit('chat:received', { rideId, message, senderId, timestamp: Date.now() });
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
    const app_instance = new Application();
    try {
        await app_instance.initialize();
        server.listen(PORT, () => {
            logger.info(`
╔═══════════════════════════════════════╗
║   🚀 MOVR Platform Backend Running    ║
╠═══════════════════════════════════════╣
║ Port: ${PORT}
║ Environment: ${process.env.NODE_ENV || 'development'}
║ Database: Connected
║ Services: Initialized
╠═══════════════════════════════════════╣
║ API Docs: http://localhost:${PORT}/docs
║ Health: http://localhost:${PORT}/health
╚═══════════════════════════════════════╝
      `);
        });
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM signal received: closing HTTP server');
            server.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });
        });
        process.on('SIGINT', async () => {
            logger.info('SIGINT signal received: closing HTTP server');
            server.close(() => {
                logger.info('HTTP server closed');
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
//# sourceMappingURL=index-old.js.map