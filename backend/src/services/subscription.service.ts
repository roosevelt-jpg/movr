import { DatabaseService } from './database.service';
import { PaymentService } from './payment.service';
import { DriverPerformanceService } from './driver-performance.service';
import { StakingService } from './staking.service';
import { TokenService } from './token.service';
import { WalletLedgerService, normalizePayMethod } from './wallet-ledger.service';
import { LocalizationService } from './localization.service';

export type BillingInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export class SubscriptionService {
  private performance: DriverPerformanceService;
  private staking: StakingService;
  private tokens: TokenService;
  private ledger: WalletLedgerService;
  private localization: LocalizationService;

  constructor(
    private db: DatabaseService,
    private payments: PaymentService
  ) {
    this.performance = new DriverPerformanceService(db);
    this.staking = new StakingService(db);
    this.tokens = new TokenService(db);
    this.ledger = new WalletLedgerService(db);
    this.localization = new LocalizationService(db);
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

  async quote(
    userId: string,
    planId: string,
    paymentMethod: 'fiat' | 'dvt' = 'fiat',
    countryCode?: string
  ) {
    const plan = await this.db.query(`SELECT * FROM plans WHERE id = $1`, [planId]);
    if (!plan.rows[0]) throw new Error('Plan not found');

    const listPrice = Number(plan.rows[0].amount);
    const planCurrency = String(plan.rows[0].currency || 'GHS').toUpperCase();
    const perfDiscount = await this.performance.getTierDiscountPct(userId);

    const cfg = await this.db.query(`SELECT * FROM subscription_discount_config WHERE id = 1`);
    const driverTier = await this.staking.getTier(userId, 'driver');
    const stakingDiscount =
      driverTier.feeDiscountPct || Number(cfg.rows[0]?.staking_discount_pct || 0);
    const maxTotal = Number(cfg.rows[0]?.max_total_discount_pct || 25);

    const raw = perfDiscount + stakingDiscount;
    const discountPct = Math.min(raw, maxTotal);
    const finalPricePlan = Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;

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

    let country = String(countryCode || '').toUpperCase();
    if (!country) {
      const u = await this.db
        .query(`SELECT country FROM users WHERE id = $1`, [userId])
        .catch(() => ({ rows: [] as any[] }));
      country = String(u.rows[0]?.country || 'GH').toUpperCase();
    }

    const localized = await this.localization.localizeMoney(
      finalPricePlan,
      planCurrency,
      country
    );
    const localizedList = await this.localization.localizeMoney(
      listPrice,
      planCurrency,
      country
    );

    return {
      plan: {
        ...plan.rows[0],
        amount: localized.chargeAmount,
        currency: localized.chargeCurrency,
      },
      paymentMethod,
      listPrice: localizedList.chargeAmount,
      discountAppliedPct: discountPct,
      discountReason: reasons.join('+') || null,
      discounts,
      finalPrice: localized.chargeAmount,
      currency: localized.chargeCurrency,
      displayCurrency: localized.displayCurrency,
      displayAmount: localized.displayAmount,
      countryCode: country,
      base: {
        listPrice,
        finalPrice: finalPricePlan,
        currency: planCurrency,
      },
      note:
        paymentMethod === 'dvt' && !this.tokens.isEnabled()
          ? 'Set TOKEN_SYSTEM_ENABLED=true to pay subscriptions in DVT'
          : `Priced for ${country} · pay via Flutterwave in ${localized.chargeCurrency}`,
    };
  }

  async activate(
    userId: string,
    data: {
      planId: string;
      paymentMethod?: 'fiat' | 'dvt' | 'wallet' | 'card' | 'momo' | 'mobile_money';
      paymentMethodId?: string;
      email: string;
      fullName: string;
      phone?: string;
      countryCode?: string;
    }
  ) {
    const requestMethod = String(data.paymentMethod || 'wallet').toLowerCase();
    const method = requestMethod === 'dvt' ? 'dvt' : normalizePayMethod(requestMethod);
    const quote = await this.quote(
      userId,
      data.planId,
      requestMethod === 'dvt' ? 'dvt' : 'fiat',
      data.countryCode
    );
    const chargeCurrency = quote.currency || quote.plan.currency || 'GHS';

    let payment: any = null;
    if (requestMethod === 'dvt') {
      if (!this.tokens.isEnabled()) {
        throw new Error('DVT payments disabled (TOKEN_SYSTEM_ENABLED)');
      }
      const rate = await this.tokens.getRedeemRate();
      const dvtNeeded = quote.finalPrice * Number(rate.dvt_per_fiat_unit);
      await this.tokens.redeem(userId, dvtNeeded);
      payment = { method: 'dvt', dvtSpent: dvtNeeded, fiatEquivalent: quote.finalPrice };
    } else if (method === 'card' || method === 'momo') {
      const checkout = await this.payments.initializePayment({
        userId,
        amount: quote.finalPrice,
        currency: chargeCurrency,
        paymentType: 'subscription',
        email: data.email,
        fullName: data.fullName || 'MOVR',
        phone: data.phone,
        countryCode: data.countryCode || quote.countryCode || 'GH',
        preferredProvider: 'flutterwave',
        channels: method === 'momo' ? ['mobile_money'] : ['card'],
        metadata: {
          planId: data.planId,
          channel: method,
          paymentMethod: method,
          paymentMethodId: data.paymentMethodId || null,
          amount: quote.finalPrice,
          currency: chargeCurrency,
          displayCurrency: quote.displayCurrency,
          displayAmount: quote.displayAmount,
          interval: quote.plan?.interval || null,
          listPrice: quote.listPrice,
          finalPrice: quote.finalPrice,
        },
      });
      if (!checkout?.success) {
        throw new Error(
          checkout?.error ||
            `Could not start Flutterwave ${method === 'momo' ? 'MoMo' : 'card'} checkout. Try wallet balance instead.`
        );
      }
      return {
        requiresPayment: true,
        payment: checkout,
        quote,
        subscription: null,
      };
    } else {
      await this.ledger.debitFiat(userId, quote.finalPrice, {
        type: 'subscription',
        reference: `SUB-${data.planId}-${Date.now()}`,
        title: 'Plan subscription',
        icon: 'plan',
      });
      payment = {
        method: 'wallet',
        amount: quote.finalPrice,
        currency: chargeCurrency,
      };
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
         currency = EXCLUDED.currency,
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
        chargeCurrency,
        nextBilling,
        quote.discountAppliedPct,
        quote.discountReason,
        quote.listPrice,
        quote.finalPrice,
        requestMethod === 'dvt' ? 'dvt' : method === 'momo' ? 'momo' : method === 'card' ? 'card' : 'fiat',
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