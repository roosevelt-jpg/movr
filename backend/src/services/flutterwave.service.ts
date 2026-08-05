import axios from 'axios';
import crypto from 'crypto';
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
 * Flutterwave implementation of PaymentProvider (Phase 0A).
 * Refactored from the previous monolithic payment.service.ts Flutterwave calls.
 */
export class FlutterwaveService implements PaymentProvider {
  readonly name = 'flutterwave' as const;
  private secretKey: string;
  private secretHashOverride?: string;
  private baseUrl = 'https://api.flutterwave.com/v3';
  private logger: winston.Logger;
  private onVerified?: (reference: string, data: any) => Promise<void>;

  constructor(onVerified?: (reference: string, data: any) => Promise<void>) {
    this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    this.onVerified = onVerified;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'flutterwave' },
      transports: [new winston.transports.Console()],
    });
  }

  /** Prefer Integrations Hub credential; fall back to env. */
  setSecretKey(secretKey: string) {
    if (secretKey) this.secretKey = secretKey;
  }

  setSecretHash(secretHash: string) {
    if (secretHash) this.secretHashOverride = secretHash;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = input.reference || `MOVR-FW-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      const response = await axios.post(
        `${this.baseUrl}/payments`,
        {
          tx_ref: reference,
          amount: input.amount,
          currency: input.currency,
          payment_options: 'card,ussd,bank_account,mobile_money',
          customer: {
            email: input.email,
            phonenumber: input.phone,
            name: input.fullName || input.email,
          },
          customizations: {
            title: 'MOVR Platform',
            description: 'MOVR payment',
            logo: 'https://movr.io/logo.png',
          },
          redirect_url: input.redirectUrl || `${process.env.APP_URL}/payments/callback?tx_ref=${reference}`,
          meta: input.metadata || {},
        },
        { headers: this.headers() }
      );

      if (response.data?.status === 'success') {
        return {
          success: true,
          reference,
          paymentLink: response.data.data.link,
          providerReference: response.data.data.id,
        };
      }
      return { success: false, reference, error: response.data?.message || 'Flutterwave init failed' };
    } catch (error: any) {
      this.logger.error('Flutterwave initializePayment failed', { error: error?.message });
      return { success: false, reference, error: error?.message };
    }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
        { headers: this.headers() }
      );
      const paymentData = response.data?.data;
      if (response.data?.status === 'success' && paymentData?.status === 'successful') {
        return {
          success: true,
          amount: paymentData.amount,
          currency: paymentData.currency,
          status: paymentData.status,
        };
      }
      return { success: false, status: paymentData?.status, error: 'Payment not successful' };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  }

  async initializeTransfer(input: InitializeTransferInput): Promise<TransferResult> {
    const reference = input.reference || `MOVR-FW-TRF-${Date.now()}`;
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfers`,
        {
          account_bank: input.recipient.bankCode || input.recipient.accountBank,
          account_number: input.recipient.accountNumber,
          amount: input.amount,
          narration: input.narration || 'MOVR payout',
          currency: input.currency,
          reference,
        },
        { headers: this.headers() }
      );
      if (response.data?.status === 'success') {
        return {
          success: true,
          reference,
          providerReference: response.data.data?.id,
        };
      }
      return { success: false, reference, error: response.data?.message };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  async bulkTransfer(items: BulkTransferItem[]): Promise<TransferResult[]> {
    // Flutterwave has no single bulk endpoint identical to Paystack; chunk sequentially.
    const results: TransferResult[] = [];
    for (const item of items) {
      results.push(await this.initializeTransfer(item));
    }
    return results;
  }

  async initializePreauthorization(input: InitializePaymentInput): Promise<PreauthorizationResult> {
    // Flutterwave: use payment with authorize-only style metadata where supported;
    // fall back to standard initialize and treat as hold at application layer.
    const result = await this.initializePayment({
      ...input,
      metadata: { ...(input.metadata || {}), preauthorization: true },
    });
    return {
      success: result.success,
      reference: result.reference,
      providerReference: result.providerReference,
      error: result.error,
    };
  }

  async capturePreauthorization(reference: string, _amount?: number): Promise<PreauthorizationResult> {
    const verified = await this.verifyPayment(reference);
    return {
      success: verified.success,
      reference,
      error: verified.error,
    };
  }

  async releasePreauthorization(reference: string): Promise<PreauthorizationResult> {
    this.logger.info('Flutterwave releasePreauthorization — no native void; marked released', { reference });
    return { success: true, reference };
  }

  verifySignature(payload: string | Buffer, signature: string): boolean {
    const secretHash =
      this.secretHashOverride || process.env.FLUTTERWAVE_SECRET_HASH || this.secretKey;
    const hash = crypto.createHmac('sha256', secretHash).update(payload).digest('hex');
    return hash === signature || signature === secretHash;
  }

  async handleWebhook(payload: unknown, signature: string): Promise<void> {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!this.verifySignature(raw, signature) && process.env.NODE_ENV === 'production') {
      throw new Error('Invalid Flutterwave webhook signature');
    }
    const event = typeof payload === 'string' ? JSON.parse(payload) : (payload as any);
    const txRef = event?.data?.tx_ref || event?.txRef;
    if ((event?.event === 'charge.completed' || event?.status === 'successful') && txRef) {
      const verified = await this.verifyPayment(txRef);
      if (verified.success && this.onVerified) {
        await this.onVerified(txRef, event.data || event);
      }
    }
  }
}
