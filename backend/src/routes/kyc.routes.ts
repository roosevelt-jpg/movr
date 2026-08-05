import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { KycAttestationService } from '../services/kyc-attestation.service';

const db = new DatabaseService();
const kyc = new KycAttestationService(db);

export const kycRouter = Router();

/** Public, non-PII proof endpoint */
kycRouter.get('/attestation/verify/:subjectId', async (req: any, res: Response) => {
  try {
    const row = await kyc.getPublicBySubjectId(req.params.subjectId);
    if (!row) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    res.json({
      status: 'success',
      data: {
        subjectId: row.subject_id,
        attestationStatus: row.status,
        txHash: row.tx_hash,
        chain: row.chain,
        verifiedAt: row.verified_at,
        explorerUrl: kyc.explorerTxUrl(row.tx_hash),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Admin/internal tamper-check */
kycRouter.get(
  '/attestation/:userId',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await kyc.getByUserId(req.params.userId);
      if (!result) {
        return res.status(404).json({ status: 'error', message: 'No attestation' });
      }
      res.json({
        status: 'success',
        data: {
          ...result,
          explorerUrl: kyc.explorerTxUrl(result.local.tx_hash),
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** Publish after human review (admin) */
kycRouter.post(
  '/attestation/publish',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, status, documentType, verificationMethod } = req.body;
      if (!userId || !status) {
        return res.status(400).json({ status: 'error', message: 'userId and status required' });
      }
      const row = await kyc.publishAttestation(userId, status, {
        documentType,
        verificationMethod: verificationMethod || 'manual',
        approvalTimestamp: new Date(),
        verifierAdminId: req.user!.id,
        identityLinked: req.body.identityLinked,
        trustTier: req.body.identityLinked
          ? 'full_identity_link_verified'
          : req.body.trustTier,
      });
      res.json({
        status: 'success',
        data: { ...row, explorerUrl: kyc.explorerTxUrl(row.tx_hash) },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

export { kyc };
