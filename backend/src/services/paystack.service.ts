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
 * Paystack implementation of PaymentProvider (Phase 0A).
 */
export class PaystackService implements PaymentProvider {
  readonly name = 'paystack' as const;
  private secretKey: string;
  private baseUrl = 'https://api.paystack.co';
  private logger: winston.Logger;
  private onVerified?: (reference: string, data: any) => Promise<void>;

  constructor(onVerified?: (reference: string, data: any) => Promise<void>) {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    this.onVerified = onVerified;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'paystack' },
      transports: [new winston.transports.Console()],
    });
  }

  /** Prefer Integrations Hub credential; fall back to env. */
  setSecretKey(secretKey: string) {
    if (secretKey) this.secretKey = secretKey;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = input.reference || `MOVR-PS-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!this.secretKey) {
      return {
        success: false,
        reference,
        error: 'Paystack secret_key not configured (Integrations Hub or PAYSTACK_SECRET_KEY)',
      };
    }
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: input.email,
          amount: Math.round(input.amount * 100),
          currency: input.currency,
          reference,
          callback_url: input.redirectUrl,
          metadata: input.metadata || {},
        },
        { headers: this.headers() }
      );

      if (response.data?.status) {
        return {
          success: true,
          reference,
          paymentLink: response.data.data.authorization_url,
          providerReference: response.data.data.access_code,
        };
      }
      return { success: false, reference, error: response.data?.message || 'Paystack init failed' };
    } catch (error: any) {
      this.logger.error('Paystack initializePayment failed', { error: error?.message });
      return { success: false, reference, error: error?.message || 'Paystack init error' };
    }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: this.headers() }
      );
      const data = response.data?.data;
      if (response.data?.status && data?.status === 'success') {
        return {
          success: true,
          amount: (data.amount || 0) / 100,
          currency: data.currency,
          status: data.status,
        };
      }
      return { success: false, status: data?.status, error: 'Payment not successful' };
    } catch (error: any) {
      this.logger.error('Paystack verifyPayment failed', { error: error?.message });
      return { success: false, error: error?.message || 'Verify failed' };
    }
  }

  async initializeTransfer(input: InitializeTransferInput): Promise<TransferResult> {
    const reference = input.reference || `MOVR-PS-TRF-${Date.now()}`;
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          amount: Math.round(input.amount * 100),
          reference,
          reason: input.narration || 'MOVR payout',
          recipient: input.recipient.accountNumber,
          currency: input.currency,
        },
        { headers: this.headers() }
      );
      if (response.data?.status) {
        return {
          success: true,
          reference,
          providerReference: response.data.data?.transfer_code,
        };
      }
      return { success: false, reference, error: response.data?.message };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  async bulkTransfer(items: BulkTransferItem[]): Promise<TransferResult[]> {
    const results: TransferResult[] = [];
    const chunkSize = 100;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      try {
        const response = await axios.post(
          `${this.baseUrl}/transfer/bulk`,
          {
            currency: chunk[0]?.currency || 'GHS',
            source: 'balance',
            transfers: chunk.map((item) => ({
              amount: Math.round(item.amount * 100),
              reference: item.reference || `MOVR-PS-BULK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              reason: item.narration || 'MOVR bulk payout',
              recipient: item.recipient.accountNumber,
            })),
          },
          { headers: this.headers() }
        );
        const transfers = response.data?.data || [];
        for (const t of transfers) {
          results.push({
            success: true,
            reference: t.reference,
            providerReference: t.transfer_code,
          });
        }
      } catch (error: any) {
        for (const item of chunk) {
          results.push({
            success: false,
            reference: item.reference || 'unknown',
            error: error?.message,
          });
        }
      }
    }
    return results;
  }

  async initializePreauthorization(input: InitializePaymentInput): Promise<PreauthorizationResult> {
    const reference = input.reference || `MOVR-PS-PRE-${Date.now()}`;
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize_preauthorization`,
        {
          email: input.email,
          amount: Math.round(input.amount * 100),
          currency: input.currency,
          reference,
          callback_url: input.redirectUrl,
          metadata: input.metadata || {},
        },
        { headers: this.headers() }
      );
      if (response.data?.status) {
        return {
          success: true,
          reference,
          providerReference: response.data.data?.access_code,
        };
      }
      return { success: false, reference, error: response.data?.message };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  async capturePreauthorization(reference: string, amount?: number): Promise<PreauthorizationResult> {
    try {
      const body: Record<string, unknown> = { reference };
      if (amount != null) body.amount = Math.round(amount * 100);
      const response = await axios.post(
        `${this.baseUrl}/transaction/capture_preauthorization`,
        body,
        { headers: this.headers() }
      );
      return {
        success: !!response.data?.status,
        reference,
        providerReference: response.data?.data?.id,
        error: response.data?.status ? undefined : response.data?.message,
      };
    } catch (error: any) {
      return { success: false, reference, error: error?.message };
    }
  }

  async releasePreauthorization(reference: string): Promise<PreauthorizationResult> {
    // Paystack auto-releases via expire_action; explicit release uses void where available
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/capture_preauthorization`,
        { reference, amount: 0 },
        { headers: this.headers() }
      );
      return {
        success: !!response.data?.status,
        reference,
        error: response.data?.status ? undefined : response.data?.message,
      };
    } catch (error: any) {
      this.logger.warn('Paystack releasePreauthorization fallback', { reference, error: error?.message });
      return { success: true, reference };
    }
  }

  verifySignature(payload: string | Buffer, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');
    return hash === signature;
  }

  async handleWebhook(payload: unknown, signature: string): Promise<void> {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!this.verifySignature(raw, signature)) {
      throw new Error('Invalid Paystack webhook signature');
    }
    const event = typeof payload === 'string' ? JSON.parse(payload) : (payload as any);
    if (event?.event === 'charge.success' && event?.data?.reference) {
      const verified = await this.verifyPayment(event.data.reference);
      if (verified.success && this.onVerified) {
        await this.onVerified(event.data.reference, event.data);
      }
    }
  }
}
