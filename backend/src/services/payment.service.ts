import winston from 'winston';
import { DatabaseService } from './database.service';
import {
  BulkTransferItem,
  FLUTTERWAVE_CURRENCIES,
  InitializePaymentInput,
  InitializeTransferInput,
  PAYSTACK_CURRENCIES,
  PaymentProvider,
} from './payment-provider.interface';
import { PaystackService } from './paystack.service';
import { FlutterwaveService } from './flutterwave.service';

type ProviderName = 'paystack' | 'flutterwave';

/**
 * Payment facade — resolves Paystack or Flutterwave from config (Phase 0A).
 * All call sites must go through this service.
 */
export class PaymentService {
  private db: DatabaseService;
  private logger: winston.Logger;
  private paystack: PaystackService;
  private flutterwave: FlutterwaveService;

  constructor(db: DatabaseService) {
    this.db = db;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'payment' },
      transports: [new winston.transports.Console()],
    });

    const onVerified = async (reference: string, data: any) => {
      await this.markPaymentCompleted(reference, data);
    };

    this.paystack = new PaystackService(onVerified);
    this.flutterwave = new FlutterwaveService(onVerified);
  }

  async initialize(): Promise<void> {
    const hasPaystack = !!process.env.PAYSTACK_SECRET_KEY;
    const hasFlutterwave = !!process.env.FLUTTERWAVE_SECRET_KEY;
    this.logger.info('Payment service ready', { hasPaystack, hasFlutterwave });
  }

  async getProvider(countryCode?: string): Promise<PaymentProvider> {
    const normalized = countryCode?.toUpperCase();

    if (normalized) {
      const country = await this.db.query<{ provider: ProviderName }>(
        `SELECT provider FROM payment_provider_config
         WHERE scope = 'country' AND country_code = $1 AND is_active = TRUE
         LIMIT 1`,
        [normalized]
      );
      if (country.rows[0]) {
        return this.resolve(country.rows[0].provider);
      }
    }

    const global = await this.db.query<{ provider: ProviderName }>(
      `SELECT provider FROM payment_provider_config
       WHERE scope = 'global' AND is_active = TRUE
       LIMIT 1`
    );

    if (!global.rows[0]) {
      throw new Error(
        'No active payment provider configured. Set a global row in payment_provider_config.'
      );
    }

    return this.resolve(global.rows[0].provider);
  }

  private resolve(name: ProviderName): PaymentProvider {
    return name === 'paystack' ? this.paystack : this.flutterwave;
  }

  validateCurrency(provider: ProviderName, currency: string): void {
    const allowed =
      provider === 'paystack'
        ? (PAYSTACK_CURRENCIES as readonly string[])
        : (FLUTTERWAVE_CURRENCIES as readonly string[]);
    if (!allowed.includes(currency.toUpperCase())) {
      throw new Error(
        `Currency ${currency} is not supported by ${provider}`
      );
    }
  }

  async initializePayment(data: {
    userId: string;
    amount: number;
    currency?: string;
    paymentType: 'subscription' | 'ride' | 'wallet' | 'marketplace' | 'rental' | 'transfer';
    email: string;
    fullName: string;
    phone?: string;
    countryCode?: string;
    metadata?: Record<string, unknown>;
    redirectUrl?: string;
  }) {
    const provider = await this.getProvider(data.countryCode);
    const currency = (data.currency || 'GHS').toUpperCase();
    this.validateCurrency(provider.name, currency);

    const input: InitializePaymentInput = {
      amount: data.amount,
      currency,
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      redirectUrl: data.redirectUrl,
      metadata: {
        paymentType: data.paymentType,
        userId: data.userId,
        ...(data.metadata || {}),
      },
    };

    const result = await provider.initializePayment(input);
    if (!result.success) {
      return result;
    }

    await this.db.createPayment({
      userId: data.userId,
      amount: data.amount,
      currency,
      method: provider.name,
      gateway: provider.name,
      referenceId: result.reference,
      metadata: {
        paymentType: data.paymentType,
        provider: provider.name,
        providerReference: result.providerReference,
        ...data.metadata,
      },
    });

    return {
      success: true,
      paymentLink: result.paymentLink,
      txRef: result.reference,
      reference: result.reference,
      provider: provider.name,
    };
  }

  async verifyPayment(reference: string, countryCode?: string) {
    const provider = await this.getProvider(countryCode);
    const result = await provider.verifyPayment(reference);
    if (result.success) {
      await this.markPaymentCompleted(reference, result);
    }
    return result;
  }

  async initializeTransfer(
    input: InitializeTransferInput & { countryCode?: string }
  ) {
    const provider = await this.getProvider(input.countryCode);
    this.validateCurrency(provider.name, input.currency);
    return provider.initializeTransfer(input);
  }

  async bulkTransfer(items: BulkTransferItem[], countryCode?: string) {
    const provider = await this.getProvider(countryCode);
    return provider.bulkTransfer(items);
  }

  async initializePreauthorization(
    data: InitializePaymentInput & { countryCode?: string }
  ) {
    const provider = await this.getProvider(data.countryCode);
    this.validateCurrency(provider.name, data.currency);
    return provider.initializePreauthorization(data);
  }

  async capturePreauthorization(
    reference: string,
    amount?: number,
    countryCode?: string
  ) {
    const provider = await this.getProvider(countryCode);
    return provider.capturePreauthorization(reference, amount);
  }

  async releasePreauthorization(reference: string, countryCode?: string) {
    const provider = await this.getProvider(countryCode);
    return provider.releasePreauthorization(reference);
  }

  async handlePaystackWebhook(payload: unknown, signature: string) {
    await this.paystack.handleWebhook(payload, signature);
  }

  async handleFlutterwaveWebhook(payload: unknown, signature: string) {
    await this.flutterwave.handleWebhook(payload, signature);
  }

  private async markPaymentCompleted(reference: string, data: any) {
    await this.db.query(
      `UPDATE payments
       SET status = 'completed',
           metadata = metadata || $1::jsonb,
           updated_at = NOW()
       WHERE reference_id = $2`,
      [JSON.stringify({ providerData: data }), reference]
    );

    const paymentResult = await this.db.query(
      `SELECT user_id, amount, metadata FROM payments WHERE reference_id = $1`,
      [reference]
    );
    if (!paymentResult.rows[0]) return;

    const { user_id: userId, amount, metadata } = paymentResult.rows[0];
    const paymentType = metadata?.paymentType;
    if (paymentType === 'wallet') {
      await this.creditWallet(userId, Number(amount));
    } else if (paymentType === 'subscription') {
      await this.activateSubscription(userId, metadata);
    }
  }

  async activateSubscription(userId: string, metadata: any): Promise<void> {
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    await this.db.query(
      `INSERT INTO subscriptions (
        user_id, plan_id, status, amount, currency,
        next_billing_date, auto_renew, created_at
      ) VALUES ($1, $2, 'active', $3, $4, $5, true, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        status = 'active',
        next_billing_date = $5,
        updated_at = NOW()`,
      [
        userId,
        metadata.planId || 'basic_driver',
        metadata.amount || 99,
        'GHS',
        nextBillingDate,
      ]
    );
  }

  async creditWallet(userId: string, amount: number): Promise<void> {
    await this.db.query(
      `UPDATE wallets
       SET balance_fiat = balance_fiat + $1, last_updated = NOW()
       WHERE user_id = $2`,
      [amount, userId]
    );
  }

  async getWalletBalance(userId: string) {
    const result = await this.db.query(
      `SELECT balance_fiat, balance_points, balance_tokens FROM wallets WHERE user_id = $1`,
      [userId]
    );
    return (
      result.rows[0] || {
        balance_fiat: 0,
        balance_points: 0,
        balance_tokens: 0,
      }
    );
  }

  async listProviderConfig() {
    return this.db.query(
      `SELECT id, scope, country_code, provider, is_active, updated_at
       FROM payment_provider_config
       ORDER BY scope, country_code NULLS FIRST`
    );
  }

  async updateProviderConfig(id: string, provider: ProviderName, adminId?: string) {
    const result = await this.db.query(
      `UPDATE payment_provider_config
       SET provider = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [provider, id]
    );

    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'payment_provider.update', 'payment_provider_config', $2, $3::jsonb)`,
      [adminId || null, id, JSON.stringify({ provider })]
    );

    return result.rows[0];
  }
}
