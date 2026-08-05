import crypto from 'crypto';
import { ethers } from 'ethers';
import winston from 'winston';
import { DatabaseService } from './database.service';

const STATUS_TO_ENUM: Record<string, number> = {
  Pending: 0,
  Verified: 1,
  Rejected: 2,
  Revoked: 3,
};

const ABI = [
  'function attest(bytes32 subjectId, bytes32 recordHash, uint8 status)',
  'function revoke(bytes32 subjectId)',
  'function getAttestation(bytes32 subjectId) view returns (uint8 status, bytes32 recordHash, uint256 verifiedAt, address verifier)',
  'event Attested(bytes32 indexed subjectId, uint8 status, bytes32 recordHash, address verifier)',
];

/**
 * On-chain KYC attestation — hashes + status only, never PII (Phase 5A).
 */
export class KycAttestationService {
  private db: DatabaseService;
  private logger: winston.Logger;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private chain: string;

  constructor(db: DatabaseService) {
    this.db = db;
    this.chain = process.env.KYC_CHAIN || 'polygon-amoy';
    this.logger = winston.createLogger({
      defaultMeta: { service: 'kyc-attestation' },
      transports: [new winston.transports.Console()],
    });

    const pk = process.env.KYC_VERIFIER_PRIVATE_KEY;
    const rpc = process.env.POLYGON_AMOY_RPC_URL || process.env.POLYGON_RPC_URL;
    const address = process.env.KYC_REGISTRY_ADDRESS;

    if (pk && rpc && address) {
      const provider = new ethers.JsonRpcProvider(rpc);
      this.wallet = new ethers.Wallet(pk, provider);
      this.contract = new ethers.Contract(address, ABI, this.wallet);
    } else {
      this.logger.warn(
        'KYC attestation running in offline mode (missing KYC_VERIFIER_PRIVATE_KEY / RPC / KYC_REGISTRY_ADDRESS)'
      );
    }
  }

  computeSubjectId(userId: string): string {
    const secret =
      process.env.KYC_SUBJECT_HMAC_SECRET ||
      process.env.JWT_SECRET ||
      'movr-kyc-subject-dev';
    const digest = crypto.createHmac('sha256', secret).update(userId).digest('hex');
    return `0x${digest}`;
  }

  computeRecordHash(kycRecord: {
    documentType?: string;
    verificationMethod?: string;
    approvalTimestamp?: string | Date;
    verifierAdminId?: string;
    identityLinked?: boolean;
    trustTier?: string;
  }): string {
    const payload = [
      kycRecord.documentType || '',
      kycRecord.verificationMethod || '',
      kycRecord.approvalTimestamp
        ? new Date(kycRecord.approvalTimestamp).toISOString()
        : '',
      kycRecord.verifierAdminId || '',
      // Phase 26 — higher trust tier when full identity link verified
      kycRecord.identityLinked ? 'identity_linked' : 'documents_only',
      kycRecord.trustTier || '',
    ].join('|');
    return `0x${crypto.createHash('sha256').update(payload).digest('hex')}`;
  }

  async publishAttestation(
    userId: string,
    status: 'Pending' | 'Verified' | 'Rejected' | 'Revoked',
    kycRecord: {
      documentType?: string;
      verificationMethod?: string;
      approvalTimestamp?: string | Date;
      verifierAdminId?: string;
      identityLinked?: boolean;
      trustTier?: string;
    }
  ) {
    // Enrich with current Identity-Linked status when not explicitly provided
    if (kycRecord.identityLinked == null) {
      try {
        const linked = await this.db.query(
          `SELECT 1 FROM identity_verifications iv
           JOIN drivers d ON d.id = iv.driver_id
           WHERE d.user_id = $1 AND iv.identity_linked = TRUE
           LIMIT 1`,
          [userId]
        );
        kycRecord.identityLinked = Boolean(linked.rows[0]);
        if (kycRecord.identityLinked) {
          kycRecord.trustTier = kycRecord.trustTier || 'full_identity_link_verified';
        }
      } catch {
        /* optional */
      }
    }
    const subjectId = this.computeSubjectId(userId);
    const recordHash = this.computeRecordHash(kycRecord);
    let txHash: string | null = null;

    if (this.contract) {
      try {
        if (status === 'Revoked') {
          const tx = await this.contract.revoke(subjectId);
          const receipt = await tx.wait();
          txHash = receipt?.hash || tx.hash;
        } else {
          const tx = await this.contract.attest(
            subjectId,
            recordHash,
            STATUS_TO_ENUM[status]
          );
          const receipt = await tx.wait();
          txHash = receipt?.hash || tx.hash;
        }
      } catch (error: any) {
        this.logger.error('On-chain attest failed; storing local record only', {
          error: error.message,
        });
      }
    } else {
      txHash = `offline-${Date.now()}`;
    }

    const verifiedAt = status === 'Verified' ? new Date() : null;
    const revokedAt = status === 'Revoked' ? new Date() : null;

    const result = await this.db.query(
      `INSERT INTO kyc_attestations
         (user_id, subject_id, record_hash, status, tx_hash, chain, verified_at, revoked_at)
       VALUES ($1,$2,$3,$4::kyc_attestation_status,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET
         subject_id = EXCLUDED.subject_id,
         record_hash = EXCLUDED.record_hash,
         status = EXCLUDED.status,
         tx_hash = EXCLUDED.tx_hash,
         chain = EXCLUDED.chain,
         verified_at = EXCLUDED.verified_at,
         revoked_at = COALESCE(EXCLUDED.revoked_at, kyc_attestations.revoked_at),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        subjectId,
        recordHash,
        status,
        txHash,
        this.chain,
        verifiedAt,
        revokedAt,
      ]
    );

    return result.rows[0];
  }

  async getByUserId(userId: string) {
    const local = await this.db.query(
      `SELECT * FROM kyc_attestations WHERE user_id = $1`,
      [userId]
    );
    const row = local.rows[0];
    if (!row) return null;

    let onchain: any = null;
    let matches = true;
    if (this.contract) {
      try {
        const [status, recordHash, verifiedAt, verifier] =
          await this.contract.getAttestation(row.subject_id);
        onchain = {
          status: Number(status),
          recordHash,
          verifiedAt: Number(verifiedAt),
          verifier,
        };
        matches =
          recordHash?.toLowerCase() === row.record_hash?.toLowerCase() &&
          Number(status) === STATUS_TO_ENUM[row.status];
      } catch (error: any) {
        this.logger.warn('On-chain read failed', { error: error.message });
        matches = false;
      }
    }

    return { local: row, onchain, matches };
  }

  async getPublicBySubjectId(subjectId: string) {
    const result = await this.db.query(
      `SELECT subject_id, status, tx_hash, chain, verified_at
       FROM kyc_attestations WHERE subject_id = $1`,
      [subjectId]
    );
    return result.rows[0] || null;
  }

  explorerTxUrl(txHash: string | null): string | null {
    if (!txHash || txHash.startsWith('offline-')) return null;
    const base =
      this.chain === 'polygon'
        ? 'https://polygonscan.com/tx/'
        : 'https://amoy.polygonscan.com/tx/';
    return `${base}${txHash}`;
  }
}
