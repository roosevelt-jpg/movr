// backend/src/index-v2.ts - Clean MOVR Backend Implementation
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config(); // optional backend/.env overrides
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DatabaseService } = require('./services/database.service');
const authDb = new DatabaseService();

// Avoid clashing with Node/undici global Request/Response (TS2300)
type ExpressRequest = any;
type ExpressResponse = any;
type ExpressNextFunction = any;
type ExpressApp = any;

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
const DEFAULT_CORS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
];

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) || DEFAULT_CORS;

const app: ExpressApp = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
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
  origin: corsOrigins,
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting (generous defaults for local/dev; override via env in production)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});
app.use(limiter);

// Request logging middleware
app.use((req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Phase 0A / 0C routers (payment providers + integrations hub)
const {
  paymentWebhooksRouter,
  adminPaymentProvidersRouter,
  paymentsRouter,
} = require('./routes/payment.routes');
const { adminIntegrationsRouter } = require('./routes/admin-integrations.routes');
const { walletRouter } = require('./routes/wallet.routes');

app.use('/webhooks', paymentWebhooksRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/admin/payment-providers', adminPaymentProvidersRouter);
app.use('/api/v1/admin/integrations', adminIntegrationsRouter);
app.use('/api/v1/wallet', walletRouter);

const { storesRouter, cartRouter, ordersRouter } = require('./routes/stores.routes');
const { merchantRouter } = require('./routes/merchant.routes');
const { uploadsRouter, UPLOAD_ROOT } = require('./routes/uploads.routes');
const { categoriesRouter, adminCatalogRouter } = require('./routes/catalog.routes');
app.use('/uploads', express.static(UPLOAD_ROOT));
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/admin/marketplace', adminCatalogRouter);
app.use('/api/v1/stores', storesRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/merchant', merchantRouter);

const { kycRouter } = require('./routes/kyc.routes');
const { pointsRouter } = require('./routes/points.routes');
const { referralsRouter } = require('./routes/referrals.routes');
const { deliveriesRouter } = require('./routes/deliveries.routes');
const {
  rideExperienceRouter,
  sosRouter,
  publicTripShareRouter,
} = require('./routes/ride-experience.routes');

const { tokenRouter } = require('./routes/token.routes');
const { stakingRouter, publicStakingRouter } = require('./routes/staking.routes');

app.use('/api/v1/kyc', kycRouter);
app.use('/api/v1/token', tokenRouter);
app.use('/api/v1/staking', stakingRouter);
app.use('/api/v1/public/staking', publicStakingRouter);
const { publicLocalizeRouter } = require('./routes/localize.routes');
app.use('/api/v1/public', publicLocalizeRouter);
const { publicCmsRouter, adminCmsRouter } = require('./routes/cms.routes');
app.use('/api/v1/public/cms', publicCmsRouter);
app.use('/api/v1/admin/cms', adminCmsRouter);
app.use('/api/v1/points', pointsRouter);
app.use('/api/v1/referrals', referralsRouter);
app.use('/api/v1/deliveries', deliveriesRouter);
app.use('/api/v1/rides', rideExperienceRouter);
app.use('/api/v1/sos', sosRouter);
app.use('/api/v1/public/trip', publicTripShareRouter);

const {
  driverRouter,
  subscriptionsRouter,
  rentalsRouter,
  adminOpsRouter,
  adminFinanceRouter,
  adminRewardsRouter,
  inboxRouter,
} = require('./routes/platform.routes');

app.use('/api/v1/driver', driverRouter);
app.use('/api/v1/subscriptions', subscriptionsRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/admin', adminOpsRouter);
app.use('/api/v1/admin/finance', adminFinanceRouter);
app.use('/api/v1/admin/rewards-rules', adminRewardsRouter);
app.use('/api/v1/inbox', inboxRouter);

const {
  rideBookingRouter,
  voiceRouter,
  channelWebhooksRouter,
  adminVehicleRouter,
  adminChannelsRouter,
} = require('./routes/channels.routes');

app.use('/api/v1/rides', rideBookingRouter);
app.use('/api/v1/voice', voiceRouter);
app.use('/webhooks', channelWebhooksRouter);
app.use('/api/v1/admin', adminVehicleRouter);
app.use('/api/v1/admin/channels', adminChannelsRouter);

const {
  adminPricingRouter,
  identityLinkRouter,
  walletTransferRouter,
  tripRecordingRouter,
} = require('./routes/phases-25-28.routes');
app.use('/api/v1/admin/pricing', adminPricingRouter);
app.use('/api/v1/identity', identityLinkRouter);
app.use('/api/v1/wallet', walletTransferRouter);
app.use('/api/v1', tripRecordingRouter);

const { startPlatformJobs } = require('./jobs/platform-jobs');
startPlatformJobs();

// ============================================
// AUTH MIDDLEWARE
// ============================================
interface AuthRequest extends ExpressRequest {
  user?: {
    id: string;
    email: string;
    userType: string;
  };
}

const authenticateToken = (req: AuthRequest, res: ExpressResponse, next: ExpressNextFunction) => {
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

// In-memory storage for MVP rides/sessions (users auth is DB-backed)
const users: Map<string, User & { password?: string }> = new Map();
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
app.post('/api/v1/auth/signup', async (req: ExpressRequest, res: ExpressResponse) => {
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

/** DB-backed register used by the web app (email and/or phone). */
app.post('/api/v1/auth/register', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const {
      email,
      phone,
      password,
      firstName,
      lastName,
      name,
      userType = 'customer',
      country = 'GH',
      city = 'Accra',
    } = req.body;

    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? String(phone).replace(/[\s\-()]/g, '') : null;
    const fname = firstName || String(name || '').trim().split(/\s+/)[0] || null;
    const lname =
      lastName ||
      String(name || '')
        .trim()
        .split(/\s+/)
        .slice(1)
        .join(' ') ||
      null;

    if (!password) {
      return res.status(400).json({ status: 'error', message: 'Password is required' });
    }
    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Email or phone number is required',
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const inserted = await authDb.query(
      `INSERT INTO users (email, phone, first_name, last_name, password, user_type, country, city, is_active, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
       RETURNING id, email, phone, first_name, last_name, user_type, country, city`,
      [
        cleanEmail,
        cleanPhone,
        fname,
        lname,
        hash,
        userType === 'driver' ? 'driver' : 'customer',
        country,
        city,
      ]
    );
    const dbUser = inserted.rows[0];

    if (dbUser.user_type === 'customer') {
      await authDb
        .query(`INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [dbUser.id])
        .catch(() => undefined);
    } else if (dbUser.user_type === 'driver') {
      await authDb
        .query(
          `INSERT INTO drivers (user_id, vehicle_type, is_online, rating)
           VALUES ($1, 'standard', false, 5.0)`,
          [dbUser.id]
        )
        .catch(() => undefined);
    }

    const token = jwt.sign(
      { id: dbUser.id, email: dbUser.email, userType: dbUser.user_type },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      data: {
        token,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.first_name || '',
          lastName: dbUser.last_name || '',
          phone: dbUser.phone || '',
          userType: dbUser.user_type,
          country: dbUser.country || 'GH',
          city: dbUser.city || 'Accra',
          isVerified: false,
        },
      },
    });
  } catch (error: any) {
    logger.error('Register error:', error);
    const msg = String(error?.message || '');
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return res.status(400).json({ status: 'error', message: 'Account already exists' });
    }
    res.status(500).json({ status: 'error', message: error.message || 'Registration failed' });
  }
});

app.post('/api/v1/auth/login', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { email, password, phone, identifier } = req.body;
    const raw = String(identifier || email || phone || '').trim();

    if (!raw || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email/phone and password required'
      });
    }

    const isEmail = raw.includes('@');
    const cleanPhone = raw.replace(/[\s\-()]/g, '');

    // Prefer DB users (seeded / live)
    let dbUser: any = null;
    try {
      if (isEmail) {
        const r = await authDb.query(
          `SELECT id, email, phone, first_name, last_name, password, user_type, country, city, is_active
           FROM users WHERE lower(email) = lower($1) LIMIT 1`,
          [raw]
        );
        dbUser = r.rows[0];
      } else {
        const r = await authDb.query(
          `SELECT id, email, phone, first_name, last_name, password, user_type, country, city, is_active
           FROM users
           WHERE phone = $1
              OR regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $2
           LIMIT 1`,
          [raw, cleanPhone]
        );
        dbUser = r.rows[0];
      }
    } catch (e: any) {
      logger.warn(`DB login lookup failed: ${e.message}`);
    }

    if (dbUser) {
      if (dbUser.is_active === false) {
        return res.status(403).json({ status: 'error', message: 'Account disabled' });
      }
      const ok = await bcrypt.compare(password, dbUser.password || '');
      if (!ok) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }
      const token = jwt.sign(
        { id: dbUser.id, email: dbUser.email, userType: dbUser.user_type },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );
      return res.status(200).json({
        status: 'success',
        data: {
          userId: dbUser.id,
          email: dbUser.email,
          name: `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim(),
          userType: dbUser.user_type,
          token,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.first_name || '',
            lastName: dbUser.last_name || '',
            phone: dbUser.phone || (!isEmail ? raw : ''),
            userType: dbUser.user_type,
            country: dbUser.country || 'GH',
            city: dbUser.city || 'Accra',
            isVerified: true,
          },
        },
      });
    }

    // In-memory users created via /auth/signup in this process only
    const user = Array.from(users.values()).find(
      (u: any) =>
        (isEmail && u.email === raw) ||
        (!isEmail && (u.phone === raw || u.phone === cleanPhone))
    );

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    if (user.password && user.password !== password) {
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
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.name?.split?.(' ')?.[0] || 'User',
          lastName: user.name?.split?.(' ')?.slice(1).join(' ') || '',
          phone: user.phone || (!isEmail ? raw : ''),
          userType: user.userType,
          country: (user as any).country || 'GH',
          city: (user as any).city || 'Accra',
          isVerified: true,
        },
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

const otpStore = new Map<
  string,
  { code: string; expires: number; userId?: string; purpose: 'reset' | 'signup' }
>();

function normalizeAuthIdentifier(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.includes('@')) return value.toLowerCase();
  return value.replace(/[\s\-()]/g, '');
}

function otpLookupKeys(raw: string) {
  const normalized = normalizeAuthIdentifier(raw);
  const keys = new Set<string>([String(raw || '').trim(), normalized].filter(Boolean));
  return [...keys];
}

async function findUserForPasswordReset(identifier: string) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) {
    const r = await authDb.query(
      `SELECT id, email, phone FROM users WHERE lower(email) = lower($1) AND is_active = TRUE LIMIT 1`,
      [raw]
    );
    return r.rows[0] || null;
  }
  const phone = normalizeAuthIdentifier(raw);
  const r = await authDb.query(
    `SELECT id, email, phone FROM users
     WHERE phone = $1
        OR regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $2
     LIMIT 1`,
    [raw, phone]
  );
  return r.rows[0] || null;
}

app.post('/api/v1/auth/forgot-password', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const identifier = String(req.body.phone || req.body.email || req.body.identifier || '').trim();
    if (!identifier) {
      return res.status(400).json({ status: 'error', message: 'Email or phone is required' });
    }

    const code = String(Math.floor(10000 + Math.random() * 90000));
    const user = await findUserForPasswordReset(identifier).catch(() => null);
    const storeKey = normalizeAuthIdentifier(identifier);

    otpStore.set(storeKey, {
      code,
      expires: Date.now() + 10 * 60 * 1000,
      userId: user?.id,
      purpose: 'reset',
    });
    // Also index under original phone string if different
    if (identifier !== storeKey) {
      otpStore.set(identifier, otpStore.get(storeKey)!);
    }

    logger.info(`Password reset OTP for ${identifier}: ${code}`);

    const payload: any = {
      status: 'success',
      message: user
        ? 'Reset code sent'
        : 'If an account exists for that email or phone, a reset code was sent',
      data: {
        identifier: storeKey,
        phone: storeKey,
        expiresInSeconds: 600,
      },
    };

    // Local/dev: expose code so E2E works without SMS/email provider
    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP === 'true') {
      payload.data.devCode = code;
    }

    res.json(payload);
  } catch (error: any) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Could not send reset code' });
  }
});

app.post('/api/v1/auth/resend-otp', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const identifier = String(req.body.phone || req.body.email || req.body.identifier || '').trim();
    const purpose = req.body.purpose === 'reset' ? 'reset' : 'signup';
    if (!identifier) {
      return res.status(400).json({ status: 'error', message: 'Email or phone is required' });
    }

    const code = String(Math.floor(10000 + Math.random() * 90000));
    const storeKey = normalizeAuthIdentifier(identifier);
    let userId: string | undefined;
    if (purpose === 'reset') {
      const user = await findUserForPasswordReset(identifier).catch(() => null);
      userId = user?.id;
    }

    const entry = {
      code,
      expires: Date.now() + 10 * 60 * 1000,
      userId,
      purpose: purpose as 'reset' | 'signup',
    };
    otpStore.set(storeKey, entry);
    if (identifier !== storeKey) otpStore.set(identifier, entry);

    logger.info(`Resend OTP (${purpose}) for ${identifier}: ${code}`);
    const data: any = { identifier: storeKey, phone: storeKey, expiresInSeconds: 600 };
    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP === 'true') {
      data.devCode = code;
    }
    res.json({ status: 'success', message: 'Code resent', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Could not resend code' });
  }
});

app.post('/api/v1/auth/verify-otp', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const identifier = String(req.body.phone || req.body.email || req.body.identifier || '').trim();
    const code = String(req.body.code || '').trim();
    const purpose = req.body.purpose === 'reset' ? 'reset' : String(req.body.purpose || 'signup');

    if (!identifier || !code) {
      return res.status(400).json({ status: 'error', message: 'Code and email/phone are required' });
    }

    let entry: { code: string; expires: number; userId?: string; purpose: 'reset' | 'signup' } | undefined;
    for (const key of otpLookupKeys(identifier)) {
      const found = otpStore.get(key);
      if (found) {
        entry = found;
        break;
      }
    }

    const valid =
      entry &&
      entry.expires > Date.now() &&
      entry.code === code &&
      (purpose !== 'reset' || entry.purpose === 'reset');

    if (!valid) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired code' });
    }

    // Consume OTP
    for (const key of otpLookupKeys(identifier)) otpStore.delete(key);

    if (purpose === 'reset' || entry!.purpose === 'reset') {
      if (!entry!.userId) {
        return res.status(400).json({
          status: 'error',
          message: 'No account found for that email or phone',
        });
      }
      const resetToken = jwt.sign(
        { id: entry!.userId, purpose: 'password_reset' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '15m' }
      );
      return res.json({
        status: 'success',
        message: 'Code verified',
        data: { verified: true, resetToken, purpose: 'reset' },
      });
    }

    res.json({ status: 'success', message: 'Verified', data: { verified: true, purpose: 'signup' } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Verification failed' });
  }
});

app.post('/api/v1/auth/reset-password', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { resetToken, password, newPassword } = req.body;
    const nextPassword = String(newPassword || password || '');
    if (!resetToken || !nextPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Reset token and new password are required',
      });
    }
    if (nextPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters',
      });
    }

    let payload: any;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret');
    } catch {
      return res.status(401).json({ status: 'error', message: 'Reset link expired. Request a new code.' });
    }

    if (payload?.purpose !== 'password_reset' || !payload?.id) {
      return res.status(401).json({ status: 'error', message: 'Invalid reset token' });
    }

    const hash = await bcrypt.hash(nextPassword, 10);
    const updated = await authDb.query(
      `UPDATE users SET password = $1 WHERE id = $2 AND COALESCE(is_active, TRUE) = TRUE
       RETURNING id, email, phone`,
      [hash, payload.id]
    );
    if (!updated.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Account not found' });
    }

    res.json({
      status: 'success',
      message: 'Password updated. You can sign in now.',
      data: { email: updated.rows[0].email, phone: updated.rows[0].phone },
    });
  } catch (error: any) {
    logger.error('Reset password error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Could not reset password' });
  }
});

// ============================================
// ROUTES: RIDES
// ============================================
app.post('/api/v1/rides/request', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
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

app.get('/api/v1/rides/:id', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
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

app.get('/api/v1/rides', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
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
app.get('/api/v1/marketplace/stores', async (req: ExpressRequest, res: ExpressResponse) => {
  res.json({ status: 'success', data: [] });
});

app.get('/api/v1/marketplace/products', async (req: ExpressRequest, res: ExpressResponse) => {
  res.json({ status: 'success', data: [] });
});

app.post('/api/v1/marketplace/orders', authenticateToken, async (req: ExpressRequest, res: ExpressResponse) => {
  res.status(201).json({ status: 'success', message: 'Order created' });
});

// ============================================
// ROUTES: WALLET helpers (live data is on walletRouter — do not stub /balance)
// ============================================
app.post('/api/v1/wallet/topup', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  res.status(201).json({
    status: 'success',
    message: 'Top-up initiated',
    data: { reference: `TOPUP-${Date.now()}`, amount: req.body?.amount || 0 },
  });
});

const notifPrefs = new Map<string, Record<string, boolean>>();

app.get('/api/v1/users/notification-prefs', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  const defaults = {
    driver_assigned: true,
    order_status_updates: true,
    points_earned: true,
    referral_updates: false,
    promotions_offers: false,
  };
  const uid = req.user?.id || 'anon';
  res.json({ status: 'success', data: { ...defaults, ...(notifPrefs.get(uid) || {}) } });
});

app.patch('/api/v1/users/notification-prefs', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  const uid = req.user?.id || 'anon';
  const prev = notifPrefs.get(uid) || {};
  const next = { ...prev, ...req.body };
  notifPrefs.set(uid, next);
  res.json({ status: 'success', data: next });
});

app.get('/api/v1/users/me', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  res.json({
    status: 'success',
    data: {
      id: req.user?.id,
      email: req.user?.email,
      phone: (req.user as any)?.phone,
      firstName: (req.user as any)?.firstName,
      lastName: (req.user as any)?.lastName,
    },
  });
});

// ============================================
// HEALTH & ROOT ROUTES
// ============================================
app.get('/health', (req: ExpressRequest, res: ExpressResponse) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

app.get('/health/db', async (_req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { DatabaseService } = require('./services/database.service');
    const db = new DatabaseService();
    await db.query('SELECT 1');
    res.json({ status: 'healthy', service: 'db' });
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', service: 'db', error: error.message });
  }
});

app.get('/health/redis', async (_req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { RedisService } = require('./services/redis.service');
    const redis = new RedisService();
    await redis.connect();
    res.json({ status: 'healthy', service: 'redis' });
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', service: 'redis', error: error.message });
  }
});

app.get('/', (req: ExpressRequest, res: ExpressResponse) => {
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
app.use((req: ExpressRequest, res: ExpressResponse) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

app.use((err: any, req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
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

  socket.on('ride-chat:join', (rideId: string) => {
    if (rideId) socket.join(`ride-chat:${rideId}`);
  });
  socket.on('ride-chat:message', (data: any) => {
    if (data?.rideId) {
      io.to(`ride-chat:${data.rideId}`).emit('ride-chat:message', {
        ...data,
        timestamp: Date.now(),
      });
    }
  });

  // Phase 4 — marketplace delivery tracking
  socket.on('delivery:join', (orderId: string) => {
    if (orderId) socket.join(`delivery:${orderId}`);
  });
  socket.on('delivery:location', (data: any) => {
    if (data?.orderId) {
      io.to(`delivery:${data.orderId}`).emit('delivery:location', {
        ...data,
        timestamp: Date.now(),
      });
    }
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

    try {
      const { CmsService } = require('./services/cms.service');
      const { ensureCmsDefaults, CMS_SEED } = require('./scripts/seed-cms');
      const { DatabaseService } = require('./services/database.service');
      const { PaymentService } = require('./services/payment.service');
      const { IntegrationsService } = require('./services/integrations.service');
      const dbBoot = new DatabaseService();
      const cmsBoot = new CmsService(dbBoot);
      const result = await ensureCmsDefaults(dbBoot);
      const n = await cmsBoot.countPages();
      logger.info(`CMS ready: ${n} pages (${CMS_SEED.length} defaults). added=${result.created}`);

      try {
        const { ensureCatalogDefaults } = require('./scripts/ensure-catalog');
        const cat = await ensureCatalogDefaults(dbBoot);
        logger.info(`Catalog categories ready. added=${cat.created}`);
      } catch (ce: any) {
        logger.warn(`Catalog defaults skipped: ${ce.message}`);
      }

      const paymentsBoot = new PaymentService(dbBoot);
      await paymentsBoot.initialize();

      const integrationsBoot = new IntegrationsService(dbBoot);
      await integrationsBoot.warnRequiredOnBoot();
    } catch (e: any) {
      logger.warn(`Boot defaults skipped: ${e.message}`);
    }

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
