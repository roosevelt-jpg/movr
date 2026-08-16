import crypto from 'crypto';
import { ethers } from 'ethers';
import winston from 'winston';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';

const STATUS_TO_ENUM: Record<string, number> = {
  Pending: 0,
  Verified: 1,
  Rejected: 2,
  Revoked: 3,
};

const ENUM_TO_STATUS = ['Pending', 'Verified', 'Rejected', 'Revoked'] as const;

const AMOY_RPC = 'https://rpc-amoy.polygon.technology';
const AMOY_CHAIN_ID = 80002;
const POS_CHAIN_ID = 137;

const ABI = [
  'function attest(bytes32 subjectId, bytes32 recordHash, uint8 status)',
  'function revoke(bytes32 subjectId)',
  'function getAttestation(bytes32 subjectId) view returns (uint8 status, bytes32 recordHash, uint256 verifiedAt, address verifier)',
  'event Attested(bytes32 indexed subjectId, uint8 status, bytes32 recordHash, address verifier)',
  'event Revoked(bytes32 indexed subjectId, address verifier)',
];

export type KycStatus = 'Pending' | 'Verified' | 'Rejected' | 'Revoked';

type ChainConfig = {
  rpcUrl: string;
  wssUrl: string;
  chain: string;
  chainId: number;
  registryAddress: string;
  verifierKey: string;
  hmacSecret: string;
};

let ioRef: { to: (room: string) => { emit: (ev: string, data: any) => void }; emit: (ev: string, data: any) => void } | null =
  null;

export function attachKycIo(io: any) {
  ioRef = io;
}

function emitKyc(userId: string, payload: any) {
  try {
    ioRef?.to(`kyc:${userId}`).emit('kyc:updated', payload);
    ioRef?.to('admin:live').emit('kyc:updated', { userId, ...payload });
  } catch {
    /* sockets optional */
  }
}

/**
 * On-chain KYC attestation against Movr's KYCRegistry on Polygon Amoy / PoS.
 * Hashes + status only — never PII. Not Civic / Polygon ID / Worldcoin.
 */
export class KycAttestationService {
  private db: DatabaseService;
  private integrations: IntegrationsService;
  private logger: winston.Logger;
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private writer: ethers.Contract | null = null;
  private reader: ethers.Contract | null = null;
  private cfg: ChainConfig | null = null;
  private connecting: Promise<ChainConfig | null> | null = null;
  private warnedMissingRegistry = false;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    this.integrations = new IntegrationsService(this.db);
    this.logger = winston.createLogger({
      defaultMeta: { service: 'kyc-attestation' },
      transports: [new winston.transports.Console()],
    });
  }

  private async loadConfig(): Promise<ChainConfig> {
    const chain =
      (await this.integrations
        .resolveSecret('kyc_registry', ['chain'], ['KYC_CHAIN'])
        .catch(() => null)) ||
      process.env.KYC_CHAIN ||
      'polygon-amoy';
    const isMainnet = chain === 'polygon' || chain === 'polygon-pos';
    const rpcUrl =
      (await this.integrations
        .resolveSecret(
          'polygon_amoy',
          ['rpc_url', 'http_url'],
          ['POLYGON_AMOY_RPC_URL', 'POLYGON_RPC_URL', 'WEB3_PROVIDER_URL']
        )
        .catch(() => null)) ||
      process.env.POLYGON_AMOY_RPC_URL ||
      process.env.POLYGON_RPC_URL ||
      AMOY_RPC;
    const wssUrl =
      (await this.integrations
        .resolveSecret('polygon_amoy', ['wss_url', 'websocket_url'], ['POLYGON_AMOY_WSS_URL'])
        .catch(() => null)) ||
      process.env.POLYGON_AMOY_WSS_URL ||
      '';
    const registryAddress =
      (await this.integrations
        .resolveSecret(
          'kyc_registry',
          ['contract_address', 'registry_address', 'address'],
          ['KYC_REGISTRY_ADDRESS']
        )
        .catch(() => null)) ||
      process.env.KYC_REGISTRY_ADDRESS ||
      '';
    let verifierKey =
      (await this.integrations
        .resolveSecret(
          'kyc_registry',
          ['verifier_private_key', 'private_key'],
          ['KYC_VERIFIER_PRIVATE_KEY']
        )
        .catch(() => null)) ||
      process.env.KYC_VERIFIER_PRIVATE_KEY ||
      '';
    if (verifierKey && !verifierKey.startsWith('0x')) verifierKey = `0x${verifierKey}`;
    const hmacSecret =
      (await this.integrations
        .resolveSecret('kyc_registry', ['subject_hmac_secret'], ['KYC_SUBJECT_HMAC_SECRET'])
        .catch(() => null)) ||
      process.env.KYC_SUBJECT_HMAC_SECRET ||
      process.env.JWT_SECRET ||
      'movr-kyc-subject-dev';
    return {
      rpcUrl,
      wssUrl,
      chain: isMainnet ? 'polygon' : 'polygon-amoy',
      chainId: isMainnet ? POS_CHAIN_ID : AMOY_CHAIN_ID,
      registryAddress: registryAddress.trim(),
      verifierKey: verifierKey.trim(),
      hmacSecret,
    };
  }

  async connect(force = false): Promise<ChainConfig | null> {
    if (this.cfg && !force) return this.cfg;
    if (this.connecting && !force) return this.connecting;
    this.connecting = (async () => {
      const cfg = await this.loadConfig();
      this.cfg = cfg;
      this.provider = null;
      this.wallet = null;
      this.writer = null;
      this.reader = null;
      if (!cfg.rpcUrl) return cfg;
      try {
        this.provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId, { staticNetwork: true });
        if (cfg.registryAddress && ethers.isAddress(cfg.registryAddress)) {
          this.reader = new ethers.Contract(cfg.registryAddress, ABI, this.provider);
          if (cfg.verifierKey) {
            this.wallet = new ethers.Wallet(cfg.verifierKey, this.provider);
            this.writer = this.reader.connect(this.wallet) as ethers.Contract;
          }
        } else if (!this.warnedMissingRegistry) {
          this.warnedMissingRegistry = true;
          this.logger.warn(
            'KYCRegistry address not set — Polygon RPC is live but writes/reads against the contract are skipped until KYC_REGISTRY_ADDRESS (or Integrations Hub kyc_registry) is saved'
          );
        }
      } catch (e: any) {
        this.logger.warn(`KYC chain connect failed: ${e.message}`);
      }
      return cfg;
    })();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  computeSubjectId(userId: string, secret?: string): string {
    const hmac = secret || this.cfg?.hmacSecret || process.env.KYC_SUBJECT_HMAC_SECRET || process.env.JWT_SECRET || 'movr-kyc-subject-dev';
    const digest = crypto.createHmac('sha256', hmac).update(userId).digest('hex');
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
      kycRecord.approvalTimestamp ? new Date(kycRecord.approvalTimestamp).toISOString() : '',
      kycRecord.verifierAdminId || '',
      kycRecord.identityLinked ? 'identity_linked' : 'documents_only',
      kycRecord.trustTier || '',
    ].join('|');
    return `0x${crypto.createHash('sha256').update(payload).digest('hex')}`;
  }

  explorerTxUrl(txHash: string | null): string | null {
    if (!txHash || txHash.startsWith('offline-')) return null;
    const chain = this.cfg?.chain || process.env.KYC_CHAIN || 'polygon-amoy';
    const base = chain === 'polygon' ? 'https://polygonscan.com/tx/' : 'https://amoy.polygonscan.com/tx/';
    return `${base}${txHash}`;
  }

  explorerAddressUrl(address?: string | null): string | null {
    if (!address) return null;
    const chain = this.cfg?.chain || process.env.KYC_CHAIN || 'polygon-amoy';
    const base =
      chain === 'polygon' ? 'https://polygonscan.com/address/' : 'https://amoy.polygonscan.com/address/';
    return `${base}${address}`;
  }

  async chainStatus() {
    const cfg = await this.connect(true);
    let blockNumber: number | null = null;
    let chainError: string | null = null;
    if (this.provider) {
      try {
        blockNumber = await this.provider.getBlockNumber();
      } catch (e: any) {
        chainError = e.message;
      }
    }
    const cursor = await this.db
      .query(`SELECT last_block, last_event_at, last_error FROM kyc_chain_cursor WHERE id = 1`)
      .catch(() => ({ rows: [] as any[] }));
    return {
      live: Boolean(this.reader && blockNumber != null),
      writable: Boolean(this.writer),
      rpcUrl: cfg?.rpcUrl || AMOY_RPC,
      chain: cfg?.chain || 'polygon-amoy',
      chainId: cfg?.chainId || AMOY_CHAIN_ID,
      registryAddress: cfg?.registryAddress || '',
      registryExplorer: this.explorerAddressUrl(cfg?.registryAddress),
      verifierAddress: this.wallet?.address || '',
      blockNumber,
      lastIndexedBlock: cursor.rows[0] ? Number(cursor.rows[0].last_block) : 0,
      lastEventAt: cursor.rows[0]?.last_event_at || null,
      lastError: chainError || cursor.rows[0]?.last_error || null,
      provider: 'polygon-public-rpc',
    };
  }

  async readOnChain(subjectId: string) {
    await this.connect();
    if (!this.reader) return null;
    try {
      const [status, recordHash, verifiedAt, verifier] = await this.reader.getAttestation(subjectId);
      const statusNum = Number(status);
      const hash = String(recordHash || '');
      const empty =
        statusNum === 0 &&
        (!hash || hash === ethers.ZeroHash) &&
        Number(verifiedAt) === 0 &&
        (!verifier || verifier === ethers.ZeroAddress);
      if (empty) return { empty: true, status: 0, recordHash: hash, verifiedAt: 0, verifier };
      return {
        empty: false,
        status: statusNum,
        statusLabel: ENUM_TO_STATUS[statusNum] || 'Pending',
        recordHash: hash,
        verifiedAt: Number(verifiedAt),
        verifier,
      };
    } catch (e: any) {
      this.logger.warn('On-chain read failed', { error: e.message });
      return null;
    }
  }

  async publishAttestation(
    userId: string,
    status: KycStatus,
    kycRecord: {
      documentType?: string;
      verificationMethod?: string;
      approvalTimestamp?: string | Date;
      verifierAdminId?: string;
      identityLinked?: boolean;
      trustTier?: string;
    }
  ) {
    await this.connect(true);
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
    let confirmationBlock: number | null = null;
    let verifierAddress: string | null = this.wallet?.address || null;
    let chainError: string | null = null;

    if (this.writer) {
      try {
        const tx =
          status === 'Revoked'
            ? await this.writer.revoke(subjectId)
            : await this.writer.attest(subjectId, recordHash, STATUS_TO_ENUM[status]);
        const receipt = await tx.wait(1);
        txHash = receipt?.hash || tx.hash;
        confirmationBlock = receipt?.blockNumber != null ? Number(receipt.blockNumber) : null;
      } catch (error: any) {
        chainError = error.message;
        this.logger.error('On-chain attest failed', { error: error.message, userId });
      }
    } else {
      chainError = this.reader
        ? 'Verifier private key missing — RPC is live, but KYCRegistry writes need kyc_registry.verifier_private_key'
        : 'KYCRegistry is not configured (set contract address + verifier key in Integrations Hub)';
    }

    const verifiedAt = status === 'Verified' ? new Date() : null;
    const revokedAt = status === 'Revoked' ? new Date() : null;

    const result = await this.db.query(
      `INSERT INTO kyc_attestations
         (user_id, subject_id, record_hash, status, tx_hash, chain, verified_at, revoked_at, confirmation_block, verifier_address)
       VALUES ($1,$2,$3,$4::kyc_attestation_status,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id) DO UPDATE SET
         subject_id = EXCLUDED.subject_id,
         record_hash = EXCLUDED.record_hash,
         status = EXCLUDED.status,
         tx_hash = COALESCE(EXCLUDED.tx_hash, kyc_attestations.tx_hash),
         chain = EXCLUDED.chain,
         verified_at = EXCLUDED.verified_at,
         revoked_at = COALESCE(EXCLUDED.revoked_at, kyc_attestations.revoked_at),
         confirmation_block = COALESCE(EXCLUDED.confirmation_block, kyc_attestations.confirmation_block),
         verifier_address = COALESCE(EXCLUDED.verifier_address, kyc_attestations.verifier_address),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        subjectId,
        recordHash,
        status,
        txHash,
        this.cfg?.chain || 'polygon-amoy',
        verifiedAt,
        revokedAt,
        confirmationBlock,
        verifierAddress,
      ]
    );

    const row = result.rows[0];
    const payload = {
      ...row,
      publishedOnChain: Boolean(txHash),
      chainError,
      explorerUrl: this.explorerTxUrl(txHash || row.tx_hash),
    };
    emitKyc(userId, {
      status,
      txHash: txHash || row.tx_hash,
      explorerUrl: payload.explorerUrl,
      publishedOnChain: payload.publishedOnChain,
    });
    return payload;
  }

  async applyChainEvent(opts: {
    subjectId: string;
    statusNum: number;
    recordHash?: string;
    txHash?: string;
    blockNumber?: number;
    verifier?: string;
  }) {
    const status = ENUM_TO_STATUS[opts.statusNum] || 'Pending';
    const updated = await this.db.query(
      `UPDATE kyc_attestations SET
         status = $2::kyc_attestation_status,
         record_hash = COALESCE(NULLIF($3, ''), record_hash),
         tx_hash = COALESCE($4, tx_hash),
         confirmation_block = COALESCE($5, confirmation_block),
         verifier_address = COALESCE($6, verifier_address),
         verified_at = CASE WHEN $2 = 'Verified' THEN COALESCE(verified_at, NOW()) ELSE verified_at END,
         revoked_at = CASE WHEN $2 = 'Revoked' THEN NOW() ELSE revoked_at END,
         updated_at = NOW()
       WHERE lower(subject_id) = lower($1)
       RETURNING *`,
      [
        opts.subjectId,
        status,
        opts.recordHash || '',
        opts.txHash || null,
        opts.blockNumber || null,
        opts.verifier || null,
      ]
    );
    const row = updated.rows[0];
    if (row?.user_id) {
      emitKyc(row.user_id, {
        status: row.status,
        txHash: row.tx_hash,
        explorerUrl: this.explorerTxUrl(row.tx_hash),
        publishedOnChain: true,
        source: 'chain_event',
      });
    }
    return row || null;
  }

  async getByUserId(userId: string) {
    await this.connect();
    const local = await this.db.query(`SELECT * FROM kyc_attestations WHERE user_id = $1`, [userId]);
    const row = local.rows[0];
    const subjectId = row?.subject_id || this.computeSubjectId(userId);
    const onchain = await this.readOnChain(subjectId);
    let matches = true;
    if (row && onchain && !onchain.empty) {
      matches =
        String(onchain.recordHash || '').toLowerCase() === String(row.record_hash || '').toLowerCase() &&
        Number(onchain.status) === STATUS_TO_ENUM[row.status];
    } else if (row && this.reader) {
      matches = false;
    }
    return {
      local: row || null,
      onchain,
      matches,
      subjectId,
      live: Boolean(this.reader),
      explorerUrl: this.explorerTxUrl(row?.tx_hash || null),
      registryExplorer: this.explorerAddressUrl(this.cfg?.registryAddress),
    };
  }

  async getPublicProof(subjectId: string) {
    await this.connect();
    const result = await this.db.query(
      `SELECT subject_id, status, tx_hash, chain, verified_at, confirmation_block, verifier_address
       FROM kyc_attestations WHERE lower(subject_id) = lower($1)`,
      [subjectId]
    );
    const row = result.rows[0] || null;
    const onchain = await this.readOnChain(subjectId);
    const liveStatus = onchain && !onchain.empty ? onchain.statusLabel : row?.status || null;
    return {
      subjectId,
      attestationStatus: liveStatus,
      txHash: row?.tx_hash || null,
      chain: row?.chain || this.cfg?.chain || 'polygon-amoy',
      verifiedAt: row?.verified_at || (onchain && onchain.verifiedAt ? new Date(onchain.verifiedAt * 1000) : null),
      confirmationBlock: row?.confirmation_block || null,
      verifier: onchain?.verifier || row?.verifier_address || null,
      onchain,
      live: Boolean(this.reader),
      explorerUrl: this.explorerTxUrl(row?.tx_hash || null),
    };
  }

  async getPublicBySubjectId(subjectId: string) {
    const proof = await this.getPublicProof(subjectId);
    if (!proof.attestationStatus && (!proof.onchain || proof.onchain.empty)) return null;
    return proof;
  }

  getReader() {
    return this.reader;
  }

  getProvider() {
    return this.provider;
  }

  getRegistryAddress() {
    return this.cfg?.registryAddress || '';
  }

  /** Drop cached RPC/contract so Hub credential saves take effect without restart. */
  resetConnection() {
    this.cfg = null;
    this.provider = null;
    this.wallet = null;
    this.writer = null;
    this.reader = null;
    this.connecting = null;
    this.warnedMissingRegistry = false;
  }
}

let singleton: KycAttestationService | null = null;
export function getKycAttestationService(db?: DatabaseService) {
  if (!singleton) singleton = new KycAttestationService(db);
  return singleton;
}
