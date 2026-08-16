import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { getKycAttestationService } from '../services/kyc-attestation.service';

const db = new DatabaseService();
const kyc = getKycAttestationService(db);

export const kycRouter = Router();

/** Live Polygon RPC + KYCRegistry connection (admin). */
kycRouter.get('/chain/status', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await kyc.chainStatus() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Public, non-PII proof — reads KYCRegistry on Polygon in realtime. */
kycRouter.get('/attestation/verify/:subjectId', async (req: any, res: Response) => {
  try {
    const proof = await kyc.getPublicBySubjectId(req.params.subjectId);
    if (!proof) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    res.json({ status: 'success', data: proof });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Authenticated rider/driver/merchant — live chain + local attestation. */
kycRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await kyc.getByUserId(req.user!.id);
    res.json({
      status: 'success',
      data: {
        ...result,
        explorerUrl: result.explorerUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Admin/internal tamper-check against the live contract. */
kycRouter.get(
  '/attestation/:userId',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await kyc.getByUserId(req.params.userId);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** Publish after human review (admin) — waits for 1 Polygon confirmation. */
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
      if (!row.publishedOnChain) {
        return res.status(503).json({
          status: 'error',
          message: row.chainError || 'On-chain publish did not confirm',
          data: row,
        });
      }
      res.json({
        status: 'success',
        data: row,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** Unauthenticated proof for explorers / deep links. */
export const publicKycRouter = Router();
publicKycRouter.get('/verify/:subjectId', async (req: any, res: Response) => {
  try {
    const proof = await kyc.getPublicBySubjectId(req.params.subjectId);
    if (!proof) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    res.json({ status: 'success', data: proof });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export { kyc };
