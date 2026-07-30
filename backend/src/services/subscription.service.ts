import { DatabaseService } from './database.service';
import { PaymentService } from './payment.service';
import { DriverPerformanceService } from './driver-performance.service';

export class SubscriptionService {
  private performance: DriverPerformanceService;

  constructor(
    private db: DatabaseService,
    private payments: PaymentService
  ) {
    this.performance = new DriverPerformanceService(db);
  }

  async quote(userId: string, planId: string, paymentMethod: 'fiat' | 'dvt' = 'fiat') {
    const plan = await this.db.query(`SELECT * FROM plans WHERE id = $1`, [planId]);
    if (!plan.rows[0]) throw new Error('Plan not found');

    const listPrice = Number(plan.rows[0].amount);
    const perfDiscount = await this.performance.getTierDiscountPct(userId);

    const cfg = await this.db.query(`SELECT * FROM subscription_discount_config WHERE id = 1`);
    const stakingDiscount = Number(cfg.rows[0]?.staking_discount_pct || 0); // Phase 7 on hold
    const maxTotal = Number(cfg.rows[0]?.max_total_discount_pct || 25);

    const raw = perfDiscount + stakingDiscount;
    const discountPct = Math.min(raw, maxTotal);
    const finalPrice = Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;

    const reasons: string[] = [];
    if (perfDiscount) reasons.push(`performance_tier:${perfDiscount}%`);
    if (stakingDiscount) reasons.push(`staking_tier:${stakingDiscount}%`);

    return {
      plan: plan.rows[0],
      paymentMethod,
      listPrice,
      discountAppliedPct: discountPct,
      discountReason: reasons.join('+') || null,
      finalPrice,
      note:
        paymentMethod === 'dvt'
          ? 'DVT payment queued until Phase 5B token system is off hold — use fiat for now'
          : null,
    };
  }

  async activate(
    userId: string,
    data: {
      planId: string;
      paymentMethod?: 'fiat' | 'dvt';
      email: string;
      fullName: string;
      countryCode?: string;
    }
  ) {
    const quote = await this.quote(userId, data.planId, data.paymentMethod || 'fiat');

    if (data.paymentMethod === 'dvt') {
      // TODO: token.service burn/transfer when Phase 5B is enabled
      throw new Error('DVT subscription payments are on hold (Phase 5B)');
    }

    const payment = await this.payments.initializePayment({
      userId,
      amount: quote.finalPrice,
      currency: quote.plan.currency || 'GHS',
      paymentType: 'subscription',
      email: data.email,
      fullName: data.fullName,
      countryCode: data.countryCode || 'GH',
      metadata: {
        planId: data.planId,
        discountAppliedPct: quote.discountAppliedPct,
        discountReason: quote.discountReason,
      },
    });

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const sub = await this.db.query(
      `INSERT INTO subscriptions (
         user_id, plan_id, status, amount, currency, next_billing_date, auto_renew,
         payment_method, discount_applied_pct, discount_reason, list_price, final_price
       ) VALUES ($1,$2,'pending',$3,$4,$5,TRUE,'fiat',$6,$7,$8,$9)
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         amount = EXCLUDED.amount,
         payment_method = EXCLUDED.payment_method,
         discount_applied_pct = EXCLUDED.discount_applied_pct,
         discount_reason = EXCLUDED.discount_reason,
         list_price = EXCLUDED.list_price,
         final_price = EXCLUDED.final_price,
         next_billing_date = EXCLUDED.next_billing_date,
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
      ]
    );

    return { subscription: sub.rows[0], quote, payment };
  }
}
