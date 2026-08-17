import { DatabaseService } from './database.service';

export type LedgerMeta = {
  type: string;
  reference?: string;
  title?: string;
  icon?: string;
};

export type PayMethod = 'wallet' | 'card' | 'momo';

export function normalizePayMethod(raw?: string | null, creditFlag?: boolean): PayMethod {
  const s = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['momo', 'mobile_money', 'mtn', 'airtel', 'vodafone'].some((x) => s.includes(x))) {
    return 'momo';
  }
  if (['card', 'visa', 'mastercard', 'debit'].some((x) => s.includes(x))) return 'card';
  if (['wallet', 'fiat', 'credit', 'mobility'].some((x) => s.includes(x))) return 'wallet';
  if (creditFlag === true) return 'wallet';
  return 'wallet';
}

/**
 * Fiat + ride-credit wallet: top-ups, trip fares, subscriptions, shop.
 */
export class WalletLedgerService {
  constructor(private db: DatabaseService) {}

  async ensureWallet(userId: string, currency = 'GHS') {
    const existing = await this.db.query(
      `SELECT id, COALESCE(balance_fiat,0)::float AS balance,
              COALESCE(mobility_credit,0)::float AS mobility_credit,
              COALESCE(currency, $2) AS currency
       FROM wallets WHERE user_id = $1 LIMIT 1`,
      [userId, currency]
    );
    if (existing.rows[0]) return existing.rows[0];
    const created = await this.db.query(
      `INSERT INTO wallets (user_id, balance_fiat, mobility_credit, currency)
       VALUES ($1, 0, 0, $2)
       ON CONFLICT (user_id) DO UPDATE SET last_updated = NOW()
       RETURNING id, COALESCE(balance_fiat,0)::float AS balance,
                 COALESCE(mobility_credit,0)::float AS mobility_credit,
                 COALESCE(currency, $2) AS currency`,
      [userId, currency]
    );
    return created.rows[0];
  }

  async getSpendable(userId: string) {
    const w = await this.ensureWallet(userId);
    return {
      walletId: w.id,
      walletBalance: Number(w.balance || 0),
      mobilityCredit: Number(w.mobility_credit || 0),
      spendable: Number(w.balance || 0) + Number(w.mobility_credit || 0),
      currency: w.currency || 'GHS',
    };
  }

  private async record(walletId: string, amount: number, meta: LedgerMeta) {
    await this.db
      .query(
        `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference, title, icon_key)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [walletId, meta.type, amount, meta.reference || null, meta.title || null, meta.icon || null]
      )
      .catch(() => undefined);
  }

  async credit(userId: string, amount: number, meta: LedgerMeta) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return this.getSpendable(userId);
    const w = await this.ensureWallet(userId);
    await this.db.query(
      `UPDATE wallets SET balance_fiat = COALESCE(balance_fiat,0) + $1, last_updated = NOW() WHERE id = $2`,
      [n, w.id]
    );
    await this.record(w.id, n, meta);
    return this.getSpendable(userId);
  }

  async debitFiat(userId: string, amount: number, meta: LedgerMeta) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return this.getSpendable(userId);
    const w = await this.ensureWallet(userId);
    if (Number(w.balance || 0) < n) {
      throw new Error(
        `Insufficient wallet balance (need ${n.toFixed(2)} ${w.currency || 'GHS'}). Top up first.`
      );
    }
    await this.db.query(
      `UPDATE wallets SET balance_fiat = balance_fiat - $1, last_updated = NOW() WHERE id = $2`,
      [n, w.id]
    );
    await this.record(w.id, -n, meta);
    return this.getSpendable(userId);
  }

  /**
   * Pay a rider fare: mobility credit first, then fiat, then family circle owner.
   */
  async spendForRide(userId: string, amount: number, reference: string) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return { payerId: userId, viaFamily: false, amount: 0, currency: 'GHS' };
    }
    const resolved = await this.resolveRidePayer(userId, n);
    const payerId = resolved.payerId;
    const bal = await this.getSpendable(payerId);
    if (bal.spendable < n) {
      throw new Error(
        `Insufficient wallet balance (need ${n.toFixed(2)} ${bal.currency}, have ${bal.spendable.toFixed(2)}). Top up to pay for this trip.`
      );
    }
    const fromCredit = Math.min(bal.mobilityCredit, n);
    const fromWallet = n - fromCredit;
    await this.db.query(
      `UPDATE wallets SET
         mobility_credit = GREATEST(0, COALESCE(mobility_credit,0) - $2),
         balance_fiat = COALESCE(balance_fiat,0) - $3,
         last_updated = NOW()
       WHERE user_id = $1`,
      [payerId, fromCredit, fromWallet]
    );
    const w = await this.ensureWallet(payerId);
    await this.record(w.id, -n, {
      type: 'ride_payment',
      reference,
      title: 'Trip fare',
      icon: 'ride',
    });
    await this.db
      .query(
        `INSERT INTO mobility_credit_ledger (user_id, amount, currency, source, reference)
         VALUES ($1,$2,$3,'ride_spend',$4)`,
        [payerId, -n, bal.currency, reference]
      )
      .catch(() => undefined);

    if (resolved.viaFamily && resolved.membership) {
      const today = new Date().toISOString().slice(0, 10);
      const prevSpent =
        resolved.membership.spent_on && String(resolved.membership.spent_on).slice(0, 10) === today
          ? Number(resolved.membership.spent_today || 0)
          : 0;
      await this.db
        .query(
          `UPDATE wallet_share_members SET spent_today = $2, spent_on = $3::date WHERE id = $1`,
          [resolved.membership.id, prevSpent + n, today]
        )
        .catch(() => undefined);
    }

    return {
      payerId,
      viaFamily: resolved.viaFamily,
      circleId: resolved.membership?.circle_id || null,
      amount: n,
      currency: bal.currency,
      fromCredit,
      fromWallet,
    };
  }

  async resolveRidePayer(userId: string, amount: number) {
    const bal = await this.getSpendable(userId);
    if (bal.spendable >= amount) {
      return { payerId: userId, viaFamily: false as const, membership: null as any, currency: bal.currency };
    }

    const today = new Date().toISOString().slice(0, 10);
    const memberships = await this.db
      .query(
        `SELECT m.*, c.owner_id, c.currency AS circle_currency
         FROM wallet_share_members m
         JOIN wallet_share_circles c ON c.id = m.circle_id
         WHERE m.member_id = $1 AND m.status = 'active'
         ORDER BY m.created_at ASC`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));

    for (const m of memberships.rows) {
      const spentToday =
        m.spent_on && String(m.spent_on).slice(0, 10) === today ? Number(m.spent_today || 0) : 0;
      const remaining = Number(m.daily_limit || 0) - spentToday;
      if (remaining < amount) continue;
      const ownerBal = await this.getSpendable(m.owner_id);
      if (ownerBal.spendable >= amount) {
        return {
          payerId: m.owner_id,
          viaFamily: true as const,
          membership: m,
          currency: ownerBal.currency || m.circle_currency || 'GHS',
        };
      }
    }

    throw new Error(
      `Insufficient wallet balance (need ${amount.toFixed(2)} ${bal.currency}, have ${bal.spendable.toFixed(2)}). Top up to pay for this trip.`
    );
  }

  parseMeta(ride: any) {
    const raw = ride?.pricing_meta;
    if (!raw) return {} as Record<string, any>;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Record<string, any>;
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? (raw as Record<string, any>) : {};
  }

  /** Charge rider if needed; pay driver 100% of fare into their wallet. */
  async settleCompletedRide(ride: any) {
    if (!ride?.id) return { charged: false, driverCredited: false };
    const method = String(ride.payment_method || '').toLowerCase();
    if (method === 'cash' || method === 'cod') {
      return { charged: false, driverCredited: false };
    }
    const meta = this.parseMeta(ride);
    const fare = Number(ride.actual_fare ?? ride.estimated_fare ?? ride.driver_earnings ?? 0);
    const alreadyPaid =
      String(ride.payment_status || '').toLowerCase() === 'paid' ||
      Boolean(meta.paidWithMobilityCredit || meta.paidWithWallet);
    let charged = alreadyPaid;
    const gatewayPending = method === 'card' || method === 'momo' || method === 'mobile_money';
    if (!alreadyPaid && gatewayPending) {
      return { charged: false, driverCredited: false, awaitingGateway: true };
    }
    if (!alreadyPaid && fare > 0 && ride.customer_id) {
      const spend = await this.spendForRide(ride.customer_id, fare, `RIDE-${ride.id}`);
      charged = true;
      await this.db
        .query(
          `UPDATE rides SET
             payment_method = 'wallet',
             payment_status = 'paid',
             pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
           WHERE id = $1`,
          [
            ride.id,
            JSON.stringify({
              paidWithWallet: true,
              fare,
              payerId: spend.payerId,
              viaFamily: spend.viaFamily,
              fromCredit: spend.fromCredit,
              fromWallet: spend.fromWallet,
            }),
          ]
        )
        .catch(() =>
          this.db
            .query(
              `UPDATE rides SET payment_method = 'wallet', payment_status = 'paid' WHERE id = $1`,
              [ride.id]
            )
            .catch(() => undefined)
        );
    }

    const payout = Number(ride.driver_earnings ?? ride.actual_fare ?? ride.estimated_fare ?? 0);
    let driverCredited = false;
    if (ride.driver_id && payout > 0 && charged && !meta.driverWalletCredited) {
      await this.credit(ride.driver_id, payout, {
        type: 'ride',
        reference: `RIDE-PAYOUT-${ride.id}`,
        title: 'Trip earnings',
        icon: 'ride',
      });
      driverCredited = true;
      await this.db
        .query(
          `UPDATE rides SET
             pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $2::jsonb
           WHERE id = $1`,
          [ride.id, JSON.stringify({ driverWalletCredited: true })]
        )
        .catch(() => undefined);
    }
    return { charged, driverCredited, fare, payout };
  }

  async refundIfPaid(ride: any) {
    if (!ride?.id) return { refunded: false };
    const method = String(ride.payment_method || '').toLowerCase();
    if (method === 'cash' || method === 'cod') return { refunded: false };
    const meta = this.parseMeta(ride);
    if (meta.refunded) return { refunded: false };
    const paid =
      String(ride.payment_status || '').toLowerCase() === 'paid' ||
      Boolean(meta.paidWithMobilityCredit || meta.paidWithWallet);
    if (!paid) return { refunded: false };

    const payerId = meta.payerId || ride.customer_id;
    const fromCredit = Number(meta.fromCredit || 0);
    const fromWallet = Number(meta.fromWallet || 0);
    const fare = Number(ride.estimated_fare ?? ride.actual_fare ?? 0);
    const creditAmt = fromCredit;
    const walletAmt = fromCredit > 0 || fromWallet > 0 ? fromWallet : fare;
    if (payerId && creditAmt + walletAmt > 0) {
      await this.db.query(
        `UPDATE wallets SET
           mobility_credit = COALESCE(mobility_credit,0) + $2,
           balance_fiat = COALESCE(balance_fiat,0) + $3,
           last_updated = NOW()
         WHERE user_id = $1`,
        [payerId, creditAmt, walletAmt]
      );
      const w = await this.ensureWallet(payerId);
      await this.record(w.id, creditAmt + walletAmt, {
        type: 'ride_refund',
        reference: `RIDE-REFUND-${ride.id}`,
        title: 'Trip refund',
        icon: 'ride',
      });
    }
    await this.db
      .query(
        `UPDATE rides SET
           payment_status = 'refunded',
           pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
         WHERE id = $1`,
        [ride.id, JSON.stringify({ refunded: true })]
      )
      .catch(() => undefined);
    return { refunded: true };
  }
}
