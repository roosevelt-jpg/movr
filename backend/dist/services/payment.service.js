"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
// backend/src/services/payment.service.ts
const axios_1 = __importDefault(require("axios"));
const winston_1 = __importDefault(require("winston"));
class PaymentService {
    constructor(db) {
        this.flutterwaveBaseUrl = 'https://api.flutterwave.com/v3';
        this.db = db;
        this.flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
        this.flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
        this.logger = winston_1.default.createLogger({
            defaultMeta: { service: 'payment' }
        });
    }
    async initialize() {
        if (!this.flutterwaveSecretKey) {
            this.logger.warn('Flutterwave secret key not configured');
        }
        else {
            this.logger.info('Payment service initialized with Flutterwave');
        }
    }
    // ============================================
    // FLUTTERWAVE PAYMENT PROCESSING
    // ============================================
    /**
     * Initialize a Flutterwave payment
     */
    async initializePayment(data) {
        try {
            const txRef = `MOVR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const payload = {
                tx_ref: txRef,
                amount: data.amount,
                currency: data.currency || 'GHS',
                payment_options: 'card,ussd,bank_account,mobile_money',
                customer: {
                    email: data.email,
                    name: data.fullName
                },
                customizations: {
                    title: 'MOVR Platform',
                    description: `Payment for ${data.paymentType}`,
                    logo: 'https://movr.io/logo.png'
                },
                redirect_url: `${process.env.APP_URL}/payments/callback?tx_ref=${txRef}`
            };
            const response = await axios_1.default.post(`${this.flutterwaveBaseUrl}/payments`, payload, {
                headers: {
                    Authorization: `Bearer ${this.flutterwaveSecretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data.status === 'success') {
                // Save payment record to database
                await this.db.createPayment({
                    userId: data.userId,
                    amount: data.amount,
                    currency: data.currency || 'GHS',
                    method: 'flutterwave',
                    gateway: 'flutterwave',
                    referenceId: txRef,
                    metadata: {
                        paymentType: data.paymentType,
                        flutterwaveId: response.data.data.id,
                        ...data.metadata
                    }
                });
                return {
                    success: true,
                    paymentLink: response.data.data.link,
                    txRef: txRef,
                    flutterwaveId: response.data.data.id
                };
            }
            else {
                this.logger.error('Flutterwave payment initialization failed:', response.data);
                return { success: false, error: response.data.message };
            }
        }
        catch (error) {
            this.logger.error('Payment initialization error:', error);
            throw error;
        }
    }
    /**
     * Verify Flutterwave payment
     */
    async verifyPayment(txRef) {
        try {
            const response = await axios_1.default.get(`${this.flutterwaveBaseUrl}/transactions/verify_by_reference?tx_ref=${txRef}`, {
                headers: {
                    Authorization: `Bearer ${this.flutterwaveSecretKey}`
                }
            });
            if (response.data.status === 'success') {
                const paymentData = response.data.data;
                if (paymentData.status === 'successful') {
                    // Update payment status in database
                    const query = `
            UPDATE payments 
            SET status = 'completed', 
                metadata = metadata || $1::jsonb,
                updated_at = NOW()
            WHERE reference_id = $2
            RETURNING *
          `;
                    const metadata = {
                        flutterwaveId: paymentData.id,
                        chargeResponseCode: paymentData.charge_response_code,
                        chargeResponseMessage: paymentData.charge_response_message
                    };
                    await this.db.query(query, [JSON.stringify(metadata), txRef]);
                    return {
                        success: true,
                        amount: paymentData.amount,
                        currency: paymentData.currency,
                        status: paymentData.status
                    };
                }
                else {
                    return {
                        success: false,
                        error: 'Payment not successful',
                        status: paymentData.status
                    };
                }
            }
        }
        catch (error) {
            this.logger.error('Payment verification error:', error);
            throw error;
        }
    }
    /**
     * Handle Flutterwave webhook
     */
    async handleWebhook(event) {
        try {
            const { txRef, status, amount, currency } = event;
            if (status === 'successful') {
                // Verify the payment
                const verification = await this.verifyPayment(txRef);
                if (verification.success) {
                    // Update user wallet or subscription
                    const paymentResult = await this.db.query(`SELECT user_id, metadata FROM payments WHERE reference_id = $1`, [txRef]);
                    if (paymentResult.rows.length > 0) {
                        const { userId, metadata } = paymentResult.rows[0];
                        // Process based on payment type
                        switch (metadata.paymentType) {
                            case 'subscription':
                                await this.activateSubscription(userId, metadata);
                                break;
                            case 'wallet':
                                await this.creditWallet(userId, amount);
                                break;
                            case 'ride':
                                // Ride payment already processed
                                break;
                            case 'marketplace':
                                // Marketplace order payment
                                break;
                        }
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Webhook processing error:', error);
            throw error;
        }
    }
    // ============================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================
    /**
     * Activate driver subscription
     */
    async activateSubscription(userId, metadata) {
        const query = `
      INSERT INTO subscriptions (
        user_id, plan_id, status, amount, currency, 
        next_billing_date, auto_renew, created_at
      ) VALUES ($1, $2, 'active', $3, $4, $5, true, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        status = 'active',
        next_billing_date = $5,
        updated_at = NOW()
      RETURNING *
    `;
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        try {
            await this.db.query(query, [
                userId,
                metadata.planId || 'basic_driver',
                metadata.amount || 99,
                'GHS',
                nextBillingDate
            ]);
            this.logger.info(`Subscription activated for user ${userId}`);
        }
        catch (error) {
            this.logger.error('Subscription activation error:', error);
            throw error;
        }
    }
    /**
     * Credit user wallet
     */
    async creditWallet(userId, amount) {
        const query = `
      UPDATE wallets 
      SET balance_fiat = balance_fiat + $1,
          last_updated = NOW()
      WHERE user_id = $2
    `;
        try {
            await this.db.query(query, [amount, userId]);
            this.logger.info(`Wallet credited for user ${userId}: ${amount}`);
        }
        catch (error) {
            this.logger.error('Wallet credit error:', error);
            throw error;
        }
    }
    // ============================================
    // PAYOUT MANAGEMENT
    // ============================================
    /**
     * Request payout for driver
     */
    async requestPayout(data) {
        try {
            const reference = `PAYOUT-${Date.now()}`;
            const payload = {
                account_bank: data.bankAccount.bankCode,
                account_number: data.bankAccount.accountNumber,
                amount: data.amount,
                narration: 'MOVR Driver Payout',
                currency: data.currency || 'GHS',
                reference: reference
            };
            const response = await axios_1.default.post(`${this.flutterwaveBaseUrl}/transfers`, payload, {
                headers: {
                    Authorization: `Bearer ${this.flutterwaveSecretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data.status === 'success') {
                // Save payout record
                const query = `
          INSERT INTO payouts (
            driver_id, amount, currency, status, reference_id,
            bank_account, created_at
          ) VALUES ($1, $2, $3, 'pending', $4, $5, NOW())
          RETURNING *
        `;
                await this.db.query(query, [
                    data.driverId,
                    data.amount,
                    data.currency || 'GHS',
                    reference,
                    JSON.stringify(data.bankAccount)
                ]);
                return { success: true, reference: reference };
            }
        }
        catch (error) {
            this.logger.error('Payout request error:', error);
            throw error;
        }
    }
    /**
     * Get payout status
     */
    async getPayoutStatus(reference) {
        try {
            const response = await axios_1.default.get(`${this.flutterwaveBaseUrl}/transfers?reference=${reference}`, {
                headers: {
                    Authorization: `Bearer ${this.flutterwaveSecretKey}`
                }
            });
            return response.data.data[0] || null;
        }
        catch (error) {
            this.logger.error('Payout status check error:', error);
            throw error;
        }
    }
    // ============================================
    // REFUND MANAGEMENT
    // ============================================
    /**
     * Process refund
     */
    async processRefund(transactionId, amount) {
        try {
            const payload = {
                amount: amount // if empty, refund full amount
            };
            const response = await axios_1.default.post(`${this.flutterwaveBaseUrl}/transactions/${transactionId}/refund`, payload, {
                headers: {
                    Authorization: `Bearer ${this.flutterwaveSecretKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data.status === 'success') {
                this.logger.info(`Refund processed for transaction ${transactionId}`);
                return { success: true, refundId: response.data.data.id };
            }
        }
        catch (error) {
            this.logger.error('Refund processing error:', error);
            throw error;
        }
    }
    // ============================================
    // WALLET OPERATIONS
    // ============================================
    /**
     * Get user wallet balance
     */
    async getWalletBalance(userId) {
        try {
            const result = await this.db.query(`SELECT balance_fiat, balance_points, balance_tokens FROM wallets WHERE user_id = $1`, [userId]);
            return result.rows[0] || {
                balance_fiat: 0,
                balance_points: 0,
                balance_tokens: 0
            };
        }
        catch (error) {
            this.logger.error('Error fetching wallet balance:', error);
            throw error;
        }
    }
    /**
     * Transfer between wallets
     */
    async transferFunds(fromUserId, toUserId, amount) {
        try {
            const result = await this.db.transaction(async (client) => {
                // Deduct from sender
                await client.query(`UPDATE wallets SET balance_fiat = balance_fiat - $1 WHERE user_id = $2`, [amount, fromUserId]);
                // Add to recipient
                await client.query(`UPDATE wallets SET balance_fiat = balance_fiat + $1 WHERE user_id = $2`, [amount, toUserId]);
                // Record transaction
                const txId = `TRX-${Date.now()}`;
                await client.query(`INSERT INTO wallet_transactions (from_user_id, to_user_id, amount, transaction_id, type, created_at)
           VALUES ($1, $2, $3, $4, 'transfer', NOW())`, [fromUserId, toUserId, amount, txId]);
                return txId;
            });
            return { success: true, transactionId: result };
        }
        catch (error) {
            this.logger.error('Transfer funds error:', error);
            throw error;
        }
    }
    // ============================================
    // INVOICE GENERATION
    // ============================================
    /**
     * Generate invoice
     */
    generateInvoice(data) {
        const invoiceNumber = `INV-${Date.now()}`;
        const invoiceData = {
            invoiceNumber,
            date: new Date().toISOString(),
            ...data
        };
        return JSON.stringify(invoiceData);
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=payment.service.js.map