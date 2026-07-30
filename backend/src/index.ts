// backend/src/index-v2.ts - Clean MOVR Backend Implementation
require('dotenv/config');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const jwt = require('jsonwebtoken');

type Request = any;
type Response = any;
type NextFunction = any;
type Express = any;

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
// EXPRESS APP INITIALIZATION
// ============================================
const app: Express = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
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
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
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
// AUTH MIDDLEWARE
// ============================================
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    userType: string;
  };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
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

// ============================================
// SIMULATED DATABASE & SERVICES
// ============================================
interface User {
  id: string;
  email: string;
  userType: 'customer' | 'driver' | 'merchant' | 'admin';
  phone: string;
  name: string;
  verified: boolean;
}

interface Ride {
  id: string;
  customerId: string;
  driverId?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  estimatedFare: number;
  actualFare?: number;
  rideType: string;
  createdAt: Date;
  completedAt?: Date;
}

// In-memory storage for MVP
const users: Map<string, User> = new Map();
const rides: Map<string, Ride> = new Map();
const sessions: Map<string, { token: string; expires: number }> = new Map();

// ============================================
// MOCK SERVICES
// ============================================
const services = {
  calculateFare: (distance: number, duration: number, rideType: string): number => {
    const baseRate = 50; // NGN
    const perKm = 15;
    const perMin = 2;
    const multiplier = rideType === 'premium' ? 1.5 : 1;
    return Math.round((baseRate + (distance * perKm) + (duration * perMin)) * multiplier);
  },

  findNearbyDrivers: (lat: number, lng: number, count: number = 5): User[] => {
    const drivers = Array.from(users.values()).filter(u => u.userType === 'driver' && u.verified);
    return drivers.slice(0, count);
  },

  notifyDrivers: (drivers: User[], rideData: any) => {
    io.emit('ride:new-request', rideData);
    logger.info(`Notified ${drivers.length} drivers`);
  }
};

// ============================================
// ROUTES: AUTHENTICATION
// ============================================
app.post('/api/v1/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, phone, name, password, userType } = req.body;

    if (!email || !phone || !name || !userType) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }

    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    const user: User = {
      id: userId,
      email,
      phone,
      name,
      userType,
      verified: false
    };

    users.set(userId, user);

    // Generate JWT
    const token = jwt.sign(
      { id: userId, email, userType },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: {
        userId,
        email,
        token
      }
    });
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Signup failed'
    });
  }
});

app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
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

    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

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
  } catch (error) {
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
app.post('/api/v1/rides/request', authenticateToken, async (req: AuthRequest, res: Response) => {
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
    const distance = Math.sqrt(
      Math.pow(dropoffLat - pickupLat, 2) + Math.pow(dropoffLng - pickupLng, 2)
    ) * 111;
    const duration = Math.ceil(distance * 2);

    const estimatedFare = services.calculateFare(distance, duration, rideType);

    const rideId = 'ride_' + Math.random().toString(36).substr(2, 9);
    const ride: Ride = {
      id: rideId,
      customerId: customerId!,
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
  } catch (error) {
    logger.error('Ride request error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to request ride'
    });
  }
});

app.get('/api/v1/rides/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    logger.error('Get ride error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get ride'
    });
  }
});

app.get('/api/v1/rides', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.user?.id;
    const userRides = Array.from(rides.values()).filter(r => r.customerId === customerId);

    res.status(200).json({
      status: 'success',
      data: userRides
    });
  } catch (error) {
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
app.get('/api/v1/marketplace/stores', async (req: Request, res: Response) => {
  res.json({ status: 'success', data: [] });
});

app.get('/api/v1/marketplace/products', async (req: Request, res: Response) => {
  res.json({ status: 'success', data: [] });
});

app.post('/api/v1/marketplace/orders', authenticateToken, async (req: Request, res: Response) => {
  res.status(201).json({ status: 'success', message: 'Order created' });
});

// ============================================
// ROUTES: WALLET (STUBS)
// ============================================
app.get('/api/v1/wallet/balance', authenticateToken, async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { balance: 0, currency: 'NGN' } });
});

app.post('/api/v1/wallet/topup', authenticateToken, async (req: Request, res: Response) => {
  res.status(201).json({ status: 'success', message: 'Top-up initiated' });
});

// ============================================
// HEALTH & ROOT ROUTES
// ============================================
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

app.get('/', (req: Request, res: Response) => {
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
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
module.exports = { app, io, logger };
