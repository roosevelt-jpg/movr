import winston from 'winston';
import { DatabaseService } from './database.service';
import {
  BulkTransferItem,
  FLUTTERWAVE_CURRENCIES,
  InitializePaymentInput,
  InitializeTransferInput,
  PAYSTACK_CURRENCIES,
  PaymentProvider,
  STRIPE_CURRENCIES,
} from './payment-provider.interface';
import { PaystackService } from './paystack.service';
import { FlutterwaveService } from './flutterwave.service';
import { StripeService } from './stripe.service';
import { IntegrationsService } from './integrations.service';

type ProviderName = 'paystack' | 'flutterwave' | 'stripe';

/**
 * Payment facade — resolves Paystack, Flutterwave, or Stripe from config.
 * All call sites must go through this service.
 */
export class PaymentService {
  private db: DatabaseService;
  private logger: winston.Logger;
  private paystack: PaystackService;
  private flutterwave: FlutterwaveService;
  private stripe: StripeService;
  private integrations: IntegrationsService;
  private credentialsLoaded = false;

  constructor(db: DatabaseService) {
    this.db = db;
    this.integrations = new IntegrationsService(db);
    this.logger = winston.createLogger({
      defaultMeta: { service: 'payment' },
      transports: [new winston.transports.Console()],
    });

    const onVerified = async (reference: string, data: any) => {
      await this.markPaymentCompleted(reference, data);
    };

    this.paystack = new PaystackService(onVerified);
    this.flutterwave = new FlutterwaveService(onVerified);
    this.stripe = new StripeService(onVerified);
  }

  async initialize(): Promise<void> {
    await this.ensureProviderDefaults();
    await this.refreshProviderCredentials();
    const hasPaystack = !!process.env.PAYSTACK_SECRET_KEY;
    const hasFlutterwave = !!process.env.FLUTTERWAVE_SECRET_KEY;
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;
    this.logger.info('Payment service ready', { hasPaystack, hasFlutterwave, hasStripe });
  }

  /** Seed global + Paystack live-market country rows if missing (Phase 0A). */
  async ensureProviderDefaults(): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
         SELECT 'global', NULL, 'flutterwave', TRUE
         WHERE NOT EXISTS (
           SELECT 1 FROM payment_provider_config WHERE scope = 'global' AND is_active = TRUE
         )`
      );
      await this.db.query(
        `INSERT INTO payment_provider_config (scope, country_code, provider, is_active)
         SELECT v.scope::payment_provider_scope, v.country_code, v.provider::payment_provider_name, TRUE
         FROM (VALUES
           ('country', 'GH', 'paystack'),
           ('country', 'NG', 'paystack'),
           ('country', 'ZA', 'paystack'),
           ('country', 'KE', 'paystack'),
           ('country', 'CI', 'paystack')
         ) AS v(scope, country_code, provider)
         WHERE NOT EXISTS (
           SELECT 1 FROM payment_provider_config p
           WHERE p.scope = 'country' AND p.country_code = v.country_code AND p.is_active = TRUE
         )`
      );
    } catch (e: any) {
      this.logger.warn(`ensureProviderDefaults skipped: ${e.message}`);
    }
  }

  /**
   * Resolve secrets via Integrations Hub first, then .env.
   */
  async refreshProviderCredentials(): Promise<void> {
    try {
      const paystackSecret =
        (await this.integrations.getCredential('paystack', 'secret_key')) ||
        process.env.PAYSTACK_SECRET_KEY ||
        '';
      const flutterwaveSecret =
        (await this.integrations.getCredential('flutterwave', 'secret_key')) ||
        process.env.FLUTTERWAVE_SECRET_KEY ||
        '';
      const flutterwaveHash =
        (await this.integrations.getCredential('flutterwave', 'secret_hash')) ||
        process.env.FLUTTERWAVE_SECRET_HASH ||
        '';
      const stripeSecret =
        (await this.integrations.getCredential('stripe', 'secret_key')) ||
        process.env.STRIPE_SECRET_KEY ||
        '';
      const stripeWebhook =
        (await this.integrations.getCredential('stripe', 'webhook_secret')) ||
        process.env.STRIPE_WEBHOOK_SECRET ||
        '';

      this.paystack.setSecretKey(paystackSecret);
      this.flutterwave.setSecretKey(flutterwaveSecret);
      this.flutterwave.setSecretHash(flutterwaveHash);
      this.stripe.setSecretKey(stripeSecret);
      this.stripe.setWebhookSecret(stripeWebhook);
      this.credentialsLoaded = true;

      if (paystackSecret) {
        await this.db.query(
          `UPDATE integrations SET status = 'configured', updated_at = NOW()
           WHERE key = 'paystack' AND status = 'not_configured'`
        );
      }
      if (flutterwaveSecret) {
        await this.db.query(
          `UPDATE integrations SET status = 'configured', updated_at = NOW()
           WHERE key = 'flutterwave' AND status = 'not_configured'`
        );
      }
      if (stripeSecret) {
        await this.db.query(
          `UPDATE integrations SET status = 'configured', updated_at = NOW()
           WHERE key = 'stripe' AND status = 'not_configured'`
        );
      }
    } catch (e: any) {
      this.logger.warn(`refreshProviderCredentials: ${e.message}`);
    }
  }

  async getProvider(countryCode?: string): Promise<PaymentProvider> {
    if (!this.credentialsLoaded) {
      await this.refreshProviderCredentials();
    }
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
    if (name === 'paystack') return this.paystack;
    if (name === 'stripe') return this.stripe;
    return this.flutterwave;
  }

  validateCurrency(provider: ProviderName, currency: string): void {
    const allowed =
      provider === 'paystack'
        ? (PAYSTACK_CURRENCIES as readonly string[])
        : provider === 'stripe'
          ? (STRIPE_CURRENCIES as readonly string[])
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

  async handleStripeWebhook(payload: unknown, signature: string) {
    await this.stripe.handleWebhook(payload, signature);
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
       ORDER BY
         CASE WHEN scope = 'global' THEN 0 ELSE 1 END,
         CASE country_code
           WHEN 'GH' THEN 1
           WHEN 'NG' THEN 2
           WHEN 'KE' THEN 3
           WHEN 'SN' THEN 4
           WHEN 'STBY' THEN 5
           ELSE 9
         END,
         country_code NULLS FIRST`
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
