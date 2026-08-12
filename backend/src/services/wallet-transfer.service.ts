import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './database.service';
import { LocalizationService } from './localization.service';
import getLogger from '../utils/logger';

/**
 * Phase 27 — wallet-to-wallet + claim-code transfers with FX and KYC gates.
 */
export class WalletTransferService {
  private logger = getLogger('wallet-transfer');
  private localization: LocalizationService;

  constructor(private db: DatabaseService) {
    this.localization = new LocalizationService(db);
  }

  async getLimits() {
    const row = await this.db.query(`SELECT * FROM transfer_limits_config WHERE id = 1`);
    return (
      row.rows[0] || {
        max_per_tx: 500,
        max_per_day: 2000,
        requires_identity_linked_above: 100,
        fee_percent: 1.5,
        fee_flat: 0,
      }
    );
  }

  private async resolveRecipient(identifier: string) {
    const id = identifier.trim();
    // Allow "phone · Name · Country" paste from UI
    const phonePart = id.split('·')[0].trim();
    const byHandle = await this.db.query(
      `SELECT id, phone, handle, country, first_name, last_name
       FROM users WHERE LOWER(handle) = LOWER($1) LIMIT 1`,
      [id.replace(/^@/, '').split('·')[0].trim()]
    );
    if (byHandle.rows[0]) return byHandle.rows[0];

    const byPhone = await this.db.query(
      `SELECT id, phone, handle, country, first_name, last_name
       FROM users WHERE phone = $1 OR phone = $2 LIMIT 1`,
      [id, phonePart]
    );
    return byPhone.rows[0] || null;
  }

  private formatRecipientDisplay(recipient: any, identifier: string) {
    if (recipient) {
      const first = String(recipient.first_name || '').trim();
      const last = String(recipient.last_name || '').trim();
      const short =
        first && last
          ? `${first} ${last.charAt(0).toUpperCase()}.`
          : first || recipient.handle || 'Recipient';
      const phone = recipient.phone || identifier.split('·')[0].trim();
      const countryName =
        recipient.country === 'NG'
          ? 'Nigeria'
          : recipient.country === 'GH'
            ? 'Ghana'
            : recipient.country || '';
      return [phone, short, countryName].filter(Boolean).join(' · ');
    }
    // Phone-only / freeform
    const parts = identifier.split('·').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.join(' · ');
    return identifier;
  }

  private async ensureWallet(userId: string, currency: string) {
    let w = await this.db.query(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
    if (!w.rows[0]) {
      w = await this.db.query(
        `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
         VALUES ($1, 0, 0, 0, $2) RETURNING *`,
        [userId, currency]
      );
    }
    return w.rows[0];
  }

  private async isIdentityLinked(userId: string) {
    const row = await this.db.query(
      `SELECT identity_linked FROM identity_verifications iv
       JOIN drivers d ON d.id = iv.driver_id
       WHERE d.user_id = $1 AND iv.identity_linked = TRUE
       LIMIT 1`,
      [userId]
    );
    if (row.rows[0]) return true;
    const userFlag = await this.db.query(
      `SELECT 1 FROM identity_link_checks
       WHERE user_id = $1 AND status = 'match'
       GROUP BY user_id
       HAVING COUNT(DISTINCT check_type) >= 2`,
      [userId]
    );
    return Boolean(userFlag.rows[0]);
  }

  async quote(senderUserId: string, recipientIdentifier: string, amount: number, currency: string) {
    const limits = await this.getLimits();
    if (amount <= 0) throw new Error('Amount must be positive');
    if (amount > Number(limits.max_per_tx)) {
      throw new Error(`Max per transfer is ${limits.max_per_tx}`);
    }

    const recipient = await this.resolveRecipient(recipientIdentifier);
    const senderWallet = await this.ensureWallet(senderUserId, currency);
    const senderCountry = (
      await this.db.query(`SELECT country FROM users WHERE id = $1`, [senderUserId])
    ).rows[0]?.country;

    let receivedCurrency = currency;
    if (recipient) {
      const rw = await this.ensureWallet(recipient.id, currency);
      receivedCurrency = rw.currency || currency;
    } else if (recipientIdentifier.startsWith('+')) {
      const country = await this.localization.detectCountry({ phoneNumber: recipientIdentifier });
      receivedCurrency = country?.currency_code || currency;
    }

    const fee =
      Number(limits.fee_flat) + (amount * Number(limits.fee_percent)) / 100;
    const sendTotal = amount + fee;
    const receivedAmount = await this.localization.convert(amount, currency, receivedCurrency);
    const fxRate = amount > 0 ? receivedAmount / amount : 1;

    const needsLink = amount > Number(limits.requires_identity_linked_above);
    const linked = await this.isIdentityLinked(senderUserId);

    const recipientDisplay = this.formatRecipientDisplay(recipient, recipientIdentifier);
    const recipientFirst =
      recipient?.first_name ||
      recipientIdentifier.split('·')[1]?.trim()?.split(/\s+/)[0] ||
      'Recipient';

    return {
      amount,
      currency,
      feeAmount: Math.round(fee * 100) / 100,
      sendTotal: Math.round(sendTotal * 100) / 100,
      receivedAmount: Math.round(receivedAmount * 100) / 100,
      receivedCurrency,
      fxRateUsed: Math.round(fxRate * 1e4) / 1e4,
      recipientFound: Boolean(recipient),
      recipientUserId: recipient?.id || null,
      recipientHandle: recipient?.handle || null,
      recipientDisplay,
      recipientFirstName: recipientFirst,
      requiresIdentityLink: needsLink,
      identityLinked: linked,
      canSend: !needsLink || linked,
      senderBalance: Number(senderWallet.balance_fiat || 0),
      corridor: `${senderCountry || 'GH'}→${recipient?.country || 'pending'}`,
    };
  }

  async sendTransfer(
    senderUserId: string,
    recipientIdentifier: string,
    amount: number,
    currency: string
  ) {
    const q = await this.quote(senderUserId, recipientIdentifier, amount, currency);
    if (!q.canSend) {
      throw new Error('Identity-Linked status required for this transfer amount');
    }

    const limits = await this.getLimits();
    const daySum = await this.db.query(
      `SELECT COALESCE(SUM(sent_amount),0) AS total
       FROM wallet_transfers
       WHERE sender_user_id = $1 AND created_at >= NOW() - INTERVAL '1 day'
         AND status IN ('pending','completed')`,
      [senderUserId]
    );
    if (Number(daySum.rows[0].total) + amount > Number(limits.max_per_day)) {
      throw new Error(`Daily transfer limit of ${limits.max_per_day} exceeded`);
    }

    return this.db.transaction(async (client) => {
      const senderWallet = (
        await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [senderUserId])
      ).rows[0];
      if (!senderWallet) throw new Error('Sender wallet not found');
      if (Number(senderWallet.balance_fiat) < q.sendTotal) {
        throw new Error('Insufficient wallet balance');
      }

      await client.query(
        `UPDATE wallets SET balance_fiat = balance_fiat - $1, last_updated = NOW() WHERE id = $2`,
        [q.sendTotal, senderWallet.id]
      );
      await client.query(
        `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference)
         VALUES ($1, 'transfer_out', $2, $3)`,
        [senderWallet.id, -q.sendTotal, `xfer:${uuidv4().slice(0, 8)}`]
      );

      let recipientWalletId: string | null = null;
      let recipientUserId: string | null = q.recipientUserId;
      let claimCode: string | null = null;
      let status = 'completed';

      if (recipientUserId) {
        const rw = (
          await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [
            recipientUserId,
          ])
        ).rows[0];
        recipientWalletId = rw.id;
        await client.query(
          `UPDATE wallets SET balance_fiat = balance_fiat + $1, last_updated = NOW() WHERE id = $2`,
          [q.receivedAmount, rw.id]
        );
        await client.query(
          `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference)
           VALUES ($1, 'transfer_in', $2, $3)`,
          [rw.id, q.receivedAmount, `xfer-in`]
        );
      } else {
        status = 'pending';
        claimCode = `MOVR-${uuidv4().slice(0, 8).toUpperCase()}`;
        this.logger.info('claim-code transfer created', {
          claimCode,
          to: recipientIdentifier,
        });
      }

      const transfer = await client.query(
        `INSERT INTO wallet_transfers (
           sender_wallet_id, recipient_wallet_id, sender_user_id, recipient_user_id,
           recipient_identifier, sent_amount, sent_currency, received_amount, received_currency,
           fx_rate_used, fee_amount, status, claim_code, completed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          senderWallet.id,
          recipientWalletId,
          senderUserId,
          recipientUserId,
          recipientIdentifier,
          amount,
          currency,
          q.receivedAmount,
          q.receivedCurrency,
          q.fxRateUsed,
          q.feeAmount,
          status,
          claimCode,
          status === 'completed' ? new Date() : null,
        ]
      );

      const row = transfer.rows[0];

      // Best-effort SMS claim link (Twilio) for recipients without a Movr account
      if (claimCode && recipientIdentifier) {
        setImmediate(() => {
          this.sendClaimSms(recipientIdentifier, claimCode!, q.receivedAmount, q.receivedCurrency).catch(
            (err) => this.logger.warn('claim SMS failed', { error: err.message })
          );
        });
      }

      return row;
    });
  }

  private async sendClaimSms(
    to: string,
    claimCode: string,
    amount: number,
    currency: string
  ) {
    const phone = String(to).startsWith('+') || /^\d/.test(to) ? to : null;
    if (!phone) return;
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      this.logger.warn('Twilio not configured — claim code logged only', { claimCode, phone });
      return;
    }
    const claimUrl =
      process.env.CLAIM_TRANSFER_URL ||
      `${process.env.PUBLIC_WEB_URL || 'https://mymovr.io'}/claim/${claimCode}`;
    const twilio = require('twilio')(sid, token);
    await twilio.messages.create({
      from,
      to: phone,
      body: `MOVR: You received ${amount} ${currency}. Claim with code ${claimCode}: ${claimUrl}`,
    });
  }

  async updateLimits(input: {
    maxPerTx?: number;
    maxPerDay?: number;
    requiresIdentityLinkedAbove?: number;
    feePercent?: number;
    feeFlat?: number;
  }) {
    const row = await this.db.query(
      `UPDATE transfer_limits_config SET
         max_per_tx = COALESCE($1, max_per_tx),
         max_per_day = COALESCE($2, max_per_day),
         requires_identity_linked_above = COALESCE($3, requires_identity_linked_above),
         fee_percent = COALESCE($4, fee_percent),
         fee_flat = COALESCE($5, fee_flat),
         updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        input.maxPerTx ?? null,
        input.maxPerDay ?? null,
        input.requiresIdentityLinkedAbove ?? null,
        input.feePercent ?? null,
        input.feeFlat ?? null,
      ]
    );
    return row.rows[0];
  }

  async claimTransfer(claimCode: string, claimantUserId: string) {
    return this.db.transaction(async (client) => {
      const row = (
        await client.query(
          `SELECT * FROM wallet_transfers WHERE claim_code = $1 AND status = 'pending' FOR UPDATE`,
          [claimCode]
        )
      ).rows[0];
      if (!row) throw new Error('Invalid or already claimed code');

      const wallet = (
        await client.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [claimantUserId])
      ).rows[0];
      if (!wallet) throw new Error('Claimant wallet missing');

      await client.query(
        `UPDATE wallets SET balance_fiat = balance_fiat + $1, last_updated = NOW() WHERE id = $2`,
        [row.received_amount, wallet.id]
      );
      await client.query(
        `UPDATE wallet_transfers SET
           recipient_wallet_id = $1, recipient_user_id = $2, status = 'completed', completed_at = NOW()
         WHERE id = $3`,
        [wallet.id, claimantUserId, row.id]
      );
      return { ...row, status: 'completed', recipient_user_id: claimantUserId };
    });
  }

  async listTransfers(userId: string) {
    return (
      await this.db.query(
        `SELECT * FROM wallet_transfers
         WHERE sender_user_id = $1 OR recipient_user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [userId]
      )
    ).rows;
  }
}
