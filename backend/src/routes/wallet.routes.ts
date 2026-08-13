import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { LocalizationService } from '../services/localization.service';
import { PaymentService } from '../services/payment.service';

const db = new DatabaseService();
const localization = new LocalizationService(db);
const payments = new PaymentService(db);
export const walletRouter = Router();

walletRouter.use(authenticateToken);

async function resolveUserCurrency(userId: string) {
  const u = await db.query(`SELECT country, phone FROM users WHERE id = $1`, [userId]);
  const country =
    u.rows[0]?.country ||
    (
      await localization.detectCountry({
        phoneNumber: u.rows[0]?.phone || undefined,
      })
    )?.code ||
    'GH';
  const currency = await localization.currencyForCountry(country);
  return { country, currency };
}

walletRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let wallet = await db.query(
      `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
              balance_tokens, currency, last_updated
       FROM wallets WHERE user_id = $1`,
      [userId]
    );

    if (!wallet.rows[0]) {
      const { currency } = await resolveUserCurrency(userId);
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
         VALUES ($1, 0, 0, 0, $2)`,
        [userId, currency]
      );
      wallet = await db.query(
        `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
                balance_tokens, currency, last_updated
         FROM wallets WHERE user_id = $1`,
        [userId]
      );
    }

    const txs = await db.query(
      `SELECT id, type, amount, reference, created_at
       FROM wallet_transactions_v2
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [wallet.rows[0].id]
    );

    res.json({
      status: 'success',
      data: {
        ...wallet.rows[0],
        rewardsBalance: wallet.rows[0].points_balance,
        transactions: txs.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.get('/portfolio', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let wallet = await db.query(
      `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
              COALESCE(balance_tokens,0) AS balance_tokens, currency, last_updated
       FROM wallets WHERE user_id = $1`,
      [userId]
    );
    if (!wallet.rows[0]) {
      const { currency } = await resolveUserCurrency(userId);
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
         VALUES ($1, 0, 0, 0, $2)`,
        [userId, currency]
      );
      wallet = await db.query(
        `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
                COALESCE(balance_tokens,0) AS balance_tokens, currency, last_updated
         FROM wallets WHERE user_id = $1`,
        [userId]
      );
    }
    const fiat = Number(wallet.rows[0].balance || 0);
    const points = Number(wallet.rows[0].points_balance || 0);
    // Portfolio is fiat-only for store clients (no crypto token valuation)
    const portfolio = fiat;
    const txs = await db.query(
      `SELECT id, type, amount, reference, created_at, currency_unit, title, icon_key
       FROM wallet_transactions_v2
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [wallet.rows[0].id]
    ).catch(async () =>
      db.query(
        `SELECT id, type, amount, reference, created_at
         FROM wallet_transactions_v2 WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [wallet.rows[0].id]
      )
    );
    const transactions = txs.rows.map((t: any) => {
      const type = String(t.type || '').toLowerCase();
      const amt = Number(t.amount || 0);
      const unit = t.currency_unit || (/dvt|token|claim/.test(type) ? 'dvt' : 'fiat');
      let title = t.title || t.reference || t.type || 'Transaction';
      let icon = t.icon_key || 'tx';
      if (/top.?up|deposit|fund/.test(type)) {
        title = t.title || 'Top Up via Card';
        icon = 'topup';
      } else if (/ride/.test(type)) {
        title = t.title || t.reference || 'Ride';
        icon = 'ride';
      } else if (/claim|dvt|token/.test(type)) {
        title = t.title || 'Rewards';
        icon = 'dvt';
      } else if (/parcel|deliver/.test(type)) {
        title = t.title || 'Parcel Delivery';
        icon = 'parcel';
      } else if (/withdraw/.test(type)) {
        title = t.title || 'Withdraw';
        icon = 'withdraw';
      } else if (/transfer|send/.test(type)) {
        title = t.title || 'Transfer';
        icon = 'transfer';
      }
      return {
        id: t.id,
        title,
        type,
        amount: amt,
        unit,
        icon,
        createdAt: t.created_at,
        credit: amt > 0,
      };
    });
    res.json({
      status: 'success',
      data: {
        portfolioValue: Math.round(portfolio * 100) / 100,
        fiatBalance: fiat,
        /** Always 0 for store clients — crypto tokens are not offered in-app */
        dvtTokens: 0,
        points,
        currency: wallet.rows[0].currency || 'NGN',
        transactions: transactions.filter((t: any) => t.unit !== 'dvt' && t.icon !== 'dvt'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.get('/balance', async (req: AuthRequest, res: Response) => {
  try {
    // Alias of GET / so older clients calling /wallet/balance still hit live data
    const userId = req.user!.id;
    let wallet = await db.query(
      `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
              balance_tokens, currency, last_updated
       FROM wallets WHERE user_id = $1`,
      [userId]
    );
    if (!wallet.rows[0]) {
      const { currency } = await resolveUserCurrency(userId);
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
         VALUES ($1, 0, 0, 0, $2)`,
        [userId, currency]
      );
      wallet = await db.query(
        `SELECT id, user_id, balance_fiat AS balance, COALESCE(points_balance, balance_points, 0) AS points_balance,
                balance_tokens, currency, last_updated
         FROM wallets WHERE user_id = $1`,
        [userId]
      );
    }
    res.json({
      status: 'success',
      data: {
        ...wallet.rows[0],
        rewardsBalance: wallet.rows[0].points_balance,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.get('/addresses', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db
      .query(
        `SELECT id, label, address, lat, lng, COALESCE(is_default, FALSE) AS is_default
         FROM saved_addresses WHERE user_id = $1
         ORDER BY COALESCE(is_default, FALSE) DESC, label`,
        [req.user!.id]
      )
      .catch(async () =>
        db.query(
          `SELECT id, label, address, lat, lng, FALSE AS is_default
           FROM saved_addresses WHERE user_id = $1 ORDER BY label`,
          [req.user!.id]
        )
      );
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.post('/addresses', async (req: AuthRequest, res: Response) => {
  try {
    const { label, address, lat, lng, isDefault } = req.body;
    if (isDefault) {
      await db
        .query(`UPDATE saved_addresses SET is_default = FALSE WHERE user_id = $1`, [req.user!.id])
        .catch(() => undefined);
    }
    const result = await db
      .query(
        `INSERT INTO saved_addresses (user_id, label, address, lat, lng, is_default)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE))
         ON CONFLICT (user_id, label) DO UPDATE SET
           address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           is_default = COALESCE(EXCLUDED.is_default, saved_addresses.is_default)
         RETURNING *`,
        [req.user!.id, label, address, lat, lng, Boolean(isDefault)]
      )
      .catch(async () =>
        db.query(
          `INSERT INTO saved_addresses (user_id, label, address, lat, lng)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, label) DO UPDATE SET
             address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng
           RETURNING *`,
          [req.user!.id, label, address, lat, lng]
        )
      );
    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

walletRouter.patch('/addresses/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    await db
      .query(`UPDATE saved_addresses SET is_default = FALSE WHERE user_id = $1`, [req.user!.id])
      .catch(() => undefined);
    const result = await db.query(
      `UPDATE saved_addresses SET is_default = TRUE
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user!.id]
    );
    if (!result.rows[0]) return res.status(404).json({ status: 'error', message: 'Address not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

walletRouter.delete('/addresses/:id', async (req: AuthRequest, res: Response) => {
  try {
    await db.query(`DELETE FROM saved_addresses WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.id,
    ]);
    res.json({ status: 'success', data: { ok: true } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Customer withdraw — balance, min/fee, payout methods (mockup) */
walletRouter.get('/withdraw/options', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const wallet = await db
      .query(
        `SELECT COALESCE(balance_fiat, 0)::float AS balance, COALESCE(currency, 'NGN') AS currency
         FROM wallets WHERE user_id = $1`,
        [uid]
      )
      .catch(() => ({ rows: [{ balance: 0, currency: 'NGN' }] }));

    const settings = await db
      .query(`SELECT * FROM wallet_withdraw_settings WHERE id = 1`)
      .catch(() => ({ rows: [{ min_amount: 500, fee_amount: 0, fee_label: 'Free' }] }));

    const methods = await db
      .query(
        `SELECT id, provider, method_type, label, last_four, account_name, phone, is_default
         FROM customer_payment_methods WHERE user_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    const balance = Number(wallet.rows[0]?.balance || 0);
    const currency = wallet.rows[0]?.currency || 'NGN';
    const min = Number(settings.rows[0]?.min_amount || 500);
    const fee = Number(settings.rows[0]?.fee_amount || 0);

    res.json({
      status: 'success',
      data: {
        available: balance,
        currency,
        minAmount: min,
        fee,
        feeLabel: settings.rows[0]?.fee_label || (fee ? String(fee) : 'Free'),
        chips: [2000, 5000, 10000],
        methods: methods.rows.map((m: any) => ({
          id: m.id,
          type: m.method_type || (String(m.provider || '').toLowerCase().includes('momo') ? 'momo' : 'card'),
          title:
            m.method_type === 'momo' || String(m.provider || '').includes('MoMo')
              ? m.label || m.provider || 'MoMo'
              : `${m.label || m.provider || 'Card'}${m.last_four ? ` •••• ${m.last_four}` : ''}`,
          subtitle:
            m.method_type === 'momo' || String(m.provider || '').includes('MoMo')
              ? m.phone || '—'
              : `Instant · ${m.account_name || '—'}`,
          selected: !!m.is_default,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

async function providersConfigured() {
  return Boolean(
    process.env.PAYSTACK_SECRET_KEY ||
      process.env.FLUTTERWAVE_SECRET_KEY ||
      process.env.PAYSTACK_SECRET ||
      process.env.FLW_SECRET_KEY
  );
}

async function handleWithdraw(req: AuthRequest, res: Response) {
  try {
    const uid = req.user!.id;
    const amount = Number(req.body.amount || 0);
    const methodId = req.body.methodId || null;
    const methodLabel = String(req.body.methodLabel || 'Payout');

    const settings = await db
      .query(`SELECT * FROM wallet_withdraw_settings WHERE id = 1`)
      .catch(() => ({ rows: [{ min_amount: 500, fee_amount: 0 }] }));
    const min = Number(settings.rows[0]?.min_amount || 500);
    const fee = Number(settings.rows[0]?.fee_amount || 0);

    if (!amount || amount < min) {
      return res.status(400).json({
        status: 'error',
        message: `Minimum withdrawal is ${min}`,
      });
    }

    const { TrustSettlementService } = require('../services/trust-settlement.service');
    const trust = new TrustSettlementService(db);
    await trust.assertKycForPayout(uid, amount, 'customer');

    const wallet = await db.query(
      `SELECT id, COALESCE(balance_fiat, 0)::float AS balance, COALESCE(currency, 'NGN') AS currency
       FROM wallets WHERE user_id = $1`,
      [uid]
    ).catch(() => ({ rows: [] as any[] }));

    let balance = Number(wallet.rows[0]?.balance || 0);
    const currency = wallet.rows[0]?.currency || 'NGN';
    if (!wallet.rows[0]) {
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, currency) VALUES ($1, 0, 'NGN')
         ON CONFLICT DO NOTHING`,
        [uid]
      ).catch(() => undefined);
      balance = 0;
    }
    if (amount > balance) {
      return res.status(400).json({ status: 'error', message: 'Amount exceeds available balance' });
    }

    const rail = await db
      .query(
        `SELECT * FROM wallet_rail_methods WHERE user_id = $1
         ORDER BY is_default DESC, updated_at DESC LIMIT 1`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));
    const method = await db
      .query(`SELECT * FROM customer_payment_methods WHERE id = $1 AND user_id = $2`, [
        methodId,
        uid,
      ])
      .catch(() => ({ rows: [] as any[] }));

    const accountNumber =
      rail.rows[0]?.account_number ||
      method.rows[0]?.account_number ||
      method.rows[0]?.last4 ||
      null;
    const bankCode =
      rail.rows[0]?.metadata?.bankCode ||
      method.rows[0]?.bank_code ||
      (String(rail.rows[0]?.provider || methodLabel).toLowerCase().includes('mtn') ? 'MTN' : undefined);

    if (!accountNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Link a MoMo/bank rail in Wallet → Settle before withdrawing',
      });
    }

    const reference = `WD-${Date.now()}`;
    let transfer: any = { success: false, reference };
    try {
      transfer = await payments.initializeTransfer({
        amount,
        currency,
        recipient: {
          accountNumber: String(accountNumber),
          bankCode: bankCode || undefined,
          accountBank: bankCode || undefined,
        },
        reference,
        narration: `Movr wallet withdraw · ${methodLabel}`,
        countryCode: (await resolveUserCurrency(uid)).country,
      });
    } catch (e: any) {
      transfer = { success: false, reference, error: e.message };
    }

    const live = await providersConfigured();
    if (!transfer.success && live) {
      return res.status(400).json({
        status: 'error',
        message: transfer.error || 'Payout provider rejected transfer — balance not debited',
        transfer,
      });
    }

    await db
      .query(`UPDATE wallets SET balance_fiat = balance_fiat - $1, last_updated = NOW() WHERE user_id = $2`, [
        amount,
        uid,
      ])
      .catch(() => undefined);

    let row = await db
      .query(
        `INSERT INTO wallet_withdrawals (user_id, amount, fee, currency, method_id, method_label, status, reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          uid,
          amount,
          fee,
          currency,
          methodId && String(methodId).includes('-') ? methodId : null,
          methodLabel,
          transfer.success ? 'processing' : 'pending',
          reference,
        ]
      )
      .catch(() => ({ rows: [] as any[] }));
    if (!row.rows[0]) {
      row = await db
        .query(
          `INSERT INTO wallet_withdrawals (user_id, amount, fee, currency, method_id, method_label, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            uid,
            amount,
            fee,
            currency,
            methodId && String(methodId).includes('-') ? methodId : null,
            methodLabel,
            transfer.success ? 'processing' : 'pending',
          ]
        )
        .catch(() => ({
          rows: [{ id: 'local', amount, status: transfer.success ? 'processing' : 'pending' }],
        }));
    }

    await trust
      .createReceipt(uid, {
        kind: 'wallet_withdraw',
        amount,
        currency,
        channel: rail.rows[0]?.rail_type || 'momo',
        counterparty: methodLabel,
        status: transfer.success ? 'processing' : 'pending',
        metadata: { reference, transferSuccess: Boolean(transfer.success) },
      })
      .catch(() => undefined);

    res.status(201).json({
      status: 'success',
      data: {
        id: row.rows[0]?.id,
        amount,
        fee,
        currency,
        status: transfer.success ? 'processing' : 'pending',
        transfer,
        message: transfer.success
          ? 'Withdrawal sent to MoMo/bank — usually arrives in minutes'
          : 'Withdrawal queued (demo/offline provider) — ops can retry from Trust Ops',
        available: Math.max(0, balance - amount),
      },
    });
  } catch (error: any) {
    const msg = String(error.message || '');
    res.status(msg.toLowerCase().includes('kyc') ? 400 : 400).json({
      status: 'error',
      message: error.message,
    });
  }
}

walletRouter.post('/withdraw', handleWithdraw);
walletRouter.post('/withdrawal', handleWithdraw);
