import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
  requireTrustAndSafety,
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
async function auditPricing(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  before: any,
  after: any,
  reason?: string
) {
  try {
    await db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, before_state, after_state)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [
        adminId,
        action,
        resourceType,
        resourceId,
        reason || action,
        JSON.stringify(before || {}),
        JSON.stringify(after || {}),
      ]
    );
  } catch {
    /* audit optional if table missing columns */
  }
}

adminPricingRouter.get('/zones', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await pricing.listZones() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.post('/zones', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const row = await pricing.createZone({
      name: req.body.name,
      countryCode: req.body.countryCode,
      centerLat: Number(req.body.centerLat),
      centerLng: Number(req.body.centerLng),
      radiusKm: req.body.radiusKm != null ? Number(req.body.radiusKm) : undefined,
      maxSurgeCap: req.body.maxSurgeCap != null ? Number(req.body.maxSurgeCap) : undefined,
    });
    await auditPricing(req.user!.id, 'create_pricing_zone', 'pricing_zone', row.id, {}, row, req.body.reason);
    res.status(201).json({ status: 'success', data: row });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.patch(
  '/zones/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const before = (await pricing.listZones()).find((z: any) => z.id === req.params.id);
      const row = await pricing.updateZone(req.params.id, {
        name: req.body.name,
        centerLat: req.body.centerLat != null ? Number(req.body.centerLat) : undefined,
        centerLng: req.body.centerLng != null ? Number(req.body.centerLng) : undefined,
        radiusKm: req.body.radiusKm != null ? Number(req.body.radiusKm) : undefined,
        maxSurgeCap: req.body.maxSurgeCap != null ? Number(req.body.maxSurgeCap) : undefined,
        isActive: req.body.isActive,
      });
      await auditPricing(
        req.user!.id,
        'update_pricing_zone',
        'pricing_zone',
        req.params.id,
        before,
        row,
        req.body.reason
      );
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminPricingRouter.patch(
  '/zones/:id/max-surge-cap',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const before = (await pricing.listZones()).find((z: any) => z.id === req.params.id);
      const row = await pricing.updateZone(req.params.id, {
        maxSurgeCap: Number(req.body.maxSurgeCap),
      });
      await auditPricing(
        req.user!.id,
        'update_max_surge_cap',
        'pricing_zone',
        req.params.id,
        before,
        row,
        req.body.reason || 'max surge cap update'
      );
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

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
      const beforeList = await pricing.listFactors();
      const before = beforeList.find((f: any) => f.id === req.params.id);
      const row =
        req.body.config != null
          ? await pricing.updateFactorConfig(
              req.params.id,
              req.body.config,
              req.body.isActive != null ? Boolean(req.body.isActive) : undefined
            )
          : await pricing.setFactorActive(req.params.id, Boolean(req.body.isActive));
      await auditPricing(
        req.user!.id,
        'update_pricing_factor',
        'pricing_factor',
        req.params.id,
        before,
        row,
        req.body.reason
      );
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminPricingRouter.get('/events', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    res.json({ status: 'success', data: await pricing.listEvents(req.query.zoneId) });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.post('/events', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const row = await pricing.upsertEvent({
      zoneId: req.body.zoneId,
      name: req.body.name,
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt,
      multiplier: Number(req.body.multiplier),
    });
    await auditPricing(req.user!.id, 'create_pricing_event', 'pricing_event', row.id, {}, row, req.body.reason);
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
      const countryCode = req.body.countryCode || 'GH';
      const pattern = nationalId.idFieldPattern(countryCode);
      const check = nationalId.validateIdNumber(countryCode, req.body.idNumber);
      if (!check.valid) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid ${pattern.label}`,
          data: { field: pattern },
        });
      }
      const result = await nationalId.verifyNationalId(
        countryCode,
        req.body.idNumber,
        req.body.fullName,
        req.body.dateOfBirth
      );
      res.json({ status: 'success', data: { ...result, field: pattern } });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** OCR preview for mobile confirm/correct step (Phase 26). */
identityLinkRouter.post(
  '/ocr-preview',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const countryCode = String(req.body.countryCode || 'GH').toUpperCase();
      const documentType = req.body.documentType || 'national_id';
      const pattern = nationalId.idFieldPattern(countryCode);
      // Prefer Textract when fileUrl/base64 provided; otherwise return editable stubs from body
      let extracted: any = {
        fullName: req.body.fullName || null,
        idNumber: req.body.idNumber || null,
        dateOfBirth: req.body.dateOfBirth || null,
        licenseNumber: req.body.licenseNumber || null,
        vehicleRegistration: req.body.vehicleRegistration || null,
      };
      if (req.body.fileUrl || req.body.imageBase64) {
        try {
          const preview = await (identityVerification as any).ocrPreviewDocument?.({
            fileUrl: req.body.fileUrl,
            imageBase64: req.body.imageBase64,
            documentType,
            countryCode,
          });
          if (preview) extracted = { ...extracted, ...preview };
        } catch {
          /* fall through to body fields */
        }
      }
      res.json({
        status: 'success',
        data: {
          documentType,
          countryCode,
          field: pattern,
          extracted,
          confirmRequired: true,
          message: 'Confirm or correct OCR fields before submission',
        },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.post(
  '/documents',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const countryCode = req.body.countryCode || 'GH';
      const userId = req.user!.id;
      const driver = (
        await db.query(`SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`, [userId])
      ).rows[0];
      if (!driver) {
        return res.status(400).json({ status: 'error', message: 'Driver profile required' });
      }
      const docs = Array.isArray(req.body.documents) ? req.body.documents : [];
      const national = docs.find((d: any) =>
        ['ghana_card', 'national_id'].includes(d.type)
      );
      const license = docs.find((d: any) => d.type === 'driving_license');
      const vehicle = docs.find((d: any) =>
        ['vehicle_registration', 'authorization_letter'].includes(d.type)
      );
      const row = await db.query(
        `INSERT INTO identity_verifications (
           driver_id, document_type, document_number, status,
           national_id_number, national_id_country, driving_license_number,
           vehicle_registration_number, linked_phone_number
         ) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          driver.id,
          national?.type || 'national_id',
          req.body.idNumber || national?.number || null,
          req.body.idNumber || national?.number || null,
          countryCode,
          req.body.licenseNumber || license?.number || null,
          req.body.vehicleRegistration || vehicle?.number || null,
          req.body.phone || null,
        ]
      );
      res.status(201).json({
        status: 'success',
        data: row.rows[0],
        pendingAutomatedVerification: true,
      });
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

walletTransferRouter.get('/transfer/limits', authenticateToken, async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await transfers.getLimits() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

walletTransferRouter.put(
  '/transfer/limits',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const before = await transfers.getLimits();
      const row = await transfers.updateLimits({
        maxPerTx: req.body.maxPerTx != null ? Number(req.body.maxPerTx) : undefined,
        maxPerDay: req.body.maxPerDay != null ? Number(req.body.maxPerDay) : undefined,
        requiresIdentityLinkedAbove:
          req.body.requiresIdentityLinkedAbove != null
            ? Number(req.body.requiresIdentityLinkedAbove)
            : undefined,
        feePercent: req.body.feePercent != null ? Number(req.body.feePercent) : undefined,
        feeFlat: req.body.feeFlat != null ? Number(req.body.feeFlat) : undefined,
      });
      try {
        await db.query(
          `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, before_state, after_state)
           VALUES ($1,'update_transfer_limits','transfer_limits','1',$2,$3::jsonb,$4::jsonb)`,
          [
            req.user!.id,
            req.body.reason || 'update transfer limits',
            JSON.stringify(before),
            JSON.stringify(row),
          ]
        );
      } catch {
        /* optional */
      }
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

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
  '/drivers/recording-consent',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.userType !== 'driver') {
        return res.status(403).json({ status: 'error', message: 'Drivers only' });
      }
      await db.query(
        `UPDATE drivers SET trip_recording_consented_at = NOW() WHERE user_id = $1`,
        [req.user!.id]
      );
      res.json({
        status: 'success',
        data: { consented: true, at: new Date().toISOString() },
      });
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
  '/admin/recordings/:rideId/meta',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await recordings.getRecordingMeta(req.params.rideId);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

tripRecordingRouter.get(
  '/admin/recordings/:rideId',
  authenticateToken,
  requireTrustAndSafety,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await recordings.getPlaybackUrl(
        req.params.rideId,
        req.user!.id,
        String(req.query.incidentRef || ''),
        req.user!.roles || []
      );
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(403).json({ status: 'error', message: error.message });
    }
  }
);
