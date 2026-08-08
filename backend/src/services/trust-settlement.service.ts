import crypto from 'crypto';
import { DatabaseService } from './database.service';

type RailType = 'wallet' | 'momo' | 'bank' | 'cash_agent';

export class TrustSettlementService {
  constructor(private db: DatabaseService) {}

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
    return {
      countryCode: countryCode || 'GH',
      matchSlaSeconds: sla,
      matchSlaText: `Driver match in under ${Math.round(sla / 60)} min`,
      noShowCredit: credit,
      noShowText: `If your driver no-shows, we credit ${credit} to your wallet automatically.`,
      kycPayoutThreshold: kycThreshold,
      keep100Note: 'Drivers keep 100% of the fare — Movr takes zero from the trip.',
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
    const row = await this.db.query(
      `INSERT INTO wallet_rail_methods (user_id, rail_type, provider, account_mask, account_number, is_default, updated_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,TRUE),NOW())
       RETURNING *`,
      [
        userId,
        railType,
        data.provider || (railType === 'momo' ? 'MTN MoMo' : railType === 'bank' ? 'Bank' : 'Cash agent'),
        mask,
        data.accountNumber || null,
        data.isDefault !== false,
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

    await this.creditWallet(userId, amount, `AGENT-IN-${Date.now()}`, 'topup');
    const receipt = await this.createReceipt(userId, {
      kind: 'cash_agent_deposit',
      amount,
      currency: data.currency || 'GHS',
      channel: 'cash_agent',
      counterparty: agent.rows[0].name,
      metadata: { agentId: data.agentId, city: agent.rows[0].city },
    });
    return { receipt, agent: agent.rows[0], message: 'Cash deposit credited to Movr Wallet' };
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

    const receipt = await this.createReceipt(userId, {
      kind: 'cash_agent_withdraw',
      amount,
      currency: data.currency || wallet.currency || 'GHS',
      channel: 'cash_agent',
      counterparty: agent.rows[0].name,
      status: 'pending_pickup',
      metadata: {
        agentId: data.agentId,
        code: String(Math.floor(100000 + Math.random() * 900000)),
        instruction: 'Show this code + ID at the agent to collect cash',
      },
    });
    return { receipt, agent: agent.rows[0], message: 'Withdrawal reserved — collect at agent' };
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

  async assertKycForPayout(userId: string, amount: number, role: 'driver' | 'merchant') {
    const threshold = Number(await this.setting('trust_kyc_payout_threshold', '2000'));
    if (amount < threshold) return { required: false, approved: true, threshold };

    let status = 'pending';
    if (role === 'merchant') {
      const m = await this.db.query(
        `SELECT kyc_status FROM merchants WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      status = String(m.rows[0]?.kyc_status || 'pending').toLowerCase();
    } else {
      const d = await this.db.query(
        `SELECT kyc_status FROM drivers WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      status = String(d.rows[0]?.kyc_status || 'pending').toLowerCase();
    }
    const approved = ['approved', 'verified', 'active'].includes(status);
    if (!approved) {
      throw new Error(
        `KYC required for payouts of ${threshold}+. Current status: ${status}. Complete verification to unlock.`
      );
    }
    return { required: true, approved: true, threshold, status };
  }

  async compensateNoShow(userId: string, rideId?: string, note?: string) {
    const credit = Number(await this.setting('trust_no_show_credit', '500'));
    if (rideId) {
      const existing = await this.db.query(
        `SELECT id FROM reliability_events WHERE ride_id = $1 AND event_type = 'no_show' LIMIT 1`,
        [rideId]
      );
      if (existing.rows[0]) {
        return { alreadyCredited: true, amount: credit };
      }
    }
    await this.creditWallet(userId, credit, `NOSHOW-${rideId || Date.now()}`, 'credit');
    const event = await this.db.query(
      `INSERT INTO reliability_events
         (user_id, ride_id, event_type, compensation_amount, status, note)
       VALUES ($1,$2,'no_show',$3,'credited',$4)
       RETURNING *`,
      [userId, rideId || null, credit, note || 'Driver no-show compensation']
    );
    const receipt = await this.createReceipt(userId, {
      kind: 'no_show_credit',
      amount: credit,
      channel: 'wallet',
      counterparty: 'Movr Reliability',
      metadata: { rideId, eventId: event.rows[0].id },
    });
    return { amount: credit, event: event.rows[0], receipt };
  }

  async recordSlaBreach(userId: string, rideId: string, waitSeconds: number) {
    const sla = Number(await this.setting('trust_match_sla_seconds', '180'));
    if (waitSeconds <= sla) return null;
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
    return event.rows[0];
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
    return this.db.query(
      `SELECT s.*,
              COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS customer_name,
              u.phone AS customer_phone
       FROM sos_emergencies s
       LEFT JOIN users u ON u.id = s.customer_id
       WHERE LOWER(COALESCE(s.status,'active')) IN ('active','open','pending')
       ORDER BY s.created_at DESC
       LIMIT $1`,
      [limit]
    );
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
