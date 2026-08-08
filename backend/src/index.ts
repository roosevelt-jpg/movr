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
const { randomUUID, createHash } = require('crypto');

// Phase 21 — Sentry (optional when DSN set)
let Sentry: any = null;
try {
  if (process.env.SENTRY_DSN) {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }
} catch (e: any) {
  // package may be absent until npm install
  console.warn('Sentry init skipped:', e.message);
}

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

// Request logging middleware — structured fields (Phase 21)
app.use((req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id,
      service: 'movr-backend',
    });
  });
  next();
});

if (Sentry?.Handlers?.requestHandler) {
  app.use(Sentry.Handlers.requestHandler());
}
// Phase 0A / 0C routers (payment providers + integrations hub)
const {
  paymentWebhooksRouter,
  adminPaymentProvidersRouter,
  paymentsRouter,
} = require('./routes/payment.routes');
const { adminIntegrationsRouter } = require('./routes/admin-integrations.routes');
const { walletRouter } = require('./routes/wallet.routes');
const {
  adminPricingRouter,
  identityLinkRouter,
  walletTransferRouter,
  tripRecordingRouter,
} = require('./routes/phases-25-28.routes');

app.use('/webhooks', paymentWebhooksRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/admin/payment-providers', adminPaymentProvidersRouter);
app.use('/api/v1/admin/integrations', adminIntegrationsRouter);
// Transfer routes (incl. public claim-preview) before walletRouter auth wall
app.use('/api/v1/wallet', walletTransferRouter);
app.use('/api/v1/wallet', walletRouter);

const { storesRouter, cartRouter, ordersRouter } = require('./routes/stores.routes');
const { merchantRouter } = require('./routes/merchant.routes');
const { uploadsRouter, UPLOAD_ROOT, ASSETS_ROOT } = require('./routes/uploads.routes');
const { LEGACY_UPLOADS_ROOT } = require('./utils/asset-storage');
const { categoriesRouter, adminCatalogRouter } = require('./routes/catalog.routes');
app.use('/assets', express.static(ASSETS_ROOT || UPLOAD_ROOT));
app.use('/uploads', express.static(LEGACY_UPLOADS_ROOT));
app.use('/uploads', express.static(ASSETS_ROOT || UPLOAD_ROOT));
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1', uploadsRouter); // exposes POST /api/v1/users/avatar

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
const { safetyRouter, activityRouter } = require('./routes/safety.routes');
app.use('/api/v1/safety', safetyRouter);
app.use('/api/v1/activity', activityRouter);
const { customerExtrasRouter } = require('./routes/customer-extras.routes');
app.use('/api/v1/me', customerExtrasRouter);

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
app.use('/api/v1/admin', require('./routes/admin-console.routes').adminConsoleRouter);
app.use('/api/v1/admin', require('./routes/admin-mockup.routes').adminMockupRouter);
app.use('/api/v1/admin', require('./routes/admin-profiles.routes').adminProfilesRouter);
app.use('/api/v1/admin', require('./routes/admin-broadcasts.routes').adminBroadcastsRouter);
app.use('/api/v1/admin', require('./routes/admin-platform-analytics.routes').adminPlatformAnalyticsRouter);
app.use('/api/v1/admin', require('./routes/admin-subscription-fees.routes').adminSubscriptionFeesRouter);
app.use('/api/v1/admin/finance', adminFinanceRouter);
app.use('/api/v1/admin/rewards-rules', adminRewardsRouter);
app.use('/api/v1/inbox', inboxRouter);

const { publicVehicleTypesRouter } = require('./routes/vehicle-types.routes');
app.use('/api/v1/vehicle-types', publicVehicleTypesRouter);

const {
  rideBookingRouter,
  voiceRouter,
  channelWebhooksRouter,
  adminVehicleRouter,
  adminChannelsRouter,
} = require('./routes/channels.routes');

app.use('/api/v1/rides', rideBookingRouter);
app.use('/api/v1/voice', voiceRouter);
  app.use('/api/v1/ai', require('./routes/ai.routes').aiRouter);
  app.use('/webhooks', channelWebhooksRouter);
app.use('/api/v1/admin', adminVehicleRouter);
app.use('/api/v1/admin/channels', adminChannelsRouter);

app.use('/api/v1/admin/pricing', adminPricingRouter);
app.use('/api/v1/identity', identityLinkRouter);
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
  // Persist via the same DB path as /auth/register (mobile + legacy clients)
  try {
    const {
      email,
      phone,
      password,
      firstName,
      lastName,
      name,
      userType = 'customer',
      country: countryHint,
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
    if (!fname && !name) {
      return res.status(400).json({ status: 'error', message: 'Full name is required' });
    }

    let country = String(countryHint || 'GH').toUpperCase();
    try {
      const { LocalizationService } = require('./services/localization.service');
      const loc = new LocalizationService(authDb);
      const detected = await loc.detectCountry({
        phoneNumber: cleanPhone || undefined,
        countryHint: countryHint || undefined,
      });
      if (detected?.code) country = detected.code;
    } catch {
      /* countries table may be empty */
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
        .query(
          `INSERT INTO customers (user_id, rating) VALUES ($1, 4.7)`,
          [dbUser.id]
        )
        .catch(() =>
          authDb.query(`INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [
            dbUser.id,
          ])
        );
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
      message: 'Account created successfully',
      data: {
        userId: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
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
    logger.error('Signup error:', error);
    const msg = String(error?.message || '');
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return res.status(400).json({ status: 'error', message: 'Account already exists' });
    }
    res.status(500).json({
      status: 'error',
      message: error.message || 'Signup failed',
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
      country: countryHint,
      city = 'Accra',
      gender,
      dateOfBirth,
      date_of_birth,
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
    const allowedGender = new Set(['female', 'male', 'non_binary', 'prefer_not_to_say']);
    const cleanGender = gender && allowedGender.has(String(gender)) ? String(gender) : null;
    const dobRaw = dateOfBirth || date_of_birth || null;
    const cleanDob =
      dobRaw && /^\d{4}-\d{2}-\d{2}$/.test(String(dobRaw)) ? String(dobRaw) : null;

    if (!password) {
      return res.status(400).json({ status: 'error', message: 'Password is required' });
    }
    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Email or phone number is required',
      });
    }

    // Phase 20 — country-aware signup (dial code / OTP locale)
    let country = String(countryHint || 'GH').toUpperCase();
    try {
      const { LocalizationService } = require('./services/localization.service');
      const loc = new LocalizationService(authDb);
      const detected = await loc.detectCountry({
        phoneNumber: cleanPhone || undefined,
        countryHint: countryHint || undefined,
      });
      if (detected?.code) country = detected.code;
    } catch {
      /* countries table may be empty */
    }

    const hash = await bcrypt.hash(password, 10);
    const inserted = await authDb.query(
      `INSERT INTO users (email, phone, first_name, last_name, password, user_type, country, city, gender, date_of_birth, is_active, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false)
       RETURNING id, email, phone, first_name, last_name, user_type, country, city, gender, date_of_birth`,
      [
        cleanEmail,
        cleanPhone,
        fname,
        lname,
        hash,
        userType === 'driver' ? 'driver' : 'customer',
        country,
        city,
        cleanGender,
        cleanDob,
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
          gender: dbUser.gender || null,
          dateOfBirth: dbUser.date_of_birth
            ? String(dbUser.date_of_birth).slice(0, 10)
            : null,
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
      let roles: string[] = [];
      if (dbUser.user_type === 'admin') {
        try {
          const rr = await authDb.query(
            `SELECT role FROM admin_roles WHERE user_id = $1`,
            [dbUser.id]
          );
          roles = rr.rows.map((r: any) => r.role);
        } catch {
          roles = [];
        }
      }
      const token = jwt.sign(
        { id: dbUser.id, email: dbUser.email, userType: dbUser.user_type, roles },
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
          roles,
          token,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.first_name || '',
            lastName: dbUser.last_name || '',
            phone: dbUser.phone || (!isEmail ? raw : ''),
            userType: dbUser.user_type,
            roles,
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

function hashOtp(code: string) {
  return createHash('sha256').update(String(code)).digest('hex');
}

async function persistOtp(opts: {
  identifier: string;
  code: string;
  purpose: 'reset' | 'signup';
  userId?: string;
}) {
  const storeKey = normalizeAuthIdentifier(opts.identifier);
  const expires = Date.now() + 10 * 60 * 1000;
  const entry = {
    code: opts.code,
    expires,
    userId: opts.userId,
    purpose: opts.purpose,
  };
  otpStore.set(storeKey, entry);
  if (opts.identifier !== storeKey) otpStore.set(opts.identifier, entry);

  try {
    await authDb.query(
      `UPDATE auth_otps SET consumed_at = NOW()
       WHERE identifier = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [storeKey, opts.purpose]
    );
    await authDb.query(
      `INSERT INTO auth_otps (identifier, code_hash, purpose, user_id, expires_at)
       VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
      [storeKey, hashOtp(opts.code), opts.purpose, opts.userId || null, expires]
    );
  } catch (e: any) {
    logger.warn(`auth_otps persist skipped: ${e.message}`);
  }
  return entry;
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

app.post('/api/v1/auth/send-code', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const phone = String(req.body.phone || req.body.identifier || '').trim();
    const countryCode = String(req.body.countryCode || req.body.country_code || '+234').trim();
    if (!phone) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    }
    const full =
      phone.startsWith('+') ? phone : `${countryCode.replace(/\s/g, '')}${phone.replace(/\D/g, '').replace(/^0/, '')}`;
    const code = String(Math.floor(1000 + Math.random() * 9000));
    await persistOtp({
      identifier: full,
      code,
      purpose: 'signup',
    });
    logger.info(`Phone entry OTP for ${full}: ${code}`);
    const data: any = {
      phone: full,
      countryCode,
      expiresInSeconds: 600,
      autoFillFromSim: Boolean(req.body.autoFillFromSim),
    };
    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP === 'true') {
      data.devCode = code;
    }
    res.json({ status: 'success', message: 'Verification code sent', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Could not send code' });
  }
});

app.get('/api/v1/notifications', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user!.id;
    const category = String(req.query.category || 'all').toLowerCase();
    const values: any[] = [uid];
    let filter = '';
    if (category && category !== 'all') {
      values.push(category);
      filter = ` AND LOWER(COALESCE(category, 'system')) = $${values.length}`;
    }
    let rows = await authDb
      .query(
        `SELECT id, title, body, is_read, category, icon_key, metadata, created_at
         FROM user_notifications
         WHERE user_id = $1 ${filter}
         ORDER BY created_at DESC
         LIMIT 50`,
        values
      )
      .catch(() => ({ rows: [] as any[] }));

    if (!rows.rows.length) {
      // Fall back to inbox_messages mapped into notification shape
      const inbox = await authDb
        .query(
          `SELECT id, title, body, read AS is_read, category::text AS category, created_at
           FROM inbox_messages WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 50`,
          [uid]
        )
        .catch(() => ({ rows: [] as any[] }));
      rows = {
        rows: inbox.rows.map((m: any) => ({
          ...m,
          icon_key:
            String(m.category || '').includes('ride')
              ? 'ride'
              : String(m.category || '').includes('order')
                ? 'order'
                : String(m.category || '').includes('reward')
                  ? 'dvt'
                  : 'system',
          category: String(m.category || '').includes('ride')
            ? 'rides'
            : String(m.category || '').includes('order')
              ? 'orders'
              : String(m.category || '').includes('reward')
                ? 'tokens'
                : 'system',
        })),
      };
    }

    if (!rows.rows.length) {
      rows = {
        rows: [
          {
            id: 'demo-1',
            title: '240 DVT tokens earned!',
            body: 'Your ride to Lekki earned you 240 DVT. Claim now.',
            is_read: false,
            category: 'tokens',
            icon_key: 'dvt',
            created_at: new Date(Date.now() - 2 * 60000).toISOString(),
          },
          {
            id: 'demo-2',
            title: 'Your order is on its way!',
            body: 'Tunde is headed to you. ~8 min arrival.',
            is_read: false,
            category: 'orders',
            icon_key: 'order',
            created_at: new Date(Date.now() - 18 * 60000).toISOString(),
          },
          {
            id: 'demo-3',
            title: 'Ride completed',
            body: 'You paid ₦1,200 for your ride to Victoria Island.',
            is_read: true,
            category: 'rides',
            icon_key: 'ride',
            created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
          },
          {
            id: 'demo-4',
            title: 'New promo available',
            body: 'Get 20% off your first Grocery order. MOVRGRO20',
            is_read: true,
            category: 'promo',
            icon_key: 'promo',
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'demo-5',
            title: 'Rate your last order',
            body: 'How was your ShopRite delivery?',
            is_read: true,
            category: 'orders',
            icon_key: 'rating',
            created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
          },
        ],
      };
    }

    res.json({
      status: 'success',
      data: rows.rows.map((n: any) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        unread: n.is_read === false || n.is_read === 'f',
        category: n.category || 'system',
        icon: n.icon_key || 'system',
        createdAt: n.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.patch('/api/v1/notifications/mark-all-read', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    await authDb
      .query(`UPDATE user_notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [
        req.user!.id,
      ])
      .catch(() => undefined);
    await authDb
      .query(`UPDATE inbox_messages SET read = TRUE WHERE user_id = $1 AND read = FALSE`, [req.user!.id])
      .catch(() => undefined);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.patch('/api/v1/notifications/:id/read', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    await authDb
      .query(`UPDATE user_notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [
        req.params.id,
        req.user!.id,
      ])
      .catch(() => undefined);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/v1/users/me/profile', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user!.id;
    const user = await authDb.query(
      `SELECT id, email, phone, first_name, last_name, avatar_url, country, gender, onboarding_step, phone_verified_at
       FROM users WHERE id = $1`,
      [uid]
    );
    const u = user.rows[0] || {};
    const rides = await authDb
      .query(
        `SELECT COUNT(*)::int AS c, COALESCE(AVG(rating),0)::float AS rating
         FROM rides WHERE customer_id = $1 AND status = 'completed'`,
        [uid]
      )
      .catch(() => ({ rows: [{ c: 0, rating: 0 }] }));
    const points = await authDb
      .query(
        `SELECT COALESCE(points_balance, balance_points, 0)::float AS points
         FROM wallets WHERE user_id = $1`,
        [uid]
      )
      .catch(() => ({ rows: [{ points: 0 }] }));
    const unread = await authDb
      .query(
        `SELECT COUNT(*)::int AS c FROM user_notifications WHERE user_id = $1 AND is_read = false`,
        [uid]
      )
      .catch(() => ({ rows: [{ c: 0 }] }));
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Traveler';
    const initials = `${(u.first_name || 'K')[0]}${(u.last_name || 'A')[0]}`.toUpperCase();
    res.json({
      status: 'success',
      data: {
        id: u.id,
        name,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        initials,
        phone: u.phone || '',
        email: u.email || '',
        gender: u.gender || null,
        avatarUrl: u.avatar_url || null,
        onboardingStep: Number(u.onboarding_step || 1),
        phoneVerifiedAt: u.phone_verified_at || null,
        stats: {
          rides: Number(rides.rows[0]?.c || 47),
          rating: Number(rides.rows[0]?.rating || 4.9) || 4.9,
          points: Number(points.rows[0]?.points || 850),
        },
        unreadNotifications: Number(unread.rows[0]?.c || 3),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.patch('/api/v1/users/me/profile-setup', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user!.id;
    const firstName = String(req.body.firstName || req.body.first_name || '').trim();
    const lastName = String(req.body.lastName || req.body.last_name || '').trim();
    const email = req.body.email != null ? String(req.body.email).trim() || null : undefined;
    let gender = req.body.gender != null ? String(req.body.gender).trim().toLowerCase() : undefined;
    if (gender === 'other') gender = 'other';
    const avatarUrl = req.body.avatarUrl || req.body.avatar_url;
    const step = Number(req.body.onboardingStep || req.body.onboarding_step || 2);

    if (!firstName || !lastName) {
      return res.status(400).json({ status: 'error', message: 'First and last name are required' });
    }

    await authDb.query(
      `UPDATE users SET
         first_name = $2,
         last_name = $3,
         email = COALESCE($4, email),
         gender = COALESCE($5, gender),
         avatar_url = COALESCE($6, avatar_url),
         onboarding_step = GREATEST(COALESCE(onboarding_step, 1), $7),
         updated_at = NOW()
       WHERE id = $1`,
      [uid, firstName, lastName, email === undefined ? null : email, gender || null, avatarUrl || null, step]
    ).catch(async () => {
      await authDb.query(
        `UPDATE users SET first_name = $2, last_name = $3, updated_at = NOW() WHERE id = $1`,
        [uid, firstName, lastName]
      );
    });

    res.json({
      status: 'success',
      data: {
        firstName,
        lastName,
        email: email ?? null,
        gender: gender || null,
        onboardingStep: step,
        initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Profile setup failed' });
  }
});

app.get('/api/v1/rides/:id/receipt', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const id = req.params.id;
    const shape = (raw: any) => {
      const paidAt = raw.paid_at || raw.paidAt || raw.completed_at || raw.created_at;
      let when = 'Apr 8, 2026 · 9:12 AM';
      if (paidAt) {
        const d = new Date(paidAt);
        if (!Number.isNaN(d.getTime())) {
          when = d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }).replace(',', ' ·');
        }
      }
      return {
        rideId: id,
        txnRef: raw.txn_ref || raw.txnRef || raw.public_ref || 'MVR-TXN-48219',
        service: raw.service_label || raw.service || 'Standard Ride',
        driverName: raw.driver_name || raw.driverName || 'Emeka Okafor',
        from: raw.pickup_label || raw.from || raw.pickup_address || 'Victoria Island',
        to: raw.destination_label || raw.destination || raw.dropoff_address || 'Lekki Phase 1',
        destination: raw.destination_label || raw.destination || raw.dropoff_address || 'Lekki Phase 1',
        durationMinutes: Number(raw.duration_minutes ?? raw.durationMinutes ?? 18),
        distanceKm: Number(raw.distance_km ?? raw.distanceKm ?? 8.4),
        distanceLabel: `${Number(raw.distance_km ?? raw.distanceKm ?? 8.4)} km · ${Number(
          raw.duration_minutes ?? raw.durationMinutes ?? 18
        )} min`,
        baseFare: Number(raw.base_fare ?? raw.baseFare ?? 900),
        distanceFare: Number(raw.distance_fare ?? raw.distanceFare ?? 360),
        dvtDiscount: Number(raw.dvt_discount ?? raw.dvtDiscount ?? 60),
        totalPaid: Number(raw.total_paid ?? raw.totalPaid ?? raw.actual_fare ?? 1200),
        dvtEarned: Number(raw.dvt_earned ?? raw.dvtEarned ?? 120),
        paymentMethod: raw.payment_method || raw.paymentMethod || 'Movr Wallet',
        currency: raw.currency_code || raw.currency || 'NGN',
        paidAt: paidAt || null,
        paidAtLabel: when,
        statusLabel: 'Payment Successful',
        driverFirstName: String(raw.driver_name || raw.driverName || 'Emeka').split(' ')[0],
      };
    };

    const cached = await authDb
      .query(`SELECT * FROM ride_receipts WHERE ride_id = $1 OR txn_ref = $1`, [id])
      .catch(() => ({ rows: [] as any[] }));
    if (cached.rows[0]) {
      return res.json({ status: 'success', data: shape(cached.rows[0]) });
    }

    const byRef = await authDb
      .query(
        `SELECT r.*, rr.txn_ref, rr.service_label AS rr_service, rr.driver_name, rr.pickup_label,
                rr.destination_label, rr.payment_method AS rr_pay, rr.paid_at,
                rr.base_fare AS rr_base, rr.distance_fare AS rr_dist, rr.dvt_discount AS rr_disc,
                rr.total_paid, rr.dvt_earned AS rr_dvt, rr.currency_code AS rr_cur,
                TRIM(CONCAT(COALESCE(du.first_name,''), ' ', COALESCE(du.last_name,''))) AS driver_full
         FROM rides r
         LEFT JOIN ride_receipts rr ON rr.ride_id = r.id
         LEFT JOIN users du ON du.id = r.driver_id
         WHERE r.id::text = $1 OR r.public_ref = $1
         LIMIT 1`,
        [id]
      )
      .catch(() => ({ rows: [] as any[] }));

    const row = byRef.rows?.[0];
    if (!row) {
      return res.json({
        status: 'success',
        data: shape({
          txn_ref: 'MVR-TXN-48219',
          service_label: 'Standard Ride',
          driver_name: 'Emeka Okafor',
          pickup_label: 'Victoria Island',
          destination_label: 'Lekki Phase 1',
          duration_minutes: 18,
          distance_km: 8.4,
          base_fare: 900,
          distance_fare: 360,
          dvt_discount: 60,
          total_paid: 1200,
          dvt_earned: 120,
          payment_method: 'Movr Wallet',
          currency_code: 'NGN',
          paid_at: '2026-04-08T09:12:00.000Z',
        }),
      });
    }

    const data = shape({
      txn_ref: row.txn_ref || row.public_ref || `MVR-TXN-${String(id).slice(-5).toUpperCase()}`,
      service_label: row.rr_service || row.service_label || 'Standard Ride',
      driver_name: row.driver_name || row.driver_full || 'Emeka Okafor',
      pickup_label: row.pickup_label || row.pickup_address,
      destination_label: row.destination_label || row.dropoff_address,
      duration_minutes: row.duration_minutes,
      distance_km: row.distance_km,
      base_fare: row.rr_base ?? row.base_fare,
      distance_fare: row.rr_dist ?? row.distance_fare,
      dvt_discount: row.rr_disc ?? row.dvt_discount,
      total_paid: row.total_paid ?? row.actual_fare ?? row.estimated_fare,
      dvt_earned: row.rr_dvt ?? row.dvt_earned,
      payment_method: row.rr_pay || row.payment_method || 'Movr Wallet',
      currency_code: row.rr_cur || 'NGN',
      paid_at: row.paid_at || row.completed_at,
    });

    await authDb
      .query(
        `INSERT INTO ride_receipts (
           ride_id, destination_label, duration_minutes, distance_km, base_fare, distance_fare,
           dvt_discount, total_paid, dvt_earned, currency_code, txn_ref, service_label,
           driver_name, pickup_label, payment_method, paid_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (ride_id) DO UPDATE SET
           txn_ref = COALESCE(EXCLUDED.txn_ref, ride_receipts.txn_ref),
           service_label = EXCLUDED.service_label,
           driver_name = EXCLUDED.driver_name,
           pickup_label = EXCLUDED.pickup_label,
           payment_method = EXCLUDED.payment_method,
           paid_at = COALESCE(EXCLUDED.paid_at, ride_receipts.paid_at)`,
        [
          row.id || id,
          data.to,
          data.durationMinutes,
          data.distanceKm,
          data.baseFare,
          data.distanceFare,
          data.dvtDiscount,
          data.totalPaid,
          data.dvtEarned,
          data.currency,
          data.txnRef,
          data.service,
          data.driverName,
          data.from,
          data.paymentMethod,
          data.paidAt,
        ]
      )
      .catch(() => undefined);

    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/v1/auth/forgot-password', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const identifier = String(req.body.phone || req.body.email || req.body.identifier || '').trim();
    if (!identifier) {
      return res.status(400).json({ status: 'error', message: 'Email or phone is required' });
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const user = await findUserForPasswordReset(identifier).catch(() => null);
    const storeKey = normalizeAuthIdentifier(identifier);

    await persistOtp({
      identifier,
      code,
      purpose: 'reset',
      userId: user?.id,
    });

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

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const storeKey = normalizeAuthIdentifier(identifier);
    let userId: string | undefined;
    if (purpose === 'reset') {
      const user = await findUserForPasswordReset(identifier).catch(() => null);
      userId = user?.id;
    }

    await persistOtp({ identifier, code, purpose: purpose as 'reset' | 'signup', userId });

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

    // Phase 20 — validate OTP format against country rules when phone-based
    try {
      if (!identifier.includes('@')) {
        const { LocalizationService } = require('./services/localization.service');
        const loc = new LocalizationService(authDb);
        const country = await loc.detectCountry({ phoneNumber: identifier });
        if (country && !loc.validateOtp(code, country)) {
          return res.status(400).json({
            status: 'error',
            message: `OTP format invalid for ${country.code || 'this country'}`,
          });
        }
      }
    } catch {
      /* soft fail — still check against store */
    }

    let entry: { code: string; expires: number; userId?: string; purpose: 'reset' | 'signup' } | undefined;
    for (const key of otpLookupKeys(identifier)) {
      const found = otpStore.get(key);
      if (found) {
        entry = found;
        break;
      }
    }

    // DB-backed OTP (survives restarts)
    if (!entry) {
      try {
        const storeKey = normalizeAuthIdentifier(identifier);
        const dbOtp = await authDb.query(
          `SELECT * FROM auth_otps
           WHERE identifier = ANY($1::text[])
             AND purpose = $2
             AND consumed_at IS NULL
             AND expires_at > NOW()
           ORDER BY created_at DESC
           LIMIT 1`,
          [otpLookupKeys(identifier), purpose === 'reset' ? 'reset' : 'signup']
        );
        const row = dbOtp.rows[0];
        if (row && row.code_hash === hashOtp(code)) {
          entry = {
            code,
            expires: new Date(row.expires_at).getTime(),
            userId: row.user_id || undefined,
            purpose: row.purpose,
          };
          await authDb.query(`UPDATE auth_otps SET consumed_at = NOW() WHERE id = $1`, [row.id]);
        } else if (row) {
          await authDb.query(
            `UPDATE auth_otps SET attempts = attempts + 1 WHERE id = $1`,
            [row.id]
          );
        }
      } catch (e: any) {
        logger.warn(`auth_otps lookup skipped: ${e.message}`);
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
    try {
      await authDb.query(
        `UPDATE auth_otps SET consumed_at = NOW()
         WHERE identifier = ANY($1::text[]) AND purpose = $2 AND consumed_at IS NULL`,
        [otpLookupKeys(identifier), entry!.purpose]
      );
    } catch {
      /* optional */
    }

    if (purpose !== 'reset' && entry!.purpose !== 'reset' && !identifier.includes('@')) {
      await authDb
        .query(
          `UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, NOW()),
             onboarding_step = GREATEST(COALESCE(onboarding_step, 1), 1),
             updated_at = NOW()
           WHERE phone = ANY($1::text[]) OR regexp_replace(COALESCE(phone,''), '\\D', '', 'g')
             = regexp_replace($2, '\\D', '', 'g')`,
          [otpLookupKeys(identifier), identifier]
        )
        .catch(() => undefined);
    }

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
    let row: any = null;

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const result = await authDb.getRideById(id);
      row = result.rows?.[0] || null;
    } else {
      const byRef = await authDb.query(
        `SELECT id FROM rides WHERE public_ref = $1 LIMIT 1`,
        [id]
      ).catch(() => ({ rows: [] as any[] }));
      if (byRef.rows[0]?.id) {
        const result = await authDb.getRideById(byRef.rows[0].id);
        row = result.rows?.[0] || null;
      }
    }

    if (!row) {
      const mem = rides.get(id);
      if (!mem) {
        return res.status(404).json({
          status: 'error',
          message: 'Ride not found'
        });
      }
      return res.status(200).json({ status: 'success', data: mem });
    }

    const userId = req.user?.id;
    const isAdmin =
      req.user?.userType === 'admin' ||
      req.user?.user_type === 'admin' ||
      (Array.isArray((req.user as any)?.roles) && (req.user as any).roles.length > 0);
    if (
      userId &&
      !isAdmin &&
      row.customer_id !== userId &&
      row.driver_id !== userId
    ) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    const driverName = [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ').trim();
    const customerName = [row.customer_first_name, row.customer_last_name].filter(Boolean).join(' ').trim();
    const fare = Number(row.actual_fare ?? row.estimated_fare ?? 0);
    const etaMinutes = Number(row.eta_minutes ?? row.estimated_duration_minutes ?? 6);
    const publicRef = row.public_ref || String(row.id).replace(/\D/g, '').slice(-5);
    const disputed =
      String(row.dispute_status || '').toLowerCase() === 'disputed' ||
      String(row.status || '').toLowerCase() === 'disputed';
    const status = String(row.status || '').toLowerCase();
    const timeline = [
      { key: 'confirmed', label: 'Ride confirmed', done: !['requested', 'searching'].includes(status), active: false },
      {
        key: 'en_route',
        label:
          status.includes('arrived') || status.includes('progress') || status === 'completed'
            ? 'Driver en route'
            : `Driver en route · ${etaMinutes} min`,
        active: ['accepted', 'driver_assigned', 'en_route', 'arriving'].includes(status),
        done: ['arrived', 'in_progress', 'started', 'completed'].includes(status),
      },
      {
        key: 'pickup',
        label: 'Pick up',
        active: status === 'arrived',
        done: ['in_progress', 'started', 'completed'].includes(status),
      },
      { key: 'dropoff', label: 'Drop off', done: status === 'completed', active: false },
    ];
    const shareToken = `trip-${publicRef}`;
    const shareUrl = `https://movr.app/t/${shareToken}`;

    res.status(200).json({
      status: 'success',
      data: {
        id: row.id,
        public_ref: publicRef,
        publicRef,
        status: disputed ? 'Disputed fare' : row.status,
        dispute_status: row.dispute_status || null,
        customerId: row.customer_id,
        driverId: row.driver_id,
        customerName: customerName || 'Rider',
        customer_name: customerName || 'Rider',
        rider_name: customerName || 'Rider',
        driver_name: driverName || 'Driver',
        customer_rating: Number(row.customer_rating ?? 4.7),
        trips_today: Number(row.trips_today ?? 0),
        customerAvatarUrl: row.customer_avatar_url || null,
        pickupAddress: row.pickup_address,
        pickup_address: row.pickup_address,
        dropoffAddress: row.dropoff_address,
        dropoff_address: row.dropoff_address,
        etaMinutes,
        eta_minutes: etaMinutes,
        etaLabel: `Driver is ${etaMinutes} min away`,
        matchedHeadline: 'Driver matched!',
        arrivingLabel: `Arriving in ${etaMinutes} min`,
        paymentMethod: row.payment_method || 'Movr Wallet',
        timeline,
        shareToken,
        shareUrl,
        driverLocation: {
          lat: row.driver_lat != null ? Number(row.driver_lat) : null,
          lng: row.driver_lng != null ? Number(row.driver_lng) : null,
        },
        pickup: {
          lat: row.pickup_lat,
          lng: row.pickup_lng,
          address: row.pickup_address,
        },
        dropoff: {
          lat: row.dropoff_lat,
          lng: row.dropoff_lng,
          address: row.dropoff_address,
        },
        destinationName: row.dropoff_address || 'Destination',
        fare,
        actual_fare: fare,
        estimated_fare: Number(row.estimated_fare ?? fare),
        currency: row.currency_code || 'NGN',
        fareBreakdown: {
          base: Number(row.base_fare ?? (Math.round(fare * 0.75) || 900)),
          distance: Number(row.distance_fare ?? (Math.round(fare * 0.2) || 240)),
          dvtDiscount: Number(row.dvt_discount ?? 60),
          total: Number(row.actual_fare ?? fare) || 1080,
          distanceKm: Number(row.distance_km ?? 8.4),
          durationMinutes: Number(row.duration_minutes ?? row.estimated_duration_minutes ?? 18),
          dvtEarned: Number(row.dvt_earned ?? 120),
        },
        driver: row.driver_id
          ? {
              id: row.driver_id,
              name: driverName || 'Driver',
              rating: Number(row.driver_rating || 4.9),
              tripCount: Number(row.driver_trip_count ?? row.trips_today ?? 312),
              avatarUrl: row.driver_avatar_url || null,
              phone: row.driver_phone || null,
              vehicle: {
                plate: row.vehicle_plate || 'LAG 294-HG',
                model: row.vehicle_model || 'Toyota Corolla',
                color: row.vehicle_color || 'Silver',
                type: row.vehicle_type || null,
                photoUrl: row.vehicle_photo_url || null,
              },
            }
          : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
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
    const limit = Math.min(Number(req.query.limit || 20), 50);

    let dbRides: any[] = [];
    try {
      const result = await authDb.query(
        `SELECT id, pickup_address, dropoff_address, status,
                estimated_fare, actual_fare, created_at, completed_at
         FROM rides
         WHERE customer_id = $1
           AND status IN ('completed', 'cancelled')
         ORDER BY COALESCE(completed_at, created_at) DESC
         LIMIT $2`,
        [customerId, limit]
      );
      dbRides = result.rows.map((r: any) => ({
        id: r.id,
        pickup_address: r.pickup_address,
        dropoff_address: r.dropoff_address,
        pickupAddress: r.pickup_address,
        dropoffAddress: r.dropoff_address,
        status: r.status,
        estimated_fare: r.estimated_fare,
        actual_fare: r.actual_fare,
        created_at: r.created_at,
        completed_at: r.completed_at,
      }));
    } catch (e: any) {
      logger.warn(`DB rides history failed: ${e.message}`);
    }

    const memRides = Array.from(rides.values()).filter((r: any) => r.customerId === customerId);
    res.status(200).json({
      status: 'success',
      data: {
        rides: dbRides.length ? dbRides : memRides,
      },
    });
  } catch (error) {
    logger.error('Get rides error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get rides',
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
  try {
    const amount = Number(req.body?.amount || 0);
    if (!amount || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'amount must be > 0' });
    }
    const userId = req.user!.id;
    const currency = String(req.body?.currency || 'GHS').toUpperCase();
    const reference = `TOPUP-${Date.now()}`;
    const wallet = await authDb.query(
      `SELECT id FROM wallets WHERE user_id = $1 ORDER BY last_updated ASC NULLS LAST LIMIT 1`,
      [userId]
    );
    let walletId = wallet.rows[0]?.id;
    if (!walletId) {
      const created = await authDb.query(
        `INSERT INTO wallets (user_id, balance_fiat, currency)
         VALUES ($1, 0, $2) RETURNING id`,
        [userId, currency]
      );
      walletId = created.rows[0].id;
    }
    await authDb.query(
      `UPDATE wallets SET balance_fiat = COALESCE(balance_fiat, 0) + $1, last_updated = NOW() WHERE id = $2`,
      [amount, walletId]
    );
    await authDb
      .query(
        `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference)
         VALUES ($1, 'topup', $2, $3)`,
        [walletId, amount, reference]
      )
      .catch(() => undefined);
    const bal = await authDb.query(`SELECT balance_fiat, currency FROM wallets WHERE id = $1`, [
      walletId,
    ]);
    res.status(201).json({
      status: 'success',
      message: 'Top-up completed',
      data: {
        reference,
        amount,
        balance: Number(bal.rows[0]?.balance_fiat || amount),
        currency: bal.rows[0]?.currency || currency,
      },
    });
  } catch (error: any) {
    logger.error('Wallet top-up error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Top-up failed' });
  }
});

const notifPrefs = new Map<string, Record<string, boolean>>();

app.get('/api/v1/users/notification-prefs', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  const defaults = {
    driver_assigned: true,
    order_status_updates: true,
    points_earned: true,
    referral_updates: false,
    promotions_offers: false,
    notifications_enabled: true,
  };
  const uid = req.user?.id || 'anon';
  let fromDb: Record<string, any> = {};
  try {
    const r = await authDb.query(`SELECT * FROM user_settings WHERE user_id = $1`, [uid]);
    if (r.rows[0]) {
      fromDb = {
        notifications_enabled: r.rows[0].notifications_enabled !== false,
      };
    }
  } catch {
    /* table may not exist yet */
  }
  res.json({
    status: 'success',
    data: { ...defaults, ...(notifPrefs.get(uid) || {}), ...fromDb },
  });
});

app.patch('/api/v1/users/notification-prefs', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  const uid = req.user?.id || 'anon';
  const prev = notifPrefs.get(uid) || {};
  const next = { ...prev, ...req.body };
  notifPrefs.set(uid, next);
  try {
    if (typeof req.body.notifications_enabled === 'boolean') {
      await authDb.query(
        `INSERT INTO user_settings (user_id, notifications_enabled)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET notifications_enabled = EXCLUDED.notifications_enabled, updated_at = NOW()`,
        [uid, req.body.notifications_enabled]
      );
    }
  } catch (e: any) {
    logger.warn(`user_settings patch skipped: ${e.message}`);
  }
  res.json({ status: 'success', data: next });
});

app.get('/api/v1/users/me', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user?.id;
    const result = await authDb.query(
      `SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.avatar_url,
              u.country, u.language, u.city, u.gender, u.date_of_birth,
              s.notifications_enabled, s.language AS settings_language, s.region
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = $1`,
      [uid]
    );
    const u = result.rows[0];
    if (!u) {
      return res.json({
        status: 'success',
        data: {
          id: req.user?.id,
          email: req.user?.email,
          phone: (req.user as any)?.phone,
          firstName: (req.user as any)?.firstName,
          lastName: (req.user as any)?.lastName,
        },
      });
    }
    const language = u.settings_language || u.language || 'English';
    const region = u.region || (u.country === 'GH' ? 'Ghana' : u.country || 'Ghana');
    res.json({
      status: 'success',
      data: {
        id: u.id,
        email: u.email,
        phone: u.phone,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        avatarUrl: u.avatar_url,
        country: u.country || 'GH',
        city: u.city || 'Accra',
        gender: u.gender || null,
        dateOfBirth: u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : null,
        notificationsEnabled: u.notifications_enabled !== false,
        language,
        region,
        languageRegion: `${language}, ${region}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Failed to load profile' });
  }
});

app.put('/api/v1/users/profile', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user!.id;
    const allowedGender = new Set(['female', 'male', 'non_binary', 'prefer_not_to_say', '']);
    const firstName = req.body.firstName != null ? String(req.body.firstName).trim() : undefined;
    const lastName = req.body.lastName != null ? String(req.body.lastName).trim() : undefined;
    const phone = req.body.phone != null ? String(req.body.phone).replace(/[\s\-()]/g, '') : undefined;
    const country =
      req.body.country != null ? String(req.body.country).trim().toUpperCase() : undefined;
    const city = req.body.city != null ? String(req.body.city).trim() : undefined;
    const genderRaw = req.body.gender != null ? String(req.body.gender) : undefined;
    const gender =
      genderRaw == null
        ? undefined
        : allowedGender.has(genderRaw)
          ? genderRaw || null
          : undefined;
    const dobRaw = req.body.dateOfBirth || req.body.date_of_birth;
    const dateOfBirth =
      dobRaw == null
        ? undefined
        : /^\d{4}-\d{2}-\d{2}$/.test(String(dobRaw))
          ? String(dobRaw)
          : null;

    const result = await authDb.query(
      `UPDATE users SET
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         phone = COALESCE(NULLIF($4, ''), phone),
         country = COALESCE($5, country),
         city = COALESCE($6, city),
         gender = COALESCE($7, gender),
         date_of_birth = COALESCE($8::date, date_of_birth),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, phone, first_name, last_name, user_type, country, city, gender, date_of_birth, avatar_url, is_verified`,
      [uid, firstName ?? null, lastName ?? null, phone ?? null, country ?? null, city ?? null, gender ?? null, dateOfBirth ?? null]
    );
    const u = result.rows[0];
    if (!u) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    res.json({
      status: 'success',
      data: {
        id: u.id,
        email: u.email,
        phone: u.phone || '',
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        userType: u.user_type,
        country: u.country || 'GH',
        city: u.city || 'Accra',
        gender: u.gender || null,
        dateOfBirth: u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : null,
        avatarUrl: u.avatar_url,
        isVerified: !!u.is_verified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Profile update failed' });
  }
});

app.patch('/api/v1/users/me/settings', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user!.id;
    const {
      notificationsEnabled,
      language = 'English',
      region = 'Ghana',
    } = req.body;
    const enabled =
      typeof notificationsEnabled === 'boolean' ? notificationsEnabled : true;
    const result = await authDb.query(
      `INSERT INTO user_settings (user_id, notifications_enabled, language, region)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         notifications_enabled = EXCLUDED.notifications_enabled,
         language = EXCLUDED.language,
         region = EXCLUDED.region,
         updated_at = NOW()
       RETURNING *`,
      [uid, enabled, language, region]
    );
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ============================================
// PUBLIC APP STORE LINKS
// ============================================
app.get('/api/v1/public/app-links', async (_req: ExpressRequest, res: ExpressResponse) => {
  try {
    const result = await authDb.query(
      `SELECT ios_url, android_url, updated_at FROM app_store_links WHERE id = 1 LIMIT 1`
    );
    const row = result.rows?.[0];
    res.json({
      status: 'success',
      data: {
        ios_url: row?.ios_url || 'https://apps.apple.com/app/movr',
        android_url:
          row?.android_url || 'https://play.google.com/store/apps/details?id=io.movr.app',
        updated_at: row?.updated_at || null,
      },
    });
  } catch {
    res.json({
      status: 'success',
      data: {
        ios_url: 'https://apps.apple.com/app/movr',
        android_url: 'https://play.google.com/store/apps/details?id=io.movr.app',
        updated_at: null,
      },
    });
  }
});

app.get('/api/v1/public/locales', async (_req: ExpressRequest, res: ExpressResponse) => {
  const fallback = [
    {
      country_code: 'GH',
      country_name: 'Ghana',
      language_code: 'en',
      language_label: 'English',
      display_label: 'Ghana - English',
      is_default: true,
    },
  ];
  try {
    const rows = await authDb.query(
      `SELECT country_code, country_name, language_code, language_label,
              display_label, is_default, sort_order
       FROM site_locales
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, country_name ASC`
    );
    if (rows.rows.length) {
      return res.json({ status: 'success', data: rows.rows });
    }

    // Derive from countries table when site_locales is empty
    const countries = await authDb.query(
      `SELECT code AS country_code, name AS country_name
       FROM countries
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );
    if (countries.rows.length) {
      return res.json({
        status: 'success',
        data: countries.rows.map((c: any, i: number) => ({
          country_code: c.country_code,
          country_name: c.country_name,
          language_code: 'en',
          language_label: 'English',
          display_label: `${c.country_name} - English`,
          is_default: c.country_code === 'GH',
          sort_order: i + 1,
        })),
      });
    }

    res.json({ status: 'success', data: fallback });
  } catch {
    res.json({ status: 'success', data: fallback });
  }
});

// ============================================
// PUBLIC HELP / LEGAL / STATUS COPY
// ============================================
app.get('/api/v1/public/help/categories', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const cats = await authDb.query(
      `SELECT id, slug, title, description, icon_key, sort_order
       FROM help_categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, title ASC`
    );
    let rows = cats.rows;
    if (q) {
      const arts = await authDb.query(
        `SELECT c.slug AS category_slug
         FROM help_articles a
         JOIN help_categories c ON c.id = a.category_id
         WHERE a.is_active = TRUE
           AND (
             lower(a.title) LIKE $1 OR lower(a.body) LIKE $1 OR lower(a.keywords) LIKE $1
             OR lower(c.title) LIKE $1 OR lower(c.description) LIKE $1
           )`,
        [`%${q}%`]
      );
      const match = new Set(arts.rows.map((r: any) => r.category_slug));
      rows = rows.filter(
        (c: any) =>
          match.has(c.slug) ||
          String(c.title).toLowerCase().includes(q) ||
          String(c.description).toLowerCase().includes(q)
      );
    }
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.json({
      status: 'success',
      data: [
        {
          slug: 'ride',
          title: 'Ride issues',
          description: 'Fare disputes, lost items, safety concerns.',
          icon_key: 'car',
        },
        {
          slug: 'order',
          title: 'Order & delivery',
          description: 'Track orders, report a delivery issue.',
          icon_key: 'package',
        },
        {
          slug: 'pay',
          title: 'Payments & wallet',
          description: 'Refunds, payout issues, top-ups.',
          icon_key: 'card',
        },
      ],
    });
  }
});

app.get('/api/v1/public/help/categories/:slug', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const cat = await authDb.query(
      `SELECT * FROM help_categories WHERE slug = $1 AND is_active = TRUE LIMIT 1`,
      [req.params.slug]
    );
    if (!cat.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Category not found' });
    }
    const articles = await authDb.query(
      `SELECT id, slug, title, body, keywords, sort_order
       FROM help_articles
       WHERE category_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC`,
      [cat.rows[0].id]
    );
    res.json({
      status: 'success',
      data: { ...cat.rows[0], articles: articles.rows },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/v1/public/legal/:slug', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const doc = await authDb.query(
      `SELECT id, slug, title, updated_label, updated_at
       FROM legal_documents
       WHERE slug = $1 AND is_active = TRUE
       LIMIT 1`,
      [req.params.slug]
    );
    if (!doc.rows[0]) {
      return res.status(404).json({ status: 'error', message: 'Document not found' });
    }
    const sections = await authDb.query(
      `SELECT section_number, title, body
       FROM legal_sections
       WHERE document_id = $1
       ORDER BY sort_order ASC, section_number ASC`,
      [doc.rows[0].id]
    );
    res.json({
      status: 'success',
      data: { ...doc.rows[0], sections: sections.rows },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/v1/public/status-copy/:key', async (req: ExpressRequest, res: ExpressResponse) => {
  const defaults: Record<string, any> = {
    no_connection: {
      title: 'No connection',
      body: 'Please check your internet connection and try again. Your data is safe.',
      cta_label: 'Retry Connection',
      meta: {
        secondaryCta: 'Go to Settings',
        offlineFeatures: [
          { id: 'history', label: 'View recent trip history', icon: 'clipboard' },
          { id: 'wallet', label: 'View wallet balance', icon: 'wallet' },
          { id: 'sos', label: 'Access SOS contacts', icon: 'sos' },
        ],
      },
    },
    trip_history_empty: {
      title: 'No trips yet',
      body: 'Your rides, parcels, orders and rentals will all appear here.',
      cta_label: 'Book Your First Ride',
    },
  };
  try {
    const row = await authDb.query(
      `SELECT key, title, body, cta_label, meta FROM app_status_copy WHERE key = $1 LIMIT 1`,
      [req.params.key]
    ).catch(() =>
      authDb.query(`SELECT key, title, body, cta_label FROM app_status_copy WHERE key = $1 LIMIT 1`, [
        req.params.key,
      ])
    );
    res.json({
      status: 'success',
      data: row.rows[0]
        ? { ...row.rows[0], meta: row.rows[0].meta || defaults[req.params.key]?.meta }
        : defaults[req.params.key] || defaults.no_connection,
    });
  } catch {
    res.json({
      status: 'success',
      data: defaults[req.params.key] || defaults.no_connection,
    });
  }
});

app.get('/api/v1/public/offline-capabilities', async (_req: ExpressRequest, res: ExpressResponse) => {
  try {
    const rows = await authDb.query(
      `SELECT id, label, icon_key, sort_order FROM offline_capability_catalog
       WHERE is_active = TRUE ORDER BY sort_order ASC`
    );
    res.json({
      status: 'success',
      data: rows.rows.length
        ? rows.rows
        : [
            { id: 'history', label: 'View recent trip history', icon_key: 'clipboard' },
            { id: 'wallet', label: 'View wallet balance', icon_key: 'wallet' },
            { id: 'sos', label: 'Access SOS contacts', icon_key: 'sos' },
          ],
    });
  } catch {
    res.json({
      status: 'success',
      data: [
        { id: 'history', label: 'View recent trip history', icon_key: 'clipboard' },
        { id: 'wallet', label: 'View wallet balance', icon_key: 'wallet' },
        { id: 'sos', label: 'Access SOS contacts', icon_key: 'sos' },
      ],
    });
  }
});

app.get('/api/v1/public/onboarding', async (_req: ExpressRequest, res: ExpressResponse) => {
  const fallback = [
    {
      sort_order: 1,
      title: 'Ride, shop, and deliver — all in one app',
      body: 'Book a ride, order from local stores, or send a parcel, all from the same place.',
      icon_key: 'van',
    },
    {
      sort_order: 2,
      title: 'Pay with wallet, MoMo, or card',
      body: 'Top up once and use Movr across rides, orders, and deliveries.',
      icon_key: 'wallet',
    },
    {
      sort_order: 3,
      title: 'Earn points on every trip',
      body: 'Redeem rewards or convert points when DVT launches.',
      icon_key: 'points',
    },
  ];
  const landingFallback = {
    brand: 'Movr',
    tagline: 'MOVE · SHOP · DELIVER',
    headline: "Africa's Super-App Is Here",
    body: 'One platform for rides, shopping, deliveries, and rentals — powered by blockchain rewards.',
    ctaPrimary: 'Get Started',
    ctaSecondary: 'Already have an account? Sign in',
    chips: [
      { label: 'Ride', icon: 'car' },
      { label: 'Shop', icon: 'bag' },
      { label: 'Deliver', icon: 'box' },
    ],
  };
  try {
    const [rows, landing] = await Promise.all([
      authDb.query(
        `SELECT sort_order, title, body, icon_key
         FROM onboarding_slides
         WHERE is_active = TRUE
         ORDER BY sort_order ASC`
      ),
      authDb
        .query(`SELECT * FROM onboarding_landing WHERE id = 1`)
        .catch(() => ({ rows: [] as any[] })),
    ]);
    const L = landing.rows[0];
    res.json({
      status: 'success',
      data: rows.rows.length ? rows.rows : fallback,
      landing: L
        ? {
            brand: L.brand,
            tagline: L.tagline,
            headline: L.headline,
            body: L.body,
            ctaPrimary: L.cta_primary,
            ctaSecondary: L.cta_secondary,
            chips: landingFallback.chips,
          }
        : landingFallback,
    });
  } catch {
    res.json({ status: 'success', data: fallback, landing: landingFallback });
  }
});

app.get('/api/v1/me/home-dashboard', authenticateToken, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const uid = req.user!.id;
    const user = await authDb.query(
      `SELECT id, first_name, last_name, avatar_url, home_address, home_lat, home_lng, city, country
       FROM users WHERE id = $1`,
      [uid]
    );
    const u = user.rows[0] || {};
    const wallet = await authDb
      .query(
        `SELECT COALESCE(balance_fiat,0)::float AS balance,
                COALESCE(points_balance, balance_points, 0)::float AS points,
                COALESCE(balance_tokens,0)::float AS tokens,
                COALESCE(currency,'NGN') AS currency
         FROM wallets WHERE user_id = $1`,
        [uid]
      )
      .catch(() => ({ rows: [{ balance: 24500, points: 850, tokens: 2400, currency: 'NGN' }] }));
    const tokens = await authDb
      .query(
        `SELECT COALESCE(balance_pending,0)+COALESCE(balance_onchain,0)::float AS tokens
         FROM token_balances WHERE user_id = $1`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));
    const rides = await authDb
      .query(
        `SELECT id, 'ride' AS kind, COALESCE(dropoff_address, 'Ride') AS title,
                COALESCE(actual_fare, estimated_fare, 0)::float AS amount,
                COALESCE(completed_at, created_at) AS at
         FROM rides WHERE customer_id = $1
         ORDER BY COALESCE(completed_at, created_at) DESC LIMIT 5`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));
    const deliveries = await authDb
      .query(
        `SELECT id, 'deliver' AS kind, 'Package Delivery' AS title,
                COALESCE(delivery_fee,0)::float AS amount, created_at AS at
         FROM deliveries WHERE sender_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));
    const recent = [...rides.rows, ...deliveries.rows]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5)
      .map((r: any) => ({
        id: r.id,
        kind: r.kind,
        title: r.kind === 'ride' ? `Ride to ${String(r.title).split(',')[0]}` : r.title,
        amount: Number(r.amount || 0),
        at: r.at,
      }));
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const w = wallet.rows[0] || {};
    const dvt = Number(tokens.rows[0]?.tokens ?? w.tokens ?? 2400);
    res.json({
      status: 'success',
      data: {
        greeting,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Traveler',
        initials: `${(u.first_name || 'K')[0]}${(u.last_name || 'A')[0]}`.toUpperCase(),
        avatarUrl: u.avatar_url || null,
        location: {
          label: u.home_address || u.city || 'Victoria Island, Lagos',
          lat: Number(u.home_lat || 6.4281),
          lng: Number(u.home_lng || 3.4219),
        },
        wallet: {
          balance: Number(w.balance || 0),
          currency: w.currency || 'NGN',
          tokens: dvt,
          points: Number(w.points || 0),
        },
        services: [
          { id: 'ride', label: 'Ride', icon: 'car' },
          { id: 'shop', label: 'Shop', icon: 'bag' },
          { id: 'deliver', label: 'Deliver', icon: 'box' },
          { id: 'rental', label: 'Rental', icon: 'key' },
        ],
        recent:
          recent.length > 0
            ? recent
            : [
                {
                  id: 'demo-1',
                  kind: 'ride',
                  title: 'Ride to Lekki',
                  amount: 1200,
                  at: new Date().toISOString(),
                },
                {
                  id: 'demo-2',
                  kind: 'deliver',
                  title: 'Package Delivery',
                  amount: 800,
                  at: new Date(Date.now() - 86400000).toISOString(),
                },
              ],
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
app.get(
  '/api/v1/wallet/payment-methods',
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      const wantCatalog =
        String(req.query.catalog || '') === '1' ||
        String(req.query.purpose || '') === 'topup';
      if (wantCatalog) {
        const catalog = await authDb
          .query(
            `SELECT id, label, subtitle, icon_key, sort_order
             FROM wallet_topup_methods WHERE is_active = TRUE ORDER BY sort_order`
          )
          .catch(() => ({ rows: [] as any[] }));
        if (catalog.rows.length) {
          return res.json({
            status: 'success',
            data: catalog.rows.map((m: any, i: number) => ({
              id: m.id,
              provider: m.label,
              method_type: m.id,
              label: m.label,
              subtitle: m.subtitle,
              icon_key: m.icon_key,
              last_four: '',
              is_default: i === 0,
            })),
          });
        }
      }
      const rows = await authDb.query(
        `SELECT id, provider, method_type, label, last_four, is_default
         FROM customer_payment_methods
         WHERE user_id = $1
         ORDER BY is_default DESC, created_at ASC`,
        [req.user!.id]
      );
      if (rows.rows.length) {
        return res.json({ status: 'success', data: rows.rows });
      }
      res.json({
        status: 'success',
        data: [
          {
            id: 'card',
            provider: 'Debit/Credit Card',
            method_type: 'card',
            label: 'Debit/Credit Card',
            subtitle: 'Visa, Mastercard',
            icon_key: 'card',
            last_four: '',
            is_default: true,
          },
          {
            id: 'momo',
            provider: 'Mobile Money',
            method_type: 'momo',
            label: 'Mobile Money',
            subtitle: 'MTN MoMo, Airtel',
            icon_key: 'phone',
            last_four: '',
            is_default: false,
          },
          {
            id: 'crypto',
            provider: 'Crypto / DVT',
            method_type: 'crypto',
            label: 'Crypto / DVT',
            subtitle: 'Polygon, BSC',
            icon_key: 'chain',
            last_four: '',
            is_default: false,
          },
        ],
      });
    } catch {
      res.json({
        status: 'success',
        data: [
          {
            id: 'card',
            provider: 'Debit/Credit Card',
            method_type: 'card',
            label: 'Debit/Credit Card',
            subtitle: 'Visa, Mastercard',
            is_default: true,
          },
          {
            id: 'momo',
            provider: 'Mobile Money',
            method_type: 'momo',
            label: 'Mobile Money',
            subtitle: 'MTN MoMo, Airtel',
            is_default: false,
          },
          {
            id: 'crypto',
            provider: 'Crypto / DVT',
            method_type: 'crypto',
            label: 'Crypto / DVT',
            subtitle: 'Polygon, BSC',
            is_default: false,
          },
        ],
      });
    }
  }
);

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
  logger.error('Unhandled error:', { error: err, requestId: req.requestId });
  if (Sentry?.captureException) Sentry.captureException(err);
  if (Sentry?.Handlers?.errorHandler) {
    return Sentry.Handlers.errorHandler()(err, req, res, next);
  }
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    requestId: req.requestId,
  });
});

// ============================================
// SOCKET.IO EVENTS
// ============================================
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);

  socket.on('ride:status', (data) => {
    io.emit('ride:status-changed', { ...data, timestamp: Date.now() });
  });

  socket.on('ride-chat:join', (rideId: string) => {
    if (rideId) socket.join(`ride-chat:${rideId}`);
  });
  socket.on('ride-chat:message', async (data: any) => {
    if (!data?.rideId || !data?.body) return;
    try {
      const { DatabaseService } = require('./services/database.service');
      const chatDb = new DatabaseService();
      if (data.senderId) {
        await chatDb.query(
          `INSERT INTO ride_messages (ride_id, sender_id, body) VALUES ($1, $2, $3)`,
          [data.rideId, data.senderId, String(data.body).slice(0, 2000)]
        );
      }
    } catch (err) {
      logger.warn('ride-chat persist failed', err);
    }
    io.to(`ride-chat:${data.rideId}`).emit('ride-chat:message', {
      ...data,
      timestamp: Date.now(),
    });
  });

  socket.on('ride:join', (rideId: string) => {
    if (rideId) socket.join(`ride:${rideId}`);
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
      io.to('admin:live').emit('admin:live:marker', {
        ...data,
        id: data.orderId,
        kind: 'parcel',
        timestamp: Date.now(),
      });
    }
  });

  // Phase 17 — admin ops live map (rides / deliveries / rentals)
  socket.on('admin:live:join', () => {
    socket.join('admin:live');
  });
  socket.on('admin:live:leave', () => {
    socket.leave('admin:live');
  });
  socket.on('rental:join', (rentalId: string) => {
    if (rentalId) socket.join(`rental:${rentalId}`);
  });
  socket.on('rental:location', (data: any) => {
    if (data?.rentalId) {
      io.to(`rental:${data.rentalId}`).emit('rental:location', { ...data, timestamp: Date.now() });
      io.to('admin:live').emit('admin:live:marker', {
        ...data,
        id: data.rentalId,
        kind: 'rental',
        timestamp: Date.now(),
      });
    }
  });
  socket.on('ride:location', (data: any) => {
    if (data?.rideId) {
      io.to(`ride:${data.rideId}`).emit('ride:location', { ...data, timestamp: Date.now() });
      io.to('admin:live').emit('admin:live:marker', {
        ...data,
        id: data.rideId,
        kind: 'ride',
        timestamp: Date.now(),
      });
    }
  });
  socket.on('location:update', (data: any) => {
    io.emit('location:updated', { ...data, timestamp: Date.now() });
    io.to('admin:live').emit('admin:live:marker', {
      ...data,
      kind: data.kind || (data.role === 'driver' ? 'ride' : data.kind),
      timestamp: Date.now(),
    });
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
