import winston from 'winston';
import { DatabaseService } from './database.service';
import { PaymentService } from './payment.service';

export class SettlementService {
  private logger = winston.createLogger({
    defaultMeta: { service: 'settlement' },
    transports: [new winston.transports.Console()],
  });

  constructor(
    private db: DatabaseService,
    private payments: PaymentService
  ) {}

  async rollupGmv(forDate?: Date) {
    const day = forDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = day.toISOString().slice(0, 10);

    const rideGmv = await this.db.query(
      `SELECT COALESCE(country, 'GH') AS country,
              COALESCE(SUM(COALESCE(actual_fare, estimated_fare, 0)), 0) AS gmv
       FROM rides r
       LEFT JOIN users u ON u.id = r.customer_id
       WHERE r.status = 'completed' AND r.completed_at::date = $1::date
       GROUP BY 1`,
      [dateStr]
    );

    for (const row of rideGmv.rows) {
      await this.upsertGmv(dateStr, row.country, 'ride', Number(row.gmv));
    }

    const shopGmv = await this.db.query(
      `SELECT COALESCE(u.country, 'GH') AS country, COALESCE(SUM(o.total), 0) AS gmv
       FROM marketplace_orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.status = 'completed' AND o.updated_at::date = $1::date
       GROUP BY 1`,
      [dateStr]
    );
    for (const row of shopGmv.rows) {
      await this.upsertGmv(dateStr, row.country, 'shop', Number(row.gmv));
    }

    const parcelGmv = await this.db.query(
      `SELECT COALESCE(u.country, 'GH') AS country, COALESCE(SUM(d.delivery_fee), 0) AS gmv
       FROM deliveries d
       JOIN users u ON u.id = d.sender_id
       WHERE d.status = 'delivered' AND d.updated_at::date = $1::date
       GROUP BY 1`,
      [dateStr]
    );
    for (const row of parcelGmv.rows) {
      await this.upsertGmv(dateStr, row.country, 'parcel', Number(row.gmv));
    }

    const rentalGmv = await this.db.query(
      `SELECT COALESCE(u.country, 'GH') AS country, COALESCE(SUM(r.total_amount), 0) AS gmv
       FROM rentals r
       JOIN users u ON u.id = r.user_id
       WHERE r.status IN ('confirmed','completed') AND r.created_at::date = $1::date
       GROUP BY 1`,
      [dateStr]
    );
    for (const row of rentalGmv.rows) {
      await this.upsertGmv(dateStr, row.country, 'rental', Number(row.gmv));
    }

    this.logger.info('GMV rollup complete', { date: dateStr });
    return { date: dateStr };
  }

  private async upsertGmv(
    date: string,
    country: string,
    serviceType: string,
    amount: number
  ) {
    await this.db.query(
      `INSERT INTO gmv_daily_rollup (date, country, service_type, gmv_amount, currency)
       VALUES ($1::date, $2, $3, $4, 'GHS')
       ON CONFLICT (date, country, service_type, currency) DO UPDATE SET
         gmv_amount = EXCLUDED.gmv_amount`,
      [date, country || 'GH', serviceType, amount]
    );
  }

  async createPayoutBatch(
    recipientType: 'driver' | 'merchant',
    periodStart: Date,
    periodEnd: Date,
    adminId?: string
  ) {
    const batch = await this.db.query(
      `INSERT INTO payout_batches
         (status, recipient_type, period_start, period_end, initiated_by, currency)
       VALUES ('draft', $1, $2, $3, $4, 'GHS')
       RETURNING *`,
      [recipientType, periodStart, periodEnd, adminId || null]
    );

    const batchId = batch.rows[0].id;
    let total = 0;

    if (recipientType === 'driver') {
      const earnings = await this.db.query(
        `SELECT driver_id, COALESCE(SUM(COALESCE(earnings, actual_fare, estimated_fare, 0)), 0) AS amount
         FROM rides
         WHERE status = 'completed'
           AND driver_id IS NOT NULL
           AND completed_at >= $1 AND completed_at < $2
         GROUP BY driver_id
         HAVING SUM(COALESCE(earnings, actual_fare, estimated_fare, 0)) > 0`,
        [periodStart, periodEnd]
      );
      for (const e of earnings.rows) {
        total += Number(e.amount);
        await this.db.query(
          `INSERT INTO payout_batch_items (batch_id, driver_id, amount, status)
           VALUES ($1, $2, $3, 'pending')`,
          [batchId, e.driver_id, e.amount]
        );
      }
    } else {
      const earnings = await this.db.query(
        `SELECT s.merchant_id, COALESCE(SUM(o.total), 0) AS amount
         FROM marketplace_orders o
         JOIN stores s ON s.id = o.store_id
         WHERE o.status = 'completed'
           AND o.updated_at >= $1 AND o.updated_at < $2
         GROUP BY s.merchant_id
         HAVING SUM(o.total) > 0`,
        [periodStart, periodEnd]
      );
      for (const e of earnings.rows) {
        total += Number(e.amount);
        await this.db.query(
          `INSERT INTO payout_batch_items (batch_id, merchant_id, amount, status)
           VALUES ($1, $2, $3, 'pending')`,
          [batchId, e.merchant_id, e.amount]
        );
      }
    }

    await this.db.query(
      `UPDATE payout_batches SET total_amount = $1, status = 'ready' WHERE id = $2`,
      [total, batchId]
    );

    return this.getBatch(batchId);
  }

  async executePayoutBatch(batchId: string, countryCode = 'GH') {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error('Batch not found');

    const items = batch.items || [];
    const transfers = items.map((item: any, i: number) => ({
      amount: Number(item.amount),
      currency: batch.currency || 'GHS',
      reference: `BATCH-${batchId.slice(0, 8)}-${i}`,
      recipient: {
        accountNumber: 'PENDING_ACCOUNT',
        bankCode: 'PENDING',
      },
      narration: `MOVR ${batch.recipient_type} payout`,
    }));

    const results = await this.payments.bulkTransfer(transfers, countryCode);

    for (let i = 0; i < items.length; i++) {
      await this.db.query(
        `UPDATE payout_batch_items SET
           status = $1,
           tx_reference = $2
         WHERE id = $3`,
        [
          results[i]?.success ? 'paid' : 'failed',
          results[i]?.reference || null,
          items[i].id,
        ]
      );
    }

    await this.db.query(
      `UPDATE payout_batches SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [batchId]
    );

    return this.getBatch(batchId);
  }

  async getBatch(batchId: string) {
    const batch = await this.db.query(`SELECT * FROM payout_batches WHERE id = $1`, [batchId]);
    if (!batch.rows[0]) return null;
    const items = await this.db.query(
      `SELECT * FROM payout_batch_items WHERE batch_id = $1`,
      [batchId]
    );
    return { ...batch.rows[0], items: items.rows };
  }

  async listGmv(filters: {
    serviceType?: string;
    country?: string;
    from?: string;
    to?: string;
  }) {
    const values: any[] = [];
    let q = `SELECT * FROM gmv_daily_rollup WHERE 1=1`;
    if (filters.serviceType) {
      values.push(filters.serviceType);
      q += ` AND service_type = $${values.length}`;
    }
    if (filters.country) {
      values.push(filters.country);
      q += ` AND country = $${values.length}`;
    }
    if (filters.from) {
      values.push(filters.from);
      q += ` AND date >= $${values.length}::date`;
    }
    if (filters.to) {
      values.push(filters.to);
      q += ` AND date <= $${values.length}::date`;
    }
    q += ` ORDER BY date DESC, service_type`;
    return this.db.query(q, values);
  }

  async reconciliationCsv(from: string, to: string): Promise<string> {
    const rows = await this.db.query(
      `SELECT date, country, service_type, gmv_amount, currency
       FROM gmv_daily_rollup
       WHERE date >= $1::date AND date <= $2::date
       ORDER BY date, country, service_type`,
      [from, to]
    );
    const header = 'date,country,service_type,gmv_amount,currency';
    const lines = rows.rows.map(
      (r) => `${r.date},${r.country},${r.service_type},${r.gmv_amount},${r.currency}`
    );
    return [header, ...lines].join('\n');
  }
}
