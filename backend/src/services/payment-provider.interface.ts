/**
 * Shared payment provider contract (Phase 0A).
 * Call sites must use PaymentService — never import Paystack/Flutterwave directly.
 */
export interface InitializePaymentInput {
  amount: number;
  currency: string;
  email: string;
  fullName?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  redirectUrl?: string;
  reference?: string;
}

export interface InitializePaymentResult {
  success: boolean;
  reference: string;
  paymentLink?: string;
  providerReference?: string | number;
  error?: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  amount?: number;
  currency?: string;
  status?: string;
  error?: string;
}

export interface TransferRecipient {
  accountBank?: string;
  bankCode?: string;
  accountNumber: string;
  name?: string;
  email?: string;
  currency?: string;
}

export interface InitializeTransferInput {
  recipient: TransferRecipient;
  amount: number;
  currency: string;
  narration?: string;
  reference?: string;
}

export interface TransferResult {
  success: boolean;
  reference: string;
  providerReference?: string | number;
  error?: string;
}

export interface BulkTransferItem extends InitializeTransferInput {}

export interface PreauthorizationResult {
  success: boolean;
  reference: string;
  providerReference?: string | number;
  error?: string;
}

export interface PaymentProvider {
  readonly name: 'paystack' | 'flutterwave' | 'stripe';

  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;

  initializeTransfer(input: InitializeTransferInput): Promise<TransferResult>;
  bulkTransfer(items: BulkTransferItem[]): Promise<TransferResult[]>;

  initializePreauthorization(
    input: InitializePaymentInput
  ): Promise<PreauthorizationResult>;
  capturePreauthorization(
    reference: string,
    amount?: number
  ): Promise<PreauthorizationResult>;
  releasePreauthorization(reference: string): Promise<PreauthorizationResult>;

  handleWebhook(payload: unknown, signature: string): Promise<void>;
}

export const PAYSTACK_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'KES', 'USD'] as const;
export const FLUTTERWAVE_CURRENCIES = [
  'NGN', 'GHS', 'ZAR', 'KES', 'USD', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'EGP', 'MAD'
] as const;
/** Common Stripe settlement currencies (Checkout supports many more). */
export const STRIPE_CURRENCIES = [
  'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'NGN', 'GHS', 'ZAR', 'KES', 'UGX', 'TZS', 'EGP', 'MAD'
] as const;
