import crypto from 'crypto';
import { DatabaseService } from './database.service';
import { InboxService } from './inbox.service';

type RailType = 'wallet' | 'momo' | 'bank' | 'cash_agent';

export class TrustSettlementService {
  private inbox: InboxService;

  constructor(private db: DatabaseService) {
    this.inbox = new InboxService(db);
  }

  private async notify(userId: string, title: string, body: string, deepLink?: string) {
    await this.inbox
      .sendInboxMessage(userId, 'system', title, body, deepLink)
      .catch(() => undefined);
  }

  private genCode(len = 6) {
    const n = Math.pow(10, len - 1);
    return String(Math.floor(n + Math.random() * (9 * n)));
  }

  private async setting(key: string, fallback: string) {
    const row = await this.db
      .query(`SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`, [key])
      .catch(() => ({ rows: [] as any[] }));
    const raw = row.rows[0]?.value;
    if (raw == null) return fallback;
    if (typeof raw === 'object') {
      if (raw.value != null) return String(raw.value);
      return String(raw);
    }
    return String(raw);
  }

  async getPromise(countryCode?: string) {
    const sla = Number(await this.setting('trust_match_sla_seconds', '180'));
    const credit = Number(await this.setting('trust_no_show_credit', '500'));
    const kycThreshold = Number(await this.setting('trust_kyc_payout_threshold', '2000'));
    const buyerNote = await this.setting(
      'trust_buyer_protection_note',
      'Buyer protection: dispute any shop issue from Wallet → Settle within 48h.'
    );
    const minWait = Number(await this.setting('trust_no_show_min_wait_seconds', '300'));
    return {
      countryCode: countryCode || 'GH',
      matchSlaSeconds: sla,
      matchSlaText: `Driver match in under ${Math.round(sla / 60)} min`,
      noShowCredit: credit,
      noShowMinWaitSeconds: minWait,
      noShowText: `If your matched driver no-shows after ${Math.round(minWait / 60)} min wait, we credit ${credit} to your wallet.`,
      kycPayoutThreshold: kycThreshold,
      kycUnlockPath: '/safety',
      kycUnlockDriver: '/driver/verification',
      kycUnlockMerchant: '/merchant/onboarding',
      keep100Note: 'Drivers keep 100% of the fare — Movr takes zero from the trip.',
      buyerProtectionNote: buyerNote.replace(/^"|"$/g, ''),
      rails: ['wallet', 'momo', 'bank', 'cash_agent', 'ussd'],
    };
  }

  async listCashAgents(filters: { city?: string; countryCode?: string; lat?: number; lng?: number }) {
    const values: any[] = [];
    const where = ['is_active = TRUE'];
    if (filters.city) {
      values.push(filters.city);
      where.push(`LOWER(city) = LOWER($${values.length})`);
    }
    if (filters.countryCode) {
      values.push(filters.countryCode);
      where.push(`UPPER(country_code) = UPPER($${values.length})`);
    }
    const result = await this.db.query(
      `SELECT * FROM cash_agents WHERE ${where.join(' AND ')} ORDER BY name ASC LIMIT 50`,
      values
    );
    let rows = result.rows;
    if (filters.lat != null && filters.lng != null) {
      rows = rows
        .map((a: any) => ({
          ...a,
          distanceKm:
            a.lat != null && a.lng != null
              ? Number(
                  (
                    Math.hypot(Number(a.lat) - filters.lat!, Number(a.lng) - filters.lng!) * 111
                  ).toFixed(1)
                )
              : null,
        }))
        .sort((a: any, b: any) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    return rows;
  }

  async listRails(userId: string) {
    const methods = await this.db
      .query(
        `SELECT * FROM wallet_rail_methods WHERE user_id = $1 ORDER BY is_default DESC, updated_at DESC`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));
    const agents = await this.listCashAgents({});
    const promise = await this.getPromise();
    return {
      methods: methods.rows,
      cashAgents: agents.slice(0, 8),
      promise,
      ussdCode: '*920*MOVR#',
      channels: [
        { id: 'wallet', label: 'Movr Wallet', eta: 'Instant' },
        { id: 'momo', label: 'Mobile Money', eta: 'Usually minutes' },
        { id: 'bank', label: 'Bank transfer', eta: 'Same day' },
        { id: 'cash_agent', label: 'Cash agent', eta: 'Walk-in' },
        { id: 'ussd', label: 'USSD *920*MOVR#', eta: 'Works offline' },
      ],
    };
  }

  async upsertRail(
    userId: string,
    data: {
      railType: RailType;
      provider?: string;
      accountNumber?: string;
      accountMask?: string;
      isDefault?: boolean;
      bankCode?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const railType = data.railType;
    if (!['momo', 'bank', 'cash_agent', 'wallet'].includes(railType)) {
      throw new Error('Invalid rail type');
    }
    const mask =
      data.accountMask ||
      (data.accountNumber
        ? `****${String(data.accountNumber).replace(/\D/g, '').slice(-4)}`
        : null);
    if (data.isDefault !== false) {
      await this.db.query(`UPDATE wallet_rail_methods SET is_default = FALSE WHERE user_id = $1`, [
        userId,
      ]);
    }
    const provider =
      data.provider ||
      (railType === 'momo' ? 'MTN MoMo' : railType === 'bank' ? 'Bank' : 'Cash agent');
    const inferredCode = (() => {
      const p = String(provider).toLowerCase();
      if (data.bankCode) return String(data.bankCode).trim();
      if (p.includes('mtn')) return 'MTN';
      if (p.includes('vodafone') || p.includes('telecel')) return 'VOD';
      if (p.includes('airtel') || p.includes('tigo')) return 'ATL';
      if (railType === 'momo') return 'MTN';
      return undefined;
    })();
    const metadata = {
      ...(data.metadata || {}),
      ...(inferredCode ? { bankCode: inferredCode } : {}),
    };
    const row = await this.db.query(
      `INSERT INTO wallet_rail_methods
         (user_id, rail_type, provider, account_mask, account_number, is_default, metadata, updated_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,TRUE),$7::jsonb,NOW())
       RETURNING *`,
      [
        userId,
        railType,
        provider,
        mask,
        data.accountNumber || null,
        data.isDefault !== false,
        JSON.stringify(metadata),
      ]
    );
    return row.rows[0];
  }

  private async ensureWallet(userId: string) {
    let wallet = await this.db.query(`SELECT * FROM wallets WHERE user_id = $1 LIMIT 1`, [userId]);
    if (!wallet.rows[0]) {
      await this.db.query(
        `INSERT INTO wallets (user_id, balance_fiat, balance_points, points_balance, currency)
         VALUES ($1, 0, 0, 0, 'GHS')`,
        [userId]
      );
      wallet = await this.db.query(`SELECT * FROM wallets WHERE user_id = $1 LIMIT 1`, [userId]);
    }
    return wallet.rows[0];
  }

  private async creditWallet(userId: string, amount: number, reference: string, type = 'credit') {
    const wallet = await this.ensureWallet(userId);
    await this.db.query(
      `UPDATE wallets SET balance_fiat = COALESCE(balance_fiat,0) + $1, last_updated = NOW() WHERE id = $2`,
      [amount, wallet.id]
    );
    await this.db
      .query(
        `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference, title, icon_key)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [wallet.id, type, amount, reference, type === 'credit' ? 'Trust credit' : 'Settlement', 'tx']
      )
      .catch(() => undefined);
    return wallet;
  }

  async createReceipt(
    userId: string,
    data: {
      kind: string;
      amount: number;
      currency?: string;
      channel: string;
      counterparty?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const reference = `RCPT-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    const row = await this.db.query(
      `INSERT INTO settlement_receipts
         (user_id, kind, reference, amount, currency, channel, status, counterparty, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING *`,
      [
        userId,
        data.kind,
        reference,
        Number(data.amount) || 0,
        data.currency || 'GHS',
        data.channel,
        data.status || 'completed',
        data.counterparty || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return row.rows[0];
  }

  async cashAgentDeposit(
    userId: string,
    data: { agentId: string; amount: number; currency?: string }
  ) {
    const amount = Number(data.amount);
    if (!amount || amount <= 0) throw new Error('amount must be > 0');
    const agent = await this.db.query(`SELECT * FROM cash_agents WHERE id = $1 AND is_active`, [
      data.agentId,
    ]);
    if (!agent.rows[0]) throw new Error('Cash agent not found');

    const code = this.genCode(6);
    const receipt = await this.createReceipt(userId, {
      kind: 'cash_agent_deposit',
      amount,
      currency: data.currency || 'GHS',
      channel: 'cash_agent',
      counterparty: agent.rows[0].name,
      status: 'pending_agent_confirm',
      metadata: {
        agentId: data.agentId,
        city: agent.rows[0].city,
        code,
        instruction: `Pay cash to ${agent.rows[0].name}. Agent confirms code ${code} to credit your wallet.`,
      },
    });
    await this.db
      .query(`UPDATE settlement_receipts SET confirm_code = $1 WHERE id = $2`, [code, receipt.id])
      .catch(() => undefined);
    await this.notify(
      userId,
      'Cash deposit pending',
      `Show code ${code} at ${agent.rows[0].name}. Wallet credits after agent confirms.`,
      '/wallet/settlement'
    );
    return {
      receipt: { ...receipt, confirm_code: code },
      agent: agent.rows[0],
      code,
      message: `Pending agent confirm — code ${code}`,
    };
  }

  async cashAgentWithdraw(
    userId: string,
    data: { agentId: string; amount: number; currency?: string }
  ) {
    const amount = Number(data.amount);
    if (!amount || amount <= 0) throw new Error('amount must be > 0');
    const agent = await this.db.query(`SELECT * FROM cash_agents WHERE id = $1 AND is_active`, [
      data.agentId,
    ]);
    if (!agent.rows[0]) throw new Error('Cash agent not found');
    const wallet = await this.ensureWallet(userId);
    if (Number(wallet.balance_fiat || 0) < amount) throw new Error('Insufficient wallet balance');

    await this.db.query(
      `UPDATE wallets SET balance_fiat = balance_fiat - $1, last_updated = NOW() WHERE id = $2`,
      [amount, wallet.id]
    );
    await this.db
      .query(
        `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference, title, icon_key)
         VALUES ($1,'withdraw',$2,$3,'Cash agent withdrawal','withdraw')`,
        [wallet.id, -amount, `AGENT-OUT-${Date.now()}`]
      )
      .catch(() => undefined);

    const code = this.genCode(6);
    const receipt = await this.createReceipt(userId, {
      kind: 'cash_agent_withdraw',
      amount,
      currency: data.currency || wallet.currency || 'GHS',
      channel: 'cash_agent',
      counterparty: agent.rows[0].name,
      status: 'pending_pickup',
      metadata: {
        agentId: data.agentId,
        code,
        instruction: 'Show this code + ID at the agent to collect cash',
      },
    });
    await this.db
      .query(`UPDATE settlement_receipts SET confirm_code = $1 WHERE id = $2`, [code, receipt.id])
      .catch(() => undefined);
    await this.notify(
      userId,
      'Cash pickup ready',
      `Collect ${amount} at ${agent.rows[0].name} with code ${code}.`,
      '/wallet/settlement'
    );
    return {
      receipt: { ...receipt, confirm_code: code },
      agent: agent.rows[0],
      code,
      message: `Withdrawal reserved — collect with code ${code}`,
    };
  }

  /** Agent or ops confirms deposit/pickup code → credit (deposit) or complete (withdraw). */
  async confirmCashAgentCode(code: string, opts?: { agentPhone?: string }) {
    const c = String(code || '').trim();
    if (!c) throw new Error('Confirmation code required');
    const row = await this.db.query(
      `SELECT * FROM settlement_receipts
       WHERE confirm_code = $1
          OR metadata->>'code' = $1
       ORDER BY created_at DESC LIMIT 1`,
      [c]
    );
    const receipt = row.rows[0];
    if (!receipt) throw new Error('Invalid or expired code');
    if (['completed', 'collected'].includes(String(receipt.status))) {
      return { alreadyCompleted: true, receipt };
    }

    if (receipt.kind === 'cash_agent_deposit' && receipt.status === 'pending_agent_confirm') {
      await this.creditWallet(
        receipt.user_id,
        Number(receipt.amount),
        `AGENT-IN-${receipt.reference}`,
        'topup'
      );
      const updated = await this.db.query(
        `UPDATE settlement_receipts SET status = 'completed',
           metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb
         WHERE id = $1 RETURNING *`,
        [
          receipt.id,
          JSON.stringify({ confirmedAt: new Date().toISOString(), agentPhone: opts?.agentPhone || null }),
        ]
      );
      await this.notify(
        receipt.user_id,
        'Cash deposit credited',
        `${receipt.amount} added to your Movr Wallet.`,
        '/wallet'
      );
      return { receipt: updated.rows[0], credited: true };
    }

    if (receipt.kind === 'cash_agent_withdraw' && receipt.status === 'pending_pickup') {
      const updated = await this.db.query(
        `UPDATE settlement_receipts SET status = 'collected',
           metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb
         WHERE id = $1 RETURNING *`,
        [receipt.id, JSON.stringify({ collectedAt: new Date().toISOString() })]
      );
      await this.notify(
        receipt.user_id,
        'Cash collected',
        `Pickup of ${receipt.amount} marked complete.`,
        '/wallet/settlement'
      );
      return { receipt: updated.rows[0], collected: true };
    }

    throw new Error(`Cannot confirm receipt in status ${receipt.status}`);
  }

  async listReceipts(userId: string) {
    return this.db.query(
      `SELECT * FROM settlement_receipts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
  }

  async getReceipt(userId: string, idOrRef: string) {
    const row = await this.db.query(
      `SELECT * FROM settlement_receipts
       WHERE user_id = $1 AND (id::text = $2 OR reference = $2)
       LIMIT 1`,
      [userId, idOrRef]
    );
    return row.rows[0] || null;
  }

  async createDispute(
    userId: string,
    data: { domain: string; subjectId?: string; reason: string; refundAmount?: number }
  ) {
    const domain = String(data.domain || '').toLowerCase();
    if (!['ride', 'shop', 'wallet', 'parcel', 'rental'].includes(domain)) {
      throw new Error('Invalid dispute domain');
    }
    const reason = String(data.reason || '').trim();
    if (!reason) throw new Error('Reason is required');
    const row = await this.db.query(
      `INSERT INTO unified_disputes (user_id, domain, subject_id, reason, refund_amount)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, domain, data.subjectId || null, reason, data.refundAmount ?? null]
    );
    return row.rows[0];
  }

  async listDisputes(userId: string) {
    return this.db.query(
      `SELECT * FROM unified_disputes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
  }

  async assertKycForPayout(
    userId: string,
    amount: number,
    role: 'driver' | 'merchant' | 'customer'
  ) {
    const threshold = Number(await this.setting('trust_kyc_payout_threshold', '2000'));
    if (amount < threshold) return { required: false, approved: true, threshold };

    let status = 'pending';
    if (role === 'merchant') {
      const m = await this.db.query(
        `SELECT kyc_status FROM merchants WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      status = String(m.rows[0]?.kyc_status || 'pending').toLowerCase();
    } else if (role === 'driver') {
      const d = await this.db.query(
        `SELECT kyc_status FROM drivers WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      status = String(d.rows[0]?.kyc_status || 'pending').toLowerCase();
    } else {
      const u = await this.db.query(
        `SELECT COALESCE(is_verified, FALSE) AS is_verified FROM users WHERE id = $1`,
        [userId]
      );
      status = u.rows[0]?.is_verified ? 'verified' : 'pending';
    }
    const approved = ['approved', 'verified', 'active'].includes(status);
    if (!approved) {
      throw new Error(
        `KYC required for payouts of ${threshold}+. Current status: ${status}. Complete verification to unlock.`
      );
    }
    return { required: true, approved: true, threshold, status };
  }

  /** Retry pending wallet/driver/merchant payouts that still have rail details. */
  async retryPendingPayouts(payments: {
    initializeTransfer: (input: any) => Promise<any>;
  }) {
    const results: any[] = [];
    const pendingWallet = await this.db
      .query(
        `SELECT * FROM wallet_withdrawals WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`
      )
      .catch(() => ({ rows: [] as any[] }));
    for (const w of pendingWallet.rows) {
      const rail = await this.db
        .query(
          `SELECT * FROM wallet_rail_methods WHERE user_id = $1
           ORDER BY is_default DESC, updated_at DESC LIMIT 1`,
          [w.user_id]
        )
        .catch(() => ({ rows: [] as any[] }));
      const accountNumber = rail.rows[0]?.account_number;
      if (!accountNumber) {
        results.push({ id: w.id, kind: 'wallet', skipped: true, reason: 'no_rail' });
        continue;
      }
      const reference = w.reference || `WD-RETRY-${w.id}`;
      try {
        const transfer = await payments.initializeTransfer({
          amount: Number(w.amount),
          currency: w.currency || 'GHS',
          recipient: {
            accountNumber: String(accountNumber),
            bankCode: rail.rows[0]?.metadata?.bankCode || 'MTN',
            accountBank: rail.rows[0]?.metadata?.bankCode || 'MTN',
          },
          reference,
          narration: 'Movr wallet withdraw retry',
          countryCode: 'GH',
        });
        if (transfer?.success) {
          await this.db.query(
            `UPDATE wallet_withdrawals SET status = 'processing', reference = COALESCE(reference, $2) WHERE id = $1`,
            [w.id, reference]
          );
          results.push({ id: w.id, kind: 'wallet', success: true });
        } else {
          results.push({ id: w.id, kind: 'wallet', success: false, error: transfer?.error });
        }
      } catch (e: any) {
        results.push({ id: w.id, kind: 'wallet', success: false, error: e.message });
      }
    }

    const pendingDriver = await this.db
      .query(`SELECT * FROM payouts WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`)
      .catch(() => ({ rows: [] as any[] }));
    for (const p of pendingDriver.rows) {
      const rail = await this.db
        .query(
          `SELECT * FROM wallet_rail_methods WHERE user_id = $1
           ORDER BY is_default DESC LIMIT 1`,
          [p.driver_id]
        )
        .catch(() => ({ rows: [] as any[] }));
      const accountNumber = rail.rows[0]?.account_number;
      if (!accountNumber) {
        results.push({ id: p.id, kind: 'driver', skipped: true, reason: 'no_rail' });
        continue;
      }
      try {
        const transfer = await payments.initializeTransfer({
          amount: Number(p.amount),
          currency: p.currency || 'GHS',
          recipient: {
            accountNumber: String(accountNumber),
            bankCode: rail.rows[0]?.metadata?.bankCode || 'MTN',
            accountBank: rail.rows[0]?.metadata?.bankCode || 'MTN',
          },
          reference: p.reference_id || `DRV-RETRY-${p.id}`,
          narration: 'Movr driver payout retry',
          countryCode: 'GH',
        });
        if (transfer?.success) {
          await this.db.query(`UPDATE payouts SET status = 'processing' WHERE id = $1`, [p.id]);
          results.push({ id: p.id, kind: 'driver', success: true });
        } else {
          results.push({ id: p.id, kind: 'driver', success: false });
        }
      } catch (e: any) {
        results.push({ id: p.id, kind: 'driver', success: false, error: e.message });
      }
    }

    const pendingMerchant = await this.db
      .query(
        `SELECT * FROM merchant_payouts WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`
      )
      .catch(() => ({ rows: [] as any[] }));
    for (const m of pendingMerchant.rows) {
      const bank =
        typeof m.bank_account === 'string' ? JSON.parse(m.bank_account || '{}') : m.bank_account || {};
      if (!bank.accountNumber) {
        results.push({ id: m.id, kind: 'merchant', skipped: true, reason: 'no_account' });
        continue;
      }
      try {
        const transfer = await payments.initializeTransfer({
          amount: Number(m.amount),
          currency: m.currency || 'GHS',
          recipient: {
            accountNumber: String(bank.accountNumber),
            bankCode: bank.bankCode || bank.bank_code || undefined,
            accountBank: bank.bankCode || bank.bank_code || undefined,
          },
          reference: m.reference_id || `MER-RETRY-${m.id}`,
          narration: 'Movr merchant payout retry',
          countryCode: 'GH',
        });
        if (transfer?.success) {
          await this.db.query(`UPDATE merchant_payouts SET status = 'processing' WHERE id = $1`, [
            m.id,
          ]);
          results.push({ id: m.id, kind: 'merchant', success: true });
        } else {
          results.push({ id: m.id, kind: 'merchant', success: false });
        }
      } catch (e: any) {
        results.push({ id: m.id, kind: 'merchant', success: false, error: e.message });
      }
    }

    return {
      attempted: results.length,
      succeeded: results.filter((r) => r.success).length,
      results,
    };
  }

  async compensateNoShow(userId: string, rideId?: string, note?: string) {
    const credit = Number(await this.setting('trust_no_show_credit', '500'));
    const minWait = Number(await this.setting('trust_no_show_min_wait_seconds', '300'));

    if (!rideId) {
      throw new Error('Ride ID required for no-show compensation');
    }

    const existing = await this.db.query(
      `SELECT id FROM reliability_events WHERE ride_id = $1 AND event_type = 'no_show' LIMIT 1`,
      [rideId]
    );
    if (existing.rows[0]) {
      return { alreadyCredited: true, amount: credit };
    }

    const ride = await this.db.query(
      `SELECT id, customer_id, driver_id, status, created_at, updated_at, accepted_at
       FROM rides WHERE id = $1 LIMIT 1`,
      [rideId]
    );
    const r = ride.rows[0];
    if (!r) throw new Error('Ride not found');
    if (String(r.customer_id) !== String(userId)) {
      throw new Error('Only the rider can claim no-show compensation for this trip');
    }
    if (!r.driver_id) {
      throw new Error('No driver was matched — no-show credit only applies after a driver accepts');
    }

    const status = String(r.status || '').toLowerCase();
    const eligibleStatus = ['accepted', 'arrived', 'en_route', 'driver_arrived', 'cancelled'].some(
      (s) => status.includes(s)
    );
    if (!eligibleStatus && status !== 'requested') {
      throw new Error(`Ride status ${status} is not eligible for no-show credit`);
    }

    const acceptedAt = r.accepted_at || r.updated_at || r.created_at;
    const waitSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(acceptedAt).getTime()) / 1000)
    );
    if (waitSeconds < minWait) {
      throw new Error(
        `Wait at least ${Math.ceil(minWait / 60)} minutes after match before claiming no-show (${waitSeconds}s waited)`
      );
    }

    await this.creditWallet(userId, credit, `NOSHOW-${rideId}`, 'credit');
    const event = await this.db.query(
      `INSERT INTO reliability_events
         (user_id, ride_id, event_type, wait_seconds, compensation_amount, status, note)
       VALUES ($1,$2,'no_show',$3,$4,'credited',$5)
       RETURNING *`,
      [
        userId,
        rideId,
        waitSeconds,
        credit,
        note || `Driver no-show after ${waitSeconds}s wait`,
      ]
    );
    const receipt = await this.createReceipt(userId, {
      kind: 'no_show_credit',
      amount: credit,
      channel: 'wallet',
      counterparty: 'Movr Reliability',
      metadata: { rideId, eventId: event.rows[0].id, waitSeconds, minWait },
    });
    await this.notify(
      userId,
      'No-show credit applied',
      `${credit} credited to your wallet. Sorry for the wait.`,
      '/wallet'
    );
    return { amount: credit, event: event.rows[0], receipt, waitSeconds };
  }

  async recordSlaBreach(userId: string, rideId: string, waitSeconds: number) {
    const sla = Number(await this.setting('trust_match_sla_seconds', '180'));
    if (waitSeconds <= sla) return null;

    const existing = await this.db.query(
      `SELECT id FROM reliability_events WHERE ride_id = $1 AND event_type = 'sla_breach' LIMIT 1`,
      [rideId]
    );
    if (existing.rows[0]) return { alreadyCredited: true, event: existing.rows[0] };

    const credit = Math.min(
      Number(await this.setting('trust_no_show_credit', '500')) / 2,
      300
    );
    await this.creditWallet(userId, credit, `SLA-${rideId}`, 'credit');
    const event = await this.db.query(
      `INSERT INTO reliability_events
         (user_id, ride_id, event_type, sla_seconds, wait_seconds, compensation_amount, status, note)
       VALUES ($1,$2,'sla_breach',$3,$4,$5,'credited',$6)
       RETURNING *`,
      [userId, rideId, sla, waitSeconds, credit, 'Match SLA breach credit']
    );
    await this.createReceipt(userId, {
      kind: 'sla_credit',
      amount: credit,
      channel: 'wallet',
      counterparty: 'Movr Reliability',
      metadata: { rideId, waitSeconds, sla },
    }).catch(() => undefined);
    await this.notify(
      userId,
      'Match SLA credit',
      `Matching took ${Math.round(waitSeconds / 60)} min (promise ${Math.round(sla / 60)}). ${credit} credited.`,
      '/wallet'
    );
    return event.rows[0];
  }

  /** Called when a driver accepts — credits rider if match exceeded SLA. */
  async onRideAccepted(rideId: string) {
    const ride = await this.db.query(
      `SELECT id, customer_id, created_at FROM rides WHERE id = $1 LIMIT 1`,
      [rideId]
    );
    const r = ride.rows[0];
    if (!r?.customer_id) return null;
    const waitSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(r.created_at).getTime()) / 1000)
    );
    return this.recordSlaBreach(r.customer_id, rideId, waitSeconds);
  }

  async resolveDispute(
    disputeId: string,
    data: { status: string; refundAmount?: number; opsNote?: string; adminId?: string }
  ) {
    const status = String(data.status || '').toLowerCase();
    if (!['open', 'investigating', 'resolved', 'rejected'].includes(status)) {
      throw new Error('Invalid status');
    }
    const cur = await this.db.query(`SELECT * FROM unified_disputes WHERE id = $1`, [disputeId]);
    const d = cur.rows[0];
    if (!d) throw new Error('Dispute not found');

    const refund =
      data.refundAmount != null ? Number(data.refundAmount) : Number(d.refund_amount || 0);

    const row = await this.db.query(
      `UPDATE unified_disputes SET
         status = $1,
         refund_amount = COALESCE($2, refund_amount),
         ops_note = COALESCE($3, ops_note),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, data.refundAmount != null ? refund : null, data.opsNote || null, disputeId]
    );

    if (status === 'resolved' && refund > 0) {
      await this.creditWallet(d.user_id, refund, `DISPUTE-${disputeId}`, 'credit');
      await this.createReceipt(d.user_id, {
        kind: 'dispute_refund',
        amount: refund,
        channel: 'wallet',
        counterparty: 'Movr Trust',
        metadata: { disputeId, domain: d.domain, adminId: data.adminId },
      }).catch(() => undefined);
      await this.notify(
        d.user_id,
        'Dispute resolved — refund issued',
        `${refund} credited for your ${d.domain} dispute.`,
        '/wallet'
      );
    } else if (status === 'resolved' || status === 'rejected') {
      await this.notify(
        d.user_id,
        status === 'resolved' ? 'Dispute resolved' : 'Dispute closed',
        data.opsNote || `Your ${d.domain} dispute was marked ${status}.`,
        '/wallet/settlement'
      );
    }

    return row.rows[0];
  }

  async createTripShare(userId: string, rideId?: string) {
    let id = rideId;
    if (!id) {
      const active = await this.db.query(
        `SELECT id FROM rides
         WHERE customer_id = $1 AND status IN ('accepted','arrived','in_progress','en_route','requested')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      id = active.rows[0]?.id;
    }
    if (!id) throw new Error('No active trip to share');
    const token = crypto.randomBytes(12).toString('hex');
    await this.db.query(
      `INSERT INTO ride_share_links (ride_id, token, expires_at)
       VALUES ($1,$2, NOW() + INTERVAL '24 hours')`,
      [id, token]
    );
    return {
      rideId: id,
      token,
      shareUrl: `/trip/${token}`,
      publicUrl: `${process.env.PUBLIC_WEB_URL || process.env.WEB_APP_URL || 'http://localhost:5180'}/trip/${token}`,
      expiresInHours: 24,
    };
  }

  async getSharedTrip(token: string) {
    const link = await this.db.query(
      `SELECT s.token, s.expires_at, r.id, r.status, r.pickup_address, r.dropoff_address,
              r.estimated_fare, r.actual_fare, r.currency
       FROM ride_share_links s
       JOIN rides r ON r.id = s.ride_id
       WHERE s.token = $1 AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    return link.rows[0] || null;
  }

  async listActiveSos(limit = 50) {
    const result = await this.db.query(
      `SELECT s.*,
              COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS customer_name,
              u.phone AS customer_phone,
              r.pickup_address, r.dropoff_address, r.status AS ride_status,
              r.pickup_lat, r.pickup_lng,
              COALESCE(d.first_name,'') || ' ' || COALESCE(d.last_name,'') AS driver_name,
              d.phone AS driver_phone
       FROM sos_emergencies s
       LEFT JOIN users u ON u.id = s.customer_id
       LEFT JOIN rides r ON r.id = s.ride_id
       LEFT JOIN users d ON d.id = s.driver_id
       WHERE LOWER(COALESCE(s.status,'active')) IN ('active','open','pending')
       ORDER BY s.created_at DESC
       LIMIT $1`,
      [limit]
    );

    const enriched = [];
    for (const row of result.rows) {
      const contacts = await this.db
        .query(
          `SELECT contact_name, phone_number, relationship, is_primary
           FROM emergency_contacts
           WHERE ($1::uuid IS NOT NULL AND user_id = $1)
              OR ($2::uuid IS NOT NULL AND user_id = $2)
           ORDER BY is_primary DESC NULLS LAST
           LIMIT 8`,
          [row.customer_id || null, row.driver_id || null]
        )
        .catch(() => ({ rows: [] as any[] }));
      const loc = row.location || {};
      enriched.push({
        ...row,
        lat: loc.lat ?? row.pickup_lat ?? null,
        lng: loc.lng ?? row.pickup_lng ?? null,
        mapUrl:
          (loc.lat ?? row.pickup_lat) != null
            ? `https://www.google.com/maps?q=${loc.lat ?? row.pickup_lat},${loc.lng ?? row.pickup_lng}`
            : null,
        emergencyContacts: contacts.rows,
        runbook: [
          '1. Call rider + driver proxy numbers',
          '2. Open live map / share location with ops',
          '3. Confirm emergency contacts were SMS’d',
          '4. Escalate to local emergency if needed',
          '5. Resolve with notes when safe',
        ],
      });
    }
    return { rows: enriched };
  }

  async resolveSos(sosId: string, adminId: string, note?: string) {
    const row = await this.db.query(
      `UPDATE sos_emergencies
       SET status = 'resolved', resolved_by = $2, resolved_at = NOW(),
           notes = COALESCE($3, notes)
       WHERE id = $1
       RETURNING *`,
      [sosId, adminId, note || null]
    );
    return row.rows[0];
  }
}
