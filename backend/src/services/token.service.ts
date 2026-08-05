import { ethers, Wallet, Contract, JsonRpcProvider } from 'ethers';
import { DatabaseService } from './database.service';
import { encrypt, decrypt } from '../utils/encryption.util';
import getLogger from '../utils/logger';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function distributeReward(address to, uint256 amount, bytes32 activityRef)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event RewardDistributed(address indexed to, uint256 amount, bytes32 activityRef)',
];

/**
 * Phase 5B — DVT custodial wallet + off-chain ledger mirror.
 * Gated by TOKEN_SYSTEM_ENABLED=true.
 */
export class TokenService {
  private logger = getLogger('token');
  private provider: JsonRpcProvider | null = null;
  private contract: Contract | null = null;
  private distributor: Wallet | null = null;

  constructor(private db: DatabaseService) {
    this.initChain();
  }

  isEnabled() {
    return process.env.TOKEN_SYSTEM_ENABLED === 'true';
  }

  private initChain() {
    const rpc =
      process.env.POLYGON_AMOY_RPC_URL ||
      process.env.POLYGON_RPC_URL ||
      process.env.WEB3_PROVIDER_URL;
    const key = process.env.DVT_DISTRIBUTOR_PRIVATE_KEY || process.env.KYC_VERIFIER_PRIVATE_KEY;
    const address = process.env.DVT_TOKEN_ADDRESS;

    if (!rpc || !key || !address) {
      this.logger.warn('DVT chain offline — missing RPC / distributor key / token address');
      return;
    }

    try {
      this.provider = new JsonRpcProvider(rpc);
      this.distributor = new Wallet(key, this.provider);
      this.contract = new Contract(address, ERC20_ABI, this.distributor);
    } catch (err: any) {
      this.logger.warn('DVT chain init failed', { error: err.message });
    }
  }

  async ensureCustodialWallet(userId: string) {
    const existing = await this.db.query(
      `SELECT id, address FROM custodial_wallets WHERE user_id = $1`,
      [userId]
    );
    if (existing.rows[0]) return existing.rows[0];

    const wallet = Wallet.createRandom();
    const row = await this.db.query(
      `INSERT INTO custodial_wallets (user_id, address, encrypted_private_key)
       VALUES ($1, $2, $3)
       RETURNING id, address`,
      [userId, wallet.address, encrypt(wallet.privateKey)]
    );
    await this.db.query(
      `INSERT INTO token_balances (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    return row.rows[0];
  }

  async getBalance(userId: string) {
    await this.ensureCustodialWallet(userId);
    const row = await this.db.query(`SELECT * FROM token_balances WHERE user_id = $1`, [userId]);
    const bal = row.rows[0] || { pending_amount: 0, onchain_amount: 0 };
    return {
      pending: Number(bal.pending_amount),
      onchain: Number(bal.onchain_amount),
      total: Number(bal.pending_amount) + Number(bal.onchain_amount),
      lastSyncedBlock: Number(bal.last_synced_block || 0),
      enabled: this.isEnabled(),
    };
  }

  async getHistory(userId: string, limit = 50) {
    const rows = await this.db.query(
      `SELECT * FROM token_activity_log WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.rows;
  }

  /**
   * Credit pending DVT and optionally mint on-chain when TOKEN_SYSTEM_ENABLED.
   */
  async distributeReward(userId: string, amount: number, activityType: string, activityRef?: string) {
    if (amount <= 0) return null;
    await this.ensureCustodialWallet(userId);

    const log = await this.db.query(
      `INSERT INTO token_activity_log (user_id, activity_type, dvt_amount, status, metadata)
       VALUES ($1, $2, $3, 'pending', $4::jsonb) RETURNING *`,
      [userId, activityType, amount, JSON.stringify({ activityRef: activityRef || null })]
    );

    await this.db.query(
      `INSERT INTO token_balances (user_id, pending_amount)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         pending_amount = token_balances.pending_amount + EXCLUDED.pending_amount,
         updated_at = NOW()`,
      [userId, amount]
    );

    if (!this.isEnabled() || !this.contract) {
      return { ...log.rows[0], onchain: false };
    }

    try {
      const wallet = await this.db.query(
        `SELECT address FROM custodial_wallets WHERE user_id = $1`,
        [userId]
      );
      const wei = ethers.parseUnits(String(amount), 18);
      const ref = ethers.id(activityRef || `${activityType}:${log.rows[0].id}`);
      const tx = await this.contract.distributeReward(wallet.rows[0].address, wei, ref);
      const receipt = await tx.wait();

      await this.db.query(
        `UPDATE token_activity_log SET status = 'confirmed', tx_hash = $1 WHERE id = $2`,
        [receipt.hash, log.rows[0].id]
      );
      await this.db.query(
        `UPDATE token_balances SET
           pending_amount = GREATEST(pending_amount - $1, 0),
           onchain_amount = onchain_amount + $1,
           last_synced_block = $2,
           updated_at = NOW()
         WHERE user_id = $3`,
        [amount, receipt.blockNumber, userId]
      );

      return { ...log.rows[0], status: 'confirmed', tx_hash: receipt.hash, onchain: true };
    } catch (err: any) {
      this.logger.warn('on-chain distribute failed; pending credit kept', { error: err.message });
      await this.db.query(
        `UPDATE token_activity_log SET status = 'pending_chain', metadata = metadata || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ error: err.message }), log.rows[0].id]
      );
      return { ...log.rows[0], onchain: false, error: err.message };
    }
  }

  async getRedeemRate() {
    const row = await this.db.query(`SELECT * FROM token_redeem_config WHERE id = 1`);
    return row.rows[0] || { dvt_per_fiat_unit: 10, currency_code: 'GHS' };
  }

  async redeem(userId: string, dvtAmount: number) {
    if (!this.isEnabled()) throw new Error('Token system disabled');
    if (dvtAmount <= 0) throw new Error('Amount must be positive');

    const bal = await this.getBalance(userId);
    if (bal.total < dvtAmount) throw new Error('Insufficient DVT balance');

    const rate = await this.getRedeemRate();
    const fiatCredit = dvtAmount / Number(rate.dvt_per_fiat_unit);

    return this.db.transaction(async (client) => {
      const tb = (
        await client.query(`SELECT * FROM token_balances WHERE user_id = $1 FOR UPDATE`, [userId])
      ).rows[0];
      const available = Number(tb?.pending_amount || 0) + Number(tb?.onchain_amount || 0);
      if (available < dvtAmount) throw new Error('Insufficient DVT balance');

      let remaining = dvtAmount;
      const fromPending = Math.min(Number(tb.pending_amount), remaining);
      remaining -= fromPending;
      const fromOnchain = remaining;

      await client.query(
        `UPDATE token_balances SET
           pending_amount = pending_amount - $1,
           onchain_amount = onchain_amount - $2,
           updated_at = NOW()
         WHERE user_id = $3`,
        [fromPending, fromOnchain, userId]
      );

      await client.query(
        `INSERT INTO token_activity_log (user_id, activity_type, dvt_amount, status, metadata)
         VALUES ($1, 'redeem', $2, 'confirmed', $3::jsonb)`,
        [
          userId,
          -dvtAmount,
          JSON.stringify({ fiatCredit, currency: rate.currency_code }),
        ]
      );

      const wallet = (
        await client.query(`SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId])
      ).rows[0];
      if (wallet) {
        await client.query(
          `UPDATE wallets SET balance_fiat = balance_fiat + $1, last_updated = NOW() WHERE id = $2`,
          [fiatCredit, wallet.id]
        );
        await client.query(
          `INSERT INTO wallet_transactions_v2 (wallet_id, type, amount, reference)
           VALUES ($1, 'dvt_redeem', $2, $3)`,
          [wallet.id, fiatCredit, `dvt-redeem`]
        );
      }

      return {
        dvtBurned: dvtAmount,
        fiatCredit,
        currency: rate.currency_code,
      };
    });
  }

  /** Sync on-chain balance into token_balances.onchain_amount (best-effort). */
  async syncOnchainBalance(userId: string) {
    if (!this.contract) return null;
    const w = await this.ensureCustodialWallet(userId);
    const raw = await this.contract.balanceOf(w.address);
    const onchain = Number(ethers.formatUnits(raw, 18));
    await this.db.query(
      `UPDATE token_balances SET onchain_amount = $1, updated_at = NOW() WHERE user_id = $2`,
      [onchain, userId]
    );
    return { address: w.address, onchain };
  }

  /** Build Merkle tree from [{ address, amount, userId? }] — Phase 8. */
  generateMerkleTree(
    snapshotList: Array<{ address: string; amount: string | number; userId?: string }>
  ) {
    const leaves = snapshotList.map((row, index) => {
      const amountWei = ethers.parseUnits(String(row.amount), 18);
      const leaf = ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'uint256'],
        [index, ethers.getAddress(row.address), amountWei]
      );
      return { index, address: ethers.getAddress(row.address), amountWei, leaf, userId: row.userId };
    });

    const layers: string[][] = [leaves.map((l) => l.leaf)];
    while (layers[layers.length - 1].length > 1) {
      const prev = layers[layers.length - 1];
      const next: string[] = [];
      for (let i = 0; i < prev.length; i += 2) {
        if (i + 1 === prev.length) {
          next.push(prev[i]);
        } else {
          const [a, b] = prev[i] <= prev[i + 1] ? [prev[i], prev[i + 1]] : [prev[i + 1], prev[i]];
          next.push(ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [a, b]));
        }
      }
      layers.push(next);
    }

    const root = layers[layers.length - 1][0];

    const proofs = leaves.map((leaf) => {
      const proof: string[] = [];
      let idx = leaf.index;
      for (let layer = 0; layer < layers.length - 1; layer++) {
        const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
        if (pairIdx < layers[layer].length) {
          proof.push(layers[layer][pairIdx]);
        }
        idx = Math.floor(idx / 2);
      }
      return { ...leaf, proof, amount: ethers.formatUnits(leaf.amountWei, 18) };
    });

    return { root, leaves: proofs };
  }

  verifyMerkleProof(
    address: string,
    amount: string | number,
    index: number,
    proof: string[],
    root: string
  ) {
    const amountWei = ethers.parseUnits(String(amount), 18);
    let computed = ethers.solidityPackedKeccak256(
      ['uint256', 'address', 'uint256'],
      [index, ethers.getAddress(address), amountWei]
    );
    for (const p of proof) {
      const [a, b] = computed <= p ? [computed, p] : [p, computed];
      computed = ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [a, b]);
    }
    return computed.toLowerCase() === root.toLowerCase();
  }

  async persistAirdropSnapshot(
    snapshotList: Array<{ address: string; amount: string | number; userId?: string }>,
    label?: string
  ) {
    const { root, leaves } = this.generateMerkleTree(snapshotList);
    const snap = await this.db.query(
      `INSERT INTO airdrop_snapshots (merkle_root, label) VALUES ($1, $2) RETURNING *`,
      [root, label || null]
    );
    for (const leaf of leaves) {
      await this.db.query(
        `INSERT INTO airdrop_allocations
           (snapshot_id, user_id, address, amount, leaf_index, proof)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          snap.rows[0].id,
          leaf.userId || null,
          leaf.address,
          leaf.amount,
          leaf.index,
          JSON.stringify(leaf.proof),
        ]
      );
    }
    return { snapshot: snap.rows[0], root, count: leaves.length };
  }

  async getClaimEligibility(userId: string) {
    const wallet = await this.ensureCustodialWallet(userId);
    const row = await this.db.query(
      `SELECT a.*, s.merkle_root, s.generated_at, s.label
       FROM airdrop_allocations a
       JOIN airdrop_snapshots s ON s.id = a.snapshot_id
       WHERE s.active = TRUE
         AND a.claimed = FALSE
         AND (a.user_id = $1 OR LOWER(a.address) = LOWER($2))
       ORDER BY s.generated_at DESC
       LIMIT 1`,
      [userId, wallet.address]
    );
    if (!row.rows[0]) {
      return { eligible: false, amount: 0, proof: [], address: wallet.address };
    }
    const a = row.rows[0];
    const proof = Array.isArray(a.proof) ? a.proof : JSON.parse(a.proof || '[]');
    const valid = this.verifyMerkleProof(a.address, a.amount, a.leaf_index, proof, a.merkle_root);
    return {
      eligible: true,
      allocationId: a.id,
      amount: Number(a.amount),
      index: a.leaf_index,
      proof,
      merkleRoot: a.merkle_root,
      address: a.address,
      distributor: process.env.DVT_MERKLE_DISTRIBUTOR_ADDRESS || null,
      proofValid: valid,
      claimMode:
        process.env.CLAIM_CUSTODIAL_ENABLED === 'true' ? 'custodial' : 'external_wallet',
    };
  }

  async markClaimed(userId: string, allocationId: string, txHash?: string) {
    const row = await this.db.query(
      `UPDATE airdrop_allocations SET
         claimed = TRUE, claimed_at = NOW(), claim_tx_hash = COALESCE($1, claim_tx_hash)
       WHERE id = $2 AND (user_id = $3 OR user_id IS NULL)
       RETURNING *`,
      [txHash || null, allocationId, userId]
    );
    if (!row.rows[0]) throw new Error('Allocation not found');
    return row.rows[0];
  }

  async claimCustodial(userId: string) {
    if (process.env.CLAIM_CUSTODIAL_ENABLED !== 'true') {
      throw new Error('Custodial claim disabled — use external wallet claim page');
    }
    const eligibility = await this.getClaimEligibility(userId);
    if (!eligibility.eligible) throw new Error('Nothing to claim');

    // Credit via distributeReward path (ledger + optional on-chain mint)
    await this.distributeReward(
      userId,
      eligibility.amount,
      'airdrop_claim',
      eligibility.allocationId
    );
    return this.markClaimed(userId, eligibility.allocationId as string, 'custodial');
  }
}
