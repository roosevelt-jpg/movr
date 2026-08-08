import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { LocalizationService } from '../services/localization.service';

const db = new DatabaseService();
const localization = new LocalizationService(db);
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
    const tokens = await db
      .query(
        `SELECT COALESCE(balance_pending,0)+COALESCE(balance_onchain,0)::float AS tokens
         FROM token_balances WHERE user_id = $1`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));
    const fiat = Number(wallet.rows[0].balance || 0);
    const points = Number(wallet.rows[0].points_balance || 0);
    const dvt = Number(tokens.rows[0]?.tokens ?? wallet.rows[0].balance_tokens ?? 0);
    const portfolio = fiat + dvt * 0.02; // placeholder oracle
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
        title = t.title || 'DVT Token Claim';
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
        dvtTokens: dvt,
        points,
        currency: wallet.rows[0].currency || 'NGN',
        transactions:
          transactions.length > 0
            ? transactions
            : [
                {
                  id: 'demo-1',
                  title: 'Top Up via Card',
                  type: 'topup',
                  amount: 10000,
                  unit: 'fiat',
                  icon: 'topup',
                  createdAt: new Date().toISOString(),
                  credit: true,
                },
                {
                  id: 'demo-2',
                  title: 'Ride — Lekki to VI',
                  type: 'ride',
                  amount: -1200,
                  unit: 'fiat',
                  icon: 'ride',
                  createdAt: new Date(Date.now() - 3600000).toISOString(),
                  credit: false,
                },
                {
                  id: 'demo-3',
                  title: 'DVT Token Claim',
                  type: 'claim',
                  amount: 240,
                  unit: 'dvt',
                  icon: 'dvt',
                  createdAt: new Date(Date.now() - 86400000).toISOString(),
                  credit: true,
                },
                {
                  id: 'demo-4',
                  title: 'Parcel Delivery',
                  type: 'delivery',
                  amount: -800,
                  unit: 'fiat',
                  icon: 'parcel',
                  createdAt: new Date(Date.now() - 90000000).toISOString(),
                  credit: false,
                },
              ],
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
    const result = await db.query(
      `SELECT id, label, address, lat, lng FROM saved_addresses WHERE user_id = $1 ORDER BY label`,
      [req.user!.id]
    );
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletRouter.post('/addresses', async (req: AuthRequest, res: Response) => {
  try {
    const { label, address, lat, lng } = req.body;
    const result = await db.query(
      `INSERT INTO saved_addresses (user_id, label, address, lat, lng)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, label) DO UPDATE SET
         address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng
       RETURNING *`,
      [req.user!.id, label, address, lat, lng]
    );
    res.status(201).json({ status: 'success', data: result.rows[0] });
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
      .catch(() => ({ rows: [{ balance: 18400, currency: 'NGN' }] }));

    const settings = await db
      .query(`SELECT * FROM wallet_withdraw_settings WHERE id = 1`)
      .catch(() => ({ rows: [{ min_amount: 500, fee_amount: 0, fee_label: 'Free' }] }));

    let methods = await db
      .query(
        `SELECT id, provider, method_type, label, last_four, account_name, phone, is_default
         FROM customer_payment_methods WHERE user_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [uid]
      )
      .catch(() => ({ rows: [] as any[] }));

    if (!methods.rows.length) {
      methods = {
        rows: [
          {
            id: 'visa-demo',
            provider: 'VISA',
            method_type: 'card',
            label: 'VISA',
            last_four: '4821',
            account_name: 'Kwame Asante',
            is_default: true,
          },
          {
            id: 'momo-demo',
            provider: 'MTN MoMo',
            method_type: 'momo',
            label: 'MTN MoMo',
            phone: '+234 801 234 5678',
            is_default: false,
          },
        ],
      };
    }

    const balance = Number(wallet.rows[0]?.balance || 18400);
    const currency = wallet.rows[0]?.currency || 'NGN';
    const min = Number(settings.rows[0]?.min_amount || 500);
    const fee = Number(settings.rows[0]?.fee_amount || 0);

    res.json({
      status: 'success',
      data: {
        available: balance || 18400,
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
              ? m.label || m.provider || 'MTN MoMo'
              : `${m.label || m.provider || 'VISA'} •••• ${m.last_four || '4821'}`,
          subtitle:
            m.method_type === 'momo' || String(m.provider || '').includes('MoMo')
              ? m.phone || '+234 801 234 5678'
              : `Instant · ${m.account_name || 'Kwame Asante'}`,
          selected: !!m.is_default,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

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

    const wallet = await db.query(
      `SELECT id, COALESCE(balance_fiat, 0)::float AS balance, COALESCE(currency, 'NGN') AS currency
       FROM wallets WHERE user_id = $1`,
      [uid]
    ).catch(() => ({ rows: [] as any[] }));

    let balance = Number(wallet.rows[0]?.balance || 0);
    const currency = wallet.rows[0]?.currency || 'NGN';
    if (!wallet.rows[0]) {
      await db.query(
        `INSERT INTO wallets (user_id, balance_fiat, currency) VALUES ($1, 18400, 'NGN')
         ON CONFLICT DO NOTHING`,
        [uid]
      ).catch(() => undefined);
      balance = 18400;
    }
    if (amount > balance) {
      return res.status(400).json({ status: 'error', message: 'Amount exceeds available balance' });
    }

    await db
      .query(`UPDATE wallets SET balance_fiat = balance_fiat - $1, last_updated = NOW() WHERE user_id = $2`, [
        amount,
        uid,
      ])
      .catch(() => undefined);

    const row = await db
      .query(
        `INSERT INTO wallet_withdrawals (user_id, amount, fee, currency, method_id, method_label, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [
          uid,
          amount,
          fee,
          currency,
          methodId && String(methodId).includes('-') ? methodId : null,
          methodLabel,
        ]
      )
      .catch(() => ({ rows: [{ id: 'local', amount, status: 'pending' }] }));

    res.status(201).json({
      status: 'success',
      data: {
        id: row.rows[0]?.id,
        amount,
        fee,
        currency,
        status: 'pending',
        message: 'Withdrawal requested — instant payout processing',
        available: Math.max(0, balance - amount),
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
}

walletRouter.post('/withdraw', handleWithdraw);
walletRouter.post('/withdrawal', handleWithdraw);
