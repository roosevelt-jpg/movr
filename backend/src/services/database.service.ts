// backend/src/services/database.service.ts
import { Pool, PoolClient } from 'pg';
import winston from 'winston';

interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * One shared Pool for the whole process. Creating a Pool per `new DatabaseService()`
 * exhausted Postgres ("remaining connection slots are reserved for ... SUPERUSER").
 */
let sharedPool: Pool | null = null;

function getSharedPool(): Pool {
  if (sharedPool) return sharedPool;

  const max = Math.max(2, parseInt(process.env.DB_POOL_MAX || '20', 10) || 20);
  const min = Math.max(0, parseInt(process.env.DB_POOL_MIN || '0', 10) || 0);

  sharedPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'movr_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'movr_platform',
    max,
    min,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });

  sharedPool.on('error', (err) => {
    // Avoid crashing the process on idle client errors
    console.error('Unexpected Postgres pool error', err);
  });

  return sharedPool;
}

export class DatabaseService {
  private pool: Pool;
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      defaultMeta: { service: 'database' },
    });
    this.pool = getSharedPool();
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      const res = await client.query('SELECT NOW()');
      client.release();
      this.logger.info(`Database connected at ${res.rows[0].now}`);
    } catch (error) {
      this.logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async query<T = any>(text: string, values?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, values);
      const duration = Date.now() - start;
      this.logger.debug(`Query completed in ${duration}ms`);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      this.logger.error('Query failed:', { text, error });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // USER OPERATIONS
  // ============================================
  async createUser(data: any) {
    const query = `
      INSERT INTO users (
        phone, email, first_name, last_name, password, avatar_url,
        user_type, country, city, language, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;
    const values = [
      data.phone,
      data.email,
      data.firstName,
      data.lastName,
      data.password,
      data.avatarUrl || null,
      data.userType || 'customer',
      data.country || 'GH',
      data.city,
      data.language || 'en',
    ];
    return this.query(query, values);
  }

  async getUserById(id: string) {
    const query = `
      SELECT id, phone, email, first_name, last_name, avatar_url,
             user_type, country, city, language, is_active, is_verified,
             phone_verified_at, email_verified_at, created_at, updated_at
      FROM users WHERE id = $1
    `;
    return this.query(query, [id]);
  }

  async getUserByEmail(email: string) {
    const query = `
      SELECT id, phone, email, first_name, last_name, password,
             user_type, is_active, is_verified, created_at
      FROM users WHERE email = $1
    `;
    return this.query(query, [email]);
  }

  // ============================================
  // RIDE OPERATIONS
  // ============================================
  async createRide(data: any) {
    const query = `
      INSERT INTO rides (
        customer_id, driver_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
        pickup_address, dropoff_address, ride_type, status, estimated_fare,
        distance_km, estimated_duration_minutes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `;
    const values = [
      data.customerId,
      data.driverId || null,
      data.pickupLat,
      data.pickupLng,
      data.dropoffLat,
      data.dropoffLng,
      data.pickupAddress,
      data.dropoffAddress,
      data.rideType || 'standard',
      'requested',
      data.estimatedFare,
      data.distanceKm,
      data.estimatedDurationMinutes,
    ];
    return this.query(query, values);
  }

  async getRideById(id: string) {
    const query = `
      SELECT r.*,
             c.first_name as customer_first_name, c.last_name as customer_last_name,
             c.phone as customer_phone,
             c.avatar_url as customer_avatar_url,
             COALESCE(cu.rating, 4.7) as customer_rating,
             (
               SELECT COUNT(*)::int FROM rides r2
               WHERE r2.customer_id = r.customer_id
                 AND r2.status = 'completed'
                 AND (
                   r2.completed_at::date = CURRENT_DATE
                   OR r2.completed_at > NOW() - INTERVAL '24 hours'
                 )
             ) as trips_today,
             du.first_name as driver_first_name,
             du.last_name as driver_last_name,
             du.phone as driver_phone,
             du.avatar_url as driver_avatar_url,
             COALESCE(dr.rating, 4.9) as driver_rating,
             COALESCE(
               NULLIF(dv.make_model, ''),
               NULLIF(TRIM(CONCAT_WS(' ', dv.make, dv.model)), ''),
               'Vehicle'
             ) as vehicle_model,
             dv.plate_number as vehicle_plate,
             COALESCE(dv.vehicle_type, dr.vehicle_type) as vehicle_type,
             dv.photo_url as vehicle_photo_url
      FROM rides r
      LEFT JOIN users c ON r.customer_id = c.id
      LEFT JOIN customers cu ON cu.user_id = r.customer_id
      LEFT JOIN users du ON du.id = r.driver_id
      LEFT JOIN drivers dr ON dr.user_id = r.driver_id
      LEFT JOIN LATERAL (
        SELECT plate_number, make_model, make, model, vehicle_type, photo_url, updated_at
        FROM driver_vehicles
        WHERE driver_user_id = r.driver_id
        ORDER BY is_primary DESC NULLS LAST, updated_at DESC NULLS LAST
        LIMIT 1
      ) dv ON TRUE
      WHERE r.id = $1
    `;
    return this.query(query, [id]);
  }

  async updateRideStatus(rideId: string, status: string) {
    const query = `
      UPDATE rides SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `;
    return this.query(query, [status, rideId]);
  }

  // ============================================
  // PAYMENT OPERATIONS
  // ============================================
  async createPayment(data: any) {
    const query = `
      INSERT INTO payments (
        user_id, amount, currency, method, gateway, status,
        reference_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;
    const values = [
      data.userId,
      data.amount,
      data.currency || 'GHS',
      data.method,
      data.gateway || 'flutterwave',
      'pending',
      data.referenceId,
      JSON.stringify(data.metadata || {}),
    ];
    return this.query(query, values);
  }

  async getPaymentByReference(referenceId: string) {
    const query = `SELECT * FROM payments WHERE reference_id = $1`;
    return this.query(query, [referenceId]);
  }

  // ============================================
  // MARKETPLACE OPERATIONS
  // ============================================
  async createStore(data: any) {
    const query = `
      INSERT INTO stores (
        merchant_id, name, description, category, rating,
        is_active, latitude, longitude, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;
    const values = [
      data.merchantId,
      data.name,
      data.description || null,
      data.category,
      5.0,
      true,
      data.latitude,
      data.longitude,
    ];
    return this.query(query, values);
  }

  async listStores(filters?: any) {
    let query = `SELECT * FROM stores WHERE is_active = true`;
    const values: any[] = [];

    if (filters?.category) {
      query += ` AND category = $${values.length + 1}`;
      values.push(filters.category);
    }

    if (filters?.search) {
      query += ` AND (name ILIKE $${values.length + 1} OR description ILIKE $${values.length + 2})`;
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY rating DESC LIMIT 50`;
    return this.query(query, values);
  }

  // ============================================
  // SUBSCRIPTION OPERATIONS
  // ============================================
  async createSubscription(data: any) {
    const query = `
      INSERT INTO subscriptions (
        user_id, plan_id, status, amount, currency, next_billing_date,
        auto_renew, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const values = [
      data.userId,
      data.planId,
      'active',
      data.amount,
      'GHS',
      nextBillingDate,
      data.autoRenew !== false,
    ];
    return this.query(query, values);
  }

  async getActiveSubscription(userId: string) {
    const query = `
      SELECT s.*, p.name as plan_name, p.features
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.created_at DESC LIMIT 1
    `;
    return this.query(query, [userId]);
  }

  // ============================================
  // WALLET OPERATIONS
  // ============================================
  async getWallet(userId: string) {
    const query = `
      SELECT id, user_id, balance_fiat, balance_points, balance_tokens,
             currency, last_updated
      FROM wallets WHERE user_id = $1
    `;
    return this.query(query, [userId]);
  }

  async updateWalletBalance(userId: string, type: string, amount: number) {
    const fieldMap: Record<string, string> = {
      fiat: 'balance_fiat',
      points: 'balance_points',
      tokens: 'balance_tokens',
    };

    const field = fieldMap[type];
    const query = `
      UPDATE wallets SET ${field} = ${field} + $1, last_updated = NOW()
      WHERE user_id = $2 RETURNING *
    `;
    return this.query(query, [amount, userId]);
  }

  // ============================================
  // DRIVER OPERATIONS
  // ============================================
  async getDriverStats(driverId: string) {
    const query = `
      SELECT 
        COUNT(*) as total_rides,
        AVG(rating) as avg_rating,
        SUM(earnings) as total_earnings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_rides
      FROM rides WHERE driver_id = $1
    `;
    return this.query(query, [driverId]);
  }

  async disconnect(): Promise<void> {
    if (sharedPool) {
      await sharedPool.end();
      sharedPool = null;
    }
    this.logger.info('Database pool closed');
  }
}
