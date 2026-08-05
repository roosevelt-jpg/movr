import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { PricingEngineService } from '../services/pricing-engine.service';
import { NationalIdVerificationService } from '../services/ghana-card-verification.service';
import identityVerification from '../services/identity-verification.service';
import { WalletTransferService } from '../services/wallet-transfer.service';
import { TripRecordingService } from '../services/trip-recording.service';

const db = new DatabaseService();
const pricing = new PricingEngineService(db);
const nationalId = new NationalIdVerificationService(db);
const transfers = new WalletTransferService(db);
const recordings = new TripRecordingService(db);

export const adminPricingRouter = Router();
export const identityLinkRouter = Router();
export const walletTransferRouter = Router();
export const tripRecordingRouter = Router();

// --- Phase 25 admin pricing ---
adminPricingRouter.get('/zones', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await pricing.listZones() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.get('/factors', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    res.json({ status: 'success', data: await pricing.listFactors(req.query.zoneId) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.patch(
  '/factors/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const row = await pricing.setFactorActive(req.params.id, Boolean(req.body.isActive));
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminPricingRouter.post('/events', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const row = await pricing.upsertEvent({
      zoneId: req.body.zoneId,
      name: req.body.name,
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt,
      multiplier: Number(req.body.multiplier),
    });
    res.status(201).json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.get('/breakdown', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const lat = Number(req.query.lat ?? 5.6037);
    const lng = Number(req.query.lng ?? -0.187);
    res.json({ status: 'success', data: await pricing.currentBreakdown(lat, lng) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- Phase 26 identity linking ---
identityLinkRouter.get('/id-fields/:countryCode', async (req: any, res: Response) => {
  try {
    res.json({
      status: 'success',
      data: nationalId.idFieldPattern(req.params.countryCode),
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

identityLinkRouter.post(
  '/verify-national-id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await nationalId.verifyNationalId(
        req.body.countryCode || 'GH',
        req.body.idNumber,
        req.body.fullName,
        req.body.dateOfBirth
      );
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.post(
  '/link/:userId',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await identityVerification.linkIdentityDocuments(req.params.userId);
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.get(
  '/:userId',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const checks = await db.query(
        `SELECT * FROM identity_link_checks WHERE user_id = $1 ORDER BY checked_at DESC`,
        [req.params.userId]
      );
      const docs = await db.query(
        `SELECT iv.* FROM identity_verifications iv
         LEFT JOIN drivers d ON d.id = iv.driver_id
         WHERE d.user_id = $1 OR iv.driver_id::text = $1
         ORDER BY iv.created_at DESC`,
        [req.params.userId]
      );
      res.json({
        status: 'success',
        data: {
          checks: checks.rows,
          documents: docs.rows,
          identityLinked: docs.rows.some((d: any) => d.identity_linked),
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.post(
  '/:userId/override',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.body.reason) {
        return res.status(400).json({ status: 'error', message: 'reason required' });
      }
      const row = await identityVerification.manualOverrideLink(
        req.params.userId,
        req.user!.id,
        req.body.reason,
        req.body.checkType,
        req.body.status
      );
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

// --- Phase 27 wallet transfers (mounted under /wallet) ---
walletTransferRouter.get('/transfer/quote', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await transfers.quote(
      req.user!.id,
      String(req.query.to || req.query.recipient),
      Number(req.query.amount),
      String(req.query.currency || 'GHS')
    );
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

walletTransferRouter.post('/transfer', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await transfers.sendTransfer(
      req.user!.id,
      req.body.to || req.body.recipientIdentifier,
      Number(req.body.amount),
      req.body.currency || 'GHS'
    );
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

walletTransferRouter.get('/transfers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ status: 'success', data: await transfers.listTransfers(req.user!.id) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletTransferRouter.post('/transfer/claim', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = await transfers.claimTransfer(req.body.claimCode, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/** Public preview for claim-link landing (no auth). */
walletTransferRouter.get('/transfer/claim-preview/:code', async (req, res: Response) => {
  try {
    const row = (
      await db.query(
        `SELECT t.claim_code, t.received_amount, t.received_currency, t.status,
                u.first_name, u.last_name
         FROM wallet_transfers t
         LEFT JOIN users u ON u.id = t.sender_user_id
         WHERE t.claim_code = $1`,
        [req.params.code]
      )
    ).rows[0];
    if (!row) {
      return res.status(404).json({
        status: 'error',
        message: 'Claim code not found',
      });
    }
    res.json({
      status: 'success',
      data: {
        claimCode: row.claim_code,
        senderName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Movr user',
        amount: Number(row.received_amount),
        currency: row.received_currency || 'NGN',
        status: row.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- Phase 28 trip recording ---
tripRecordingRouter.post(
  '/rides/:id/recording/notice',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await recordings.logRiderNotice(req.params.id);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

tripRecordingRouter.post(
  '/rides/:id/recording/start',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      await recordings.logDriverConsent(req.params.id);
      const data = await recordings.startLocalRecording(
        req.params.id,
        req.body.driverId || req.user!.id
      );
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

tripRecordingRouter.post(
  '/rides/:id/recording/upload-url',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ status: 'success', data: await recordings.requestUploadUrl(req.params.id) });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

tripRecordingRouter.post(
  '/rides/:id/recording/complete',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await recordings.completeUpload(req.params.id, req.body.localDurationSeconds);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

tripRecordingRouter.post(
  '/admin/rides/:id/recording/flag',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.body.reason) {
        return res.status(400).json({ status: 'error', message: 'reason required' });
      }
      const data = await recordings.flagRecordingForDispute(
        req.params.id,
        req.user!.id,
        req.body.reason
      );
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

tripRecordingRouter.get(
  '/admin/recordings/:rideId',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await recordings.getPlaybackUrl(
        req.params.rideId,
        req.user!.id,
        String(req.query.incidentRef || req.body?.incidentRef || ''),
        (req.user as any)?.role || 'admin'
      );
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(403).json({ status: 'error', message: error.message });
    }
  }
);
