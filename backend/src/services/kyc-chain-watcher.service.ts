import { ethers } from 'ethers';
import winston from 'winston';
import { DatabaseService } from './database.service';
import { getKycAttestationService } from './kyc-attestation.service';

const logger = winston.createLogger({
  defaultMeta: { service: 'kyc-chain-watcher' },
  transports: [new winston.transports.Console()],
});

const POLL_MS = Number(process.env.KYC_CHAIN_POLL_MS || 8000);

/**
 * Polls Polygon (Amoy / PoS) for KYCRegistry Attested/Revoked logs and
 * updates Postgres in near-realtime. Uses the public Amoy RPC by default.
 */
export function startKycChainWatcher(db: DatabaseService) {
  const kyc = getKycAttestationService(db);
  let ticking = false;

  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      await kyc.connect(true);
      const provider = kyc.getProvider();
      const reader = kyc.getReader();
      const address = kyc.getRegistryAddress();
      if (!provider || !reader || !address) return;

      const head = await provider.getBlockNumber();
      const cursor = await db.query(`SELECT last_block FROM kyc_chain_cursor WHERE id = 1`);
      let from = Number(cursor.rows[0]?.last_block || 0);
      if (!from || from < 1) from = Math.max(0, head - 24);
      else from = from + 1;
      if (from > head) {
        await db.query(
          `UPDATE kyc_chain_cursor SET last_block = $1, last_error = NULL, updated_at = NOW() WHERE id = 1`,
          [head]
        );
        return;
      }
      const to = Math.min(head, from + 2000);

      const attested = reader.filters.Attested();
      const revoked = reader.filters.Revoked();
      const [attLogs, revLogs] = await Promise.all([
        reader.queryFilter(attested, from, to),
        reader.queryFilter(revoked, from, to),
      ]);

      for (const log of attLogs) {
        const args: any = (log as ethers.EventLog).args || {};
        await kyc.applyChainEvent({
          subjectId: String(args.subjectId || ''),
          statusNum: Number(args.status || 0),
          recordHash: String(args.recordHash || ''),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          verifier: String(args.verifier || ''),
        });
      }
      for (const log of revLogs) {
        const args: any = (log as ethers.EventLog).args || {};
        await kyc.applyChainEvent({
          subjectId: String(args.subjectId || ''),
          statusNum: 3,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          verifier: String(args.verifier || ''),
        });
      }

      const saw = attLogs.length + revLogs.length;
      await db.query(
        `UPDATE kyc_chain_cursor SET
           last_block = $1,
           last_event_at = CASE WHEN $2 > 0 THEN NOW() ELSE last_event_at END,
           last_error = NULL,
           updated_at = NOW()
         WHERE id = 1`,
        [to, saw]
      );
    } catch (e: any) {
      logger.warn(`KYC chain poll failed: ${e.message}`);
      await db
        .query(`UPDATE kyc_chain_cursor SET last_error = $1, updated_at = NOW() WHERE id = 1`, [
          String(e.message).slice(0, 500),
        ])
        .catch(() => undefined);
    } finally {
      ticking = false;
    }
  };

  tick().catch(() => undefined);
  return setInterval(() => {
    tick().catch(() => undefined);
  }, POLL_MS);
}
