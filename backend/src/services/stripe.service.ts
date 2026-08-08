import Stripe from 'stripe';
import winston from 'winston';
import {
  BulkTransferItem,
  InitializePaymentInput,
  InitializePaymentResult,
  InitializeTransferInput,
  PaymentProvider,
  PreauthorizationResult,
  TransferResult,
  VerifyPaymentResult,
} from './payment-provider.interface';

/**
 * Stripe Checkout + PaymentIntents implementation of PaymentProvider.
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (or Integrations Hub).
 */
export class StripeService implements PaymentProvider {
  readonly name = 'stripe' as const;
  private secretKey: string;
  private webhookSecret: string;
  private client: Stripe | null = null;
  private logger: winston.Logger;
  private onVerified?: (reference: string, data: any) => Promise<void>;

  constructor(onVerified?: (reference: string, data: any) => Promise<void>) {
    this.secretKey = process.env.STRIPE_SECRET_KEY || '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    this.onVerified = onVerified;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'stripe' },
      transports: [new winston.transports.Console()],
    });
    this.rebuildClient();
  }

  setSecretKey(secretKey: string) {
    if (secretKey) {
      this.secretKey = secretKey;
      this.rebuildClient();
    }
  }

  setWebhookSecret(secret: string) {
    if (secret) this.webhookSecret = secret;
  }

  private rebuildClient() {
    this.client = this.secretKey
      ? new Stripe(this.secretKey, { apiVersion: '2023-08-16' })
      : null;
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
    }
    return this.client;
  }

  /** Stripe amounts are in the smallest currency unit (e.g. cents). */
  private toUnitAmount(amount: number, currency: string): number {
    const zeroDecimal = new Set(['jpy', 'krw', 'vnd', 'xaf', 'xof', 'clp']);
    const c = currency.toLowerCase();
    if (zeroDecimal.has(c)) return Math.round(amount);
    return Math.round(amount * 100);
  }

  private fromUnitAmount(amount: number, currency: string): number {
    const zeroDecimal = new Set(['jpy', 'krw', 'vnd', 'xaf', 'xof', 'clp']);
    const c = currency.toLowerCase();
    if (zeroDecimal.has(c)) return amount;
    return amount / 100;
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference =
      input.reference || `MOVR-ST-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      const stripe = this.requireClient();
      const successUrl =
        input.redirectUrl ||
        process.env.STRIPE_SUCCESS_URL ||
        'http://localhost:5180/wallet?payment=success';
      const cancelUrl =
        process.env.STRIPE_CANCEL_URL ||
        successUrl.replace('payment=success', 'payment=cancelled');

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: input.email,
        client_reference_id: reference,
        success_url: successUrl.includes('?')
          ? `${successUrl}&ref=${encodeURIComponent(reference)}`
          : `${successUrl}?ref=${encodeURIComponent(reference)}`,
        cancel_url: cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: this.toUnitAmount(input.amount, input.currency),
              product_data: {
                name: String(
                  (input.metadata as any)?.paymentType
                    ? `MOVR ${(input.metadata as any).paymentType}`
                    : 'MOVR payment'
                ),
                description: input.fullName ? `For ${input.fullName}` : undefined,
              },
            },
          },
        ],
        metadata: {
          reference,
          ...(Object.fromEntries(
            Object.entries(input.metadata || {}).map(([k, v]) => [k, String(v ?? '')])
          ) as Record<string, string>),
        },
        payment_intent_data: {
          metadata: {
            reference,
            userId: String((input.metadata as any)?.userId || ''),
            paymentType: String((input.metadata as any)?.paymentType || ''),
          },
        },
      });

      if (!session.url) {
        return { success: false, reference, error: 'Stripe did not return a checkout URL' };
      }

      return {
        success: true,
        reference,
        paymentLink: session.url,
        providerReference: session.id,
      };
    } catch (error: any) {
      this.logger.error('Stripe initializePayment failed', { error: error?.message });
      return { success: false, reference, error: error?.message || 'Stripe init error' };
    }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    try {
      const stripe = this.requireClient();
      const sessions = await stripe.checkout.sessions.list({ limit: 20 });
      const session = sessions.data.find(
        (s) => s.client_reference_id === reference || s.metadata?.reference === reference
      );

      if (!session) {
        // Fallback: treat reference as Checkout Session id
        try {
          const byId = await stripe.checkout.sessions.retrieve(reference);
          if (byId.payment_status === 'paid') {
            return {
              success: true,
              amount: this.fromUnitAmount(byId.amount_total || 0, byId.currency || 'usd'),
              currency: (byId.currency || 'usd').toUpperCase(),
              status: 'success',
            };
          }
        } catch {
          /* not a session id */
        }
        return { success: false, error: 'Stripe session not found for reference' };
      }

      if (session.payment_status === 'paid') {
        return {
          success: true,
          amount: this.fromUnitAmount(session.amount_total || 0, session.currency || 'usd'),
          currency: (session.currency || 'usd').toUpperCase(),
          status: 'success',
        };
      }

      return {
        success: false,
        status: session.payment_status || session.status || undefined,
        error: 'Payment not completed',
      };
    } catch (error: any) {
      this.logger.error('Stripe verifyPayment failed', { error: error?.message });
      return { success: false, error: error?.message || 'Verify failed' };
    }
  }

  async initializeTransfer(input: InitializeTransferInput): Promise<TransferResult> {
    const reference = input.reference || `MOVR-ST-TRF-${Date.now()}`;
    return {
      success: false,
      reference,
      error:
        'Stripe payouts require Stripe Connect. Configure a connected account or use Paystack/Flutterwave for local bank payouts.',
    };
  }

  async bulkTransfer(items: BulkTransferItem[]): Promise<TransferResult[]> {
    return Promise.all(items.map((item) => this.initializeTransfer(item)));
  }

  async initializePreauthorization(input: InitializePaymentInput): Promise<PreauthorizationResult> {
    const reference =
      input.reference || `MOVR-ST-PRE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const stripe = this.requireClient();
      const intent = await stripe.paymentIntents.create({
        amount: this.toUnitAmount(input.amount, input.currency),
        currency: input.currency.toLowerCase(),
        capture_method: 'manual',
        receipt_email: input.email,
        metadata: {
          reference,
          ...(Object.fromEntries(
            Object.entries(input.metadata || {}).map(([k, v]) => [k, String(v ?? '')])
          ) as Record<string, string>),
        },
        automatic_payment_methods: { enabled: true },
      });
      return {
        success: true,
        reference,
        providerReference: intent.id,
      };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  async capturePreauthorization(reference: string, amount?: number): Promise<PreauthorizationResult> {
    try {
      const stripe = this.requireClient();
      // reference may be our MOVR ref or a PaymentIntent id
      let intentId = reference;
      if (!reference.startsWith('pi_')) {
        const list = await stripe.paymentIntents.list({ limit: 30 });
        const match = list.data.find((p) => p.metadata?.reference === reference);
        if (!match) {
          return { success: false, reference, error: 'PaymentIntent not found for reference' };
        }
        intentId = match.id;
      }
      const captured = await stripe.paymentIntents.capture(
        intentId,
        amount != null
          ? {
              amount_to_capture: this.toUnitAmount(
                amount,
                (await stripe.paymentIntents.retrieve(intentId)).currency || 'usd'
              ),
            }
          : undefined
      );
      return {
        success: captured.status === 'succeeded',
        reference,
        providerReference: captured.id,
        error: captured.status === 'succeeded' ? undefined : captured.status,
      };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  async releasePreauthorization(reference: string): Promise<PreauthorizationResult> {
    try {
      const stripe = this.requireClient();
      let intentId = reference;
      if (!reference.startsWith('pi_')) {
        const list = await stripe.paymentIntents.list({ limit: 30 });
        const match = list.data.find((p) => p.metadata?.reference === reference);
        if (!match) {
          return { success: false, reference, error: 'PaymentIntent not found for reference' };
        }
        intentId = match.id;
      }
      const cancelled = await stripe.paymentIntents.cancel(intentId);
      return {
        success: cancelled.status === 'canceled',
        reference,
        providerReference: cancelled.id,
      };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  /**
   * @param payload raw Buffer (preferred) or parsed object
   * @param signature Stripe-Signature header
   */
  async handleWebhook(payload: unknown, signature: string): Promise<void> {
    const stripe = this.requireClient();
    if (!this.webhookSecret) {
      throw new Error('Stripe webhook secret not configured (STRIPE_WEBHOOK_SECRET)');
    }
    if (!signature) {
      throw new Error('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      const raw =
        Buffer.isBuffer(payload) || typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
      event = stripe.webhooks.constructEvent(raw, signature, this.webhookSecret);
    } catch (err: any) {
      this.logger.error('Stripe webhook signature verification failed', { error: err?.message });
      throw new Error('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const reference =
        session.client_reference_id ||
        session.metadata?.reference ||
        session.id;
      if (session.payment_status === 'paid' && reference && this.onVerified) {
        await this.onVerified(reference, {
          id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
          payment_status: session.payment_status,
          metadata: session.metadata,
        });
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const reference = intent.metadata?.reference || intent.id;
      if (reference && this.onVerified) {
        await this.onVerified(reference, {
          id: intent.id,
          amount: intent.amount,
          currency: intent.currency,
          status: intent.status,
          metadata: intent.metadata,
        });
      }
    }
  }
}
