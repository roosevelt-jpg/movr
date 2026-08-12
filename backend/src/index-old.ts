// backend/src/index.ts - Main Application Entry Point
import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as Sentry from '@sentry/node';
import winston from 'winston';

// Import routes
import authRoutes from './routes/auth.routes';
import rideRoutes from './routes/rides.routes';
import userRoutes from './routes/users.routes';
import paymentRoutes from './routes/payments.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import subscriptionRoutes from './routes/subscriptions.routes';
import walletRoutes from './routes/wallet.routes';
import rewardsRoutes from './routes/rewards.routes';
import driverRoutes from './routes/drivers.routes';
import adminRoutes from './routes/admin.routes';
import blockchainRoutes from './routes/blockchain.routes';

// Import services
import { DatabaseService } from './services/database.service';
import { RedisService } from './services/redis.service';
import { RealTimeService } from './services/realtime.service';
import { NotificationService } from './services/notification.service';
import { PaymentService } from './services/payment.service';
import { MatchingEngineService } from './services/matching-engine.service';

// ============================================
// LOGGER CONFIGURATION
// ============================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'movr-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    ...(process.env.NODE_ENV !== 'production'
      ? [new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp }) => {
              return `${timestamp} [${level}]: ${message}`;
            })
          )
        })]
      : [])
  ]
});

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
const app: Express = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ============================================
// MIDDLEWARE
// ============================================

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
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
app.use((req: Request, res: Response, next: NextFunction) => {
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
  private db: DatabaseService;
  private redis: RedisService;
  private realtime: RealTimeService;
  private notifications: NotificationService;
  private payments: PaymentService;
  private matching: MatchingEngineService;

  async initialize() {
    logger.info('🚀 Initializing MOVR Platform...');

    try {
      // Database
      this.db = new DatabaseService();
      await this.db.connect();
      logger.info('✅ Database connected');

      // Redis
      this.redis = new RedisService();
      await this.redis.connect();
      logger.info('✅ Redis connected');

      // Real-time service
      this.realtime = new RealTimeService(io);
      await this.realtime.initialize();
      logger.info('✅ Real-time service initialized');

      // Notification service
      this.notifications = new NotificationService(this.db, this.redis);
      await this.notifications.initialize();
      logger.info('✅ Notification service initialized');

      // Payment service
      this.payments = new PaymentService(this.db);
      await this.payments.initialize();
      logger.info('✅ Payment service initialized');

      // Matching engine
      this.matching = new MatchingEngineService(this.db, this.redis, this.realtime);
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
    } catch (error) {
      logger.error('❌ Initialization failed:', error);
      throw error;
    }
  }
}

// ============================================
// ROUTES
// ============================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/rewards', rewardsRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/blockchain', blockchainRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'MOVR Platform API',
    version: '1.0.0',
    status: 'running',
    docs: 'https://docs.mymovr.io/api'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
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
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io, logger };
