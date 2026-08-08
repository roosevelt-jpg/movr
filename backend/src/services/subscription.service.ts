import { DatabaseService } from './database.service';
import { PaymentService } from './payment.service';
import { DriverPerformanceService } from './driver-performance.service';
import { StakingService } from './staking.service';
import { TokenService } from './token.service';

export type BillingInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export class SubscriptionService {
  private performance: DriverPerformanceService;
  private staking: StakingService;
  private tokens: TokenService;

  constructor(
    private db: DatabaseService,
    private payments: PaymentService
  ) {
    this.performance = new DriverPerformanceService(db);
    this.staking = new StakingService(db);
    this.tokens = new TokenService(db);
  }

  /** Normalize plan interval / id hint → billing cadence. */
  static parseInterval(raw: unknown): BillingInterval {
    const s = String(raw || '').toLowerCase();
    if (s.includes('week')) return 'weekly';
    if (s.includes('quarter') || s.includes('_q') || s.endsWith('_q')) return 'quarterly';
    if (s.includes('year') || s.includes('annual') || s.includes('_y') || s.endsWith('_y'))
      return 'yearly';
    return 'monthly';
  }

  /** Advance from now by the plan billing cadence. */
  static nextBillingDate(interval: unknown, from: Date = new Date()): Date {
    const next = new Date(from);
    switch (SubscriptionService.parseInterval(interval)) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  async quote(userId: string, planId: string, paymentMethod: 'fiat' | 'dvt' = 'fiat') {
    const plan = await this.db.query(`SELECT * FROM plans WHERE id = $1`, [planId]);
    if (!plan.rows[0]) throw new Error('Plan not found');

    const listPrice = Number(plan.rows[0].amount);
    const perfDiscount = await this.performance.getTierDiscountPct(userId);

    const cfg = await this.db.query(`SELECT * FROM subscription_discount_config WHERE id = 1`);
    const driverTier = await this.staking.getTier(userId, 'driver');
    const stakingDiscount =
      driverTier.feeDiscountPct || Number(cfg.rows[0]?.staking_discount_pct || 0);
    const maxTotal = Number(cfg.rows[0]?.max_total_discount_pct || 25);

    const raw = perfDiscount + stakingDiscount;
    const discountPct = Math.min(raw, maxTotal);
    const finalPrice = Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;

    const reasons: string[] = [];
    if (perfDiscount) reasons.push(`performance_tier:${perfDiscount}%`);
    if (stakingDiscount) reasons.push(`staking_tier:${stakingDiscount}%`);

    const discounts = [
      ...(perfDiscount
        ? [{ key: 'pro_tier', label: 'Pro tier discount', pct: perfDiscount }]
        : []),
      ...(stakingDiscount
        ? [{ key: 'staking', label: 'Staking discount', pct: stakingDiscount }]
        : []),
    ];

    return {
      plan: plan.rows[0],
      paymentMethod,
      listPrice,
      discountAppliedPct: discountPct,
      discountReason: reasons.join('+') || null,
      discounts,
      finalPrice,
      note:
        paymentMethod === 'dvt' && !this.tokens.isEnabled()
          ? 'Set TOKEN_SYSTEM_ENABLED=true to pay subscriptions in DVT'
          : null,
    };
  }

  async activate(
    userId: string,
    data: {
      planId: string;
      paymentMethod?: 'fiat' | 'dvt' | 'wallet';
      email: string;
      fullName: string;
      countryCode?: string;
    }
  ) {
    const method = data.paymentMethod === 'dvt' ? 'dvt' : 'fiat';
    const quote = await this.quote(userId, data.planId, method);

    let payment: any = null;
    if (method === 'dvt') {
      if (!this.tokens.isEnabled()) {
        throw new Error('DVT payments disabled (TOKEN_SYSTEM_ENABLED)');
      }
      const rate = await this.tokens.getRedeemRate();
      const dvtNeeded = quote.finalPrice * Number(rate.dvt_per_fiat_unit);
      await this.tokens.redeem(userId, dvtNeeded);
      payment = { method: 'dvt', dvtSpent: dvtNeeded, fiatEquivalent: quote.finalPrice };
    } else {
      // Wallet (fiat) — debit driver wallet balance immediately
      const wallet = await this.db.query(
        `SELECT id, balance_fiat FROM wallets WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      let walletId = wallet.rows[0]?.id;
      if (!walletId) {
        const created = await this.db.query(
          `INSERT INTO wallets (user_id, balance_fiat, currency) VALUES ($1, 0, 'GHS') RETURNING id, balance_fiat`,
          [userId]
        );
        walletId = created.rows[0].id;
      }
      const bal = Number(wallet.rows[0]?.balance_fiat ?? 0);
      if (bal < quote.finalPrice) {
        throw new Error(`Insufficient wallet balance (need GH₵${quote.finalPrice.toFixed(2)})`);
      }
      await this.db.query(
        `UPDATE wallets SET balance_fiat = balance_fiat - $1, last_updated = NOW() WHERE id = $2`,
        [quote.finalPrice, walletId]
      );
      payment = { method: 'wallet', amount: quote.finalPrice, currency: quote.plan.currency || 'GHS' };
    }

    const nextBilling = SubscriptionService.nextBillingDate(
      quote.plan?.interval || data.planId
    );

    const status = 'active';
    const sub = await this.db.query(
      `INSERT INTO subscriptions (
         user_id, plan_id, status, amount, currency, next_billing_date, auto_renew,
         payment_method, discount_applied_pct, discount_reason, list_price, final_price,
         paused_at, paused_until, pause_reason
       ) VALUES ($1,$2,$11,$3,$4,$5,TRUE,$10,$6,$7,$8,$9,NULL,NULL,NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         amount = EXCLUDED.amount,
         payment_method = EXCLUDED.payment_method,
         discount_applied_pct = EXCLUDED.discount_applied_pct,
         discount_reason = EXCLUDED.discount_reason,
         list_price = EXCLUDED.list_price,
         final_price = EXCLUDED.final_price,
         next_billing_date = EXCLUDED.next_billing_date,
         paused_at = NULL,
         paused_until = NULL,
         pause_reason = NULL,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        data.planId,
        quote.finalPrice,
        quote.plan.currency || 'GHS',
        nextBilling,
        quote.discountAppliedPct,
        quote.discountReason,
        quote.listPrice,
        quote.finalPrice,
        method,
        status,
      ]
    );

    return { subscription: sub.rows[0], quote, payment };
  }

  /**
   * Pause subscription — stop billing while driver is offline / cash-tight.
   * They keep 100% of any fares they still take; go offline until resume.
   */
  async pause(userId: string, opts?: { days?: number; reason?: string }) {
    const days = Math.min(90, Math.max(1, Number(opts?.days) || 14));
    const until = new Date(Date.now() + days * 86400000);
    const result = await this.db.query(
      `UPDATE subscriptions SET
         status = 'paused',
         paused_at = NOW(),
         paused_until = $2,
         pause_reason = $3,
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, until, opts?.reason || 'driver_requested']
    );
    if (!result.rows[0]) throw new Error('No subscription to pause');
    return {
      subscription: result.rows[0],
      message: `Plan paused until ${until.toLocaleDateString()}. You still keep 100% of every fare when you drive.`,
    };
  }

  async resume(userId: string) {
    const result = await this.db.query(
      `UPDATE subscriptions SET
         status = 'active',
         paused_at = NULL,
         paused_until = NULL,
         pause_reason = NULL,
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId]
    );
    if (!result.rows[0]) throw new Error('No subscription to resume');
    return {
      subscription: result.rows[0],
      message: 'Plan resumed. Keep 100% of every fare — no commission, ever.',
    };
  }
}