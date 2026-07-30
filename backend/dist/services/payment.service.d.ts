import { DatabaseService } from './database.service';
export declare class PaymentService {
    private flutterwavePublicKey;
    private flutterwaveSecretKey;
    private flutterwaveBaseUrl;
    private logger;
    private db;
    constructor(db: DatabaseService);
    initialize(): Promise<void>;
    /**
     * Initialize a Flutterwave payment
     */
    initializePayment(data: {
        userId: string;
        amount: number;
        currency?: string;
        paymentType: 'subscription' | 'ride' | 'wallet' | 'marketplace';
        email: string;
        fullName: string;
        metadata?: any;
    }): Promise<any>;
    /**
     * Verify Flutterwave payment
     */
    verifyPayment(txRef: string): Promise<any>;
    /**
     * Handle Flutterwave webhook
     */
    handleWebhook(event: any): Promise<void>;
    /**
     * Activate driver subscription
     */
    activateSubscription(userId: string, metadata: any): Promise<void>;
    /**
     * Credit user wallet
     */
    creditWallet(userId: string, amount: number): Promise<void>;
    /**
     * Request payout for driver
     */
    requestPayout(data: {
        driverId: string;
        amount: number;
        bankAccount: any;
        currency?: string;
    }): Promise<any>;
    /**
     * Get payout status
     */
    getPayoutStatus(reference: string): Promise<any>;
    /**
     * Process refund
     */
    processRefund(transactionId: string, amount?: number): Promise<any>;
    /**
     * Get user wallet balance
     */
    getWalletBalance(userId: string): Promise<any>;
    /**
     * Transfer between wallets
     */
    transferFunds(fromUserId: string, toUserId: string, amount: number): Promise<any>;
    /**
     * Generate invoice
     */
    generateInvoice(data: {
        orderId: string;
        customerId: string;
        amount: number;
        items: any[];
    }): string;
}
//# sourceMappingURL=payment.service.d.ts.map