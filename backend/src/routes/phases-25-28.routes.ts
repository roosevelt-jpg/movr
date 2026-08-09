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
import { KycAttestationService } from '../services/kyc-attestation.service';

const db = new DatabaseService();
const pricing = new PricingEngineService(db);
const nationalId = new NationalIdVerificationService(db);
const transfers = new WalletTransferService(db);
const recordings = new TripRecordingService(db);
const kycAttestation = new KycAttestationService(db);

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

/** Live multipliers per zone center — powers Active pricing zones table. */
adminPricingRouter.get('/zones/live', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const zones = await pricing.listZones();
    const rows = await Promise.all(
      zones.map(async (z: any) => {
        const b = await pricing.currentBreakdown(Number(z.center_lat), Number(z.center_lng));
        return {
          id: z.id,
          name: z.name,
          region: z.country_code === 'GH' ? 'Accra' : z.country_code,
          centerLat: z.center_lat,
          centerLng: z.center_lng,
          radiusKm: z.radius_km,
          demandMultiplier: b.demandMultiplier,
          timeMultiplier: b.timeMultiplier,
          dayMultiplier: b.dayMultiplier,
          weatherMultiplier: b.weatherMultiplier,
          trafficMultiplier: b.trafficMultiplier,
          eventMultiplier: b.eventMultiplier,
          combinedMultiplier: b.finalMultiplier,
          riderMultiplier: b.riderMultiplier ?? b.finalMultiplier,
          driverMultiplier: b.driverMultiplier ?? b.finalMultiplier,
          maxSurgeCap: z.max_surge_cap,
          minRiderMult: z.min_rider_mult,
          driverIncentiveFlat: z.driver_incentive_flat,
          driverIncentiveMult: z.driver_incentive_mult,
          destinationBonusFlat: z.destination_bonus_flat,
          maxCap: Number(z.max_surge_cap || b.cappedAt || 2),
          isActive: z.is_active,
          reasonSummary: b.reasonSummary,
          riderReason: b.riderReason,
          driverReason: b.driverReason,
        };
      })
    );
    res.json({ status: 'success', data: rows });
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
      minRiderMult: req.body.minRiderMult != null ? Number(req.body.minRiderMult) : undefined,
      driverIncentiveFlat:
        req.body.driverIncentiveFlat != null ? Number(req.body.driverIncentiveFlat) : undefined,
      driverIncentiveMult:
        req.body.driverIncentiveMult != null ? Number(req.body.driverIncentiveMult) : undefined,
      destinationBonusFlat:
        req.body.destinationBonusFlat != null ? Number(req.body.destinationBonusFlat) : undefined,
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
        minRiderMult: req.body.minRiderMult != null ? Number(req.body.minRiderMult) : undefined,
        driverIncentiveFlat:
          req.body.driverIncentiveFlat != null ? Number(req.body.driverIncentiveFlat) : undefined,
        driverIncentiveMult:
          req.body.driverIncentiveMult != null ? Number(req.body.driverIncentiveMult) : undefined,
        destinationBonusFlat:
          req.body.destinationBonusFlat != null
            ? Number(req.body.destinationBonusFlat)
            : undefined,
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

adminPricingRouter.get('/fare-modes', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    res.json({ status: 'success', data: await pricing.listFareModes() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminPricingRouter.patch(
  '/zones/:id/incentives',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const before = (await pricing.listZones()).find((z: any) => z.id === req.params.id);
      const row = await pricing.updateZone(req.params.id, {
        minRiderMult: req.body.minRiderMult != null ? Number(req.body.minRiderMult) : undefined,
        driverIncentiveFlat:
          req.body.driverIncentiveFlat != null ? Number(req.body.driverIncentiveFlat) : undefined,
        driverIncentiveMult:
          req.body.driverIncentiveMult != null ? Number(req.body.driverIncentiveMult) : undefined,
        destinationBonusFlat:
          req.body.destinationBonusFlat != null
            ? Number(req.body.destinationBonusFlat)
            : undefined,
      });
      await auditPricing(
        req.user!.id,
        'update_zone_incentives',
        'pricing_zone',
        req.params.id,
        before,
        row,
        req.body.reason || 'dual pricing incentives'
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
identityLinkRouter.get(
  '/my-documents',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const rows = await db.query(
        `SELECT document_type AS key, label, status, rejection_reason, file_url
         FROM driver_kyc_documents
         WHERE driver_user_id = $1
         ORDER BY
           CASE document_type
             WHEN 'ghana_card' THEN 1
             WHEN 'driving_license' THEN 2
             WHEN 'vehicle_registration' THEN 3
             ELSE 9
           END`,
        [req.user!.id]
      );
      if (rows.rows.length) {
        return res.json({
          status: 'success',
          data: rows.rows.map((d: any) => ({
            key: d.key,
            document_type: d.key,
            label: d.label,
            status: d.status,
            rejection_reason: d.rejection_reason,
            reason: d.rejection_reason,
            file_url: d.file_url,
          })),
        });
      }
      // Fallback summary when no rows yet
      res.json({
        status: 'success',
        data: [
          { key: 'ghana_card', label: 'Ghana Card', status: 'verified' },
          { key: 'driving_license', label: 'Driving license', status: 'in_review' },
          {
            key: 'vehicle_registration',
            label: 'Vehicle registration',
            status: 'rejected',
            rejection_reason:
              'Vehicle registration photo was blurry. Please re-upload a clear photo.',
          },
        ],
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.post(
  '/my-documents/:type/reupload',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const type = String(req.params.type || 'vehicle_registration');
      const fileUrl = req.body.fileUrl || null;
      const row = await db.query(
        `INSERT INTO driver_kyc_documents (driver_user_id, document_type, label, status, rejection_reason, file_url)
         VALUES ($1, $2, $3, 'in_review', NULL, $4)
         ON CONFLICT (driver_user_id, document_type) DO UPDATE
         SET status = 'in_review',
             rejection_reason = NULL,
             file_url = COALESCE(EXCLUDED.file_url, driver_kyc_documents.file_url),
             updated_at = NOW()
         RETURNING *`,
        [
          req.user!.id,
          type,
          type === 'ghana_card'
            ? 'Ghana Card'
            : type === 'driving_license'
              ? 'Driving license'
              : 'Vehicle registration',
          fileUrl,
        ]
      );
      res.json({ status: 'success', data: row.rows[0] });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.get(
  '/id-fields/:countryCode',
  async (req: any, res: Response) => {
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
      if (result.matched && req.user?.id) {
        try {
          const { MatchingEngineService } = require('../services/matching-engine.service');
          const { RideBookingService } = require('../services/ride-booking.service');
          const { AfricaMobilityRailsService } = require('../services/africa-mobility-rails.service');
          const matching = new MatchingEngineService(db);
          const booking = new RideBookingService(db, matching);
          const rails = new AfricaMobilityRailsService(db, matching, booking);
          await rails.recomputeTrustScore(req.user.id);
        } catch {
          /* */
        }
      }
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
           vehicle_registration_number, linked_phone_number, details,
           front_image_url
         ) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9::jsonb,$10)
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
          JSON.stringify({
            documents_meta: docs.map((d: any) => ({
              type: d.type,
              status: d.status,
              fileUrl: d.fileUrl || null,
            })),
            ocrConfirmed: Boolean(req.body.ocrConfirmed),
          }),
          national?.fileUrl || docs[0]?.fileUrl || null,
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

/** KYC Step 3 — identity verification mockup */
identityLinkRouter.get(
  '/me/step3',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.id;
      let row = await db
        .query(`SELECT * FROM driver_identity_verification WHERE user_id = $1`, [uid])
        .catch(() => ({ rows: [] as any[] }));
      if (!row.rows[0]) {
        await db
          .query(
            `INSERT INTO driver_identity_verification (user_id, step, id_type, status)
             VALUES ($1, 3, 'national_id', 'in_progress')
             ON CONFLICT (user_id) DO NOTHING`,
            [uid]
          )
          .catch(() => undefined);
        row = await db
          .query(`SELECT * FROM driver_identity_verification WHERE user_id = $1`, [uid])
          .catch(() => ({ rows: [] as any[] }));
      }
      const v = row.rows[0] || {};
      res.json({
        status: 'success',
        data: {
          step: 3,
          totalSteps: 3,
          title: 'Verify your identity',
          subtitle: 'Required for driver accounts. Takes under 2 minutes.',
          idType: v.id_type || 'national_id',
          idFrontUrl: v.id_front_url || null,
          idBackUrl: v.id_back_url || null,
          selfieStatus: v.selfie_status || 'pending',
          selfieUrl: v.selfie_url || null,
          status: v.status || 'in_progress',
          idTypes: [
            {
              id: 'national_id',
              label: 'National ID Card',
              subtitle: 'NIN slip or card accepted',
              icon: 'id',
            },
            {
              id: 'drivers_license',
              label: "Driver's License",
              subtitle: 'Valid license required for drivers',
              icon: 'car',
            },
            {
              id: 'passport',
              label: 'International Passport',
              subtitle: 'Bio data page required',
              icon: 'passport',
            },
          ],
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.patch(
  '/me/step3',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.id;
      const b = req.body || {};
      const result = await db.query(
        `INSERT INTO driver_identity_verification (
           user_id, step, id_type, id_front_url, id_back_url, selfie_url, selfie_status, status, updated_at
         ) VALUES (
           $1, 3,
           COALESCE($2, 'national_id'),
           $3, $4, $5,
           COALESCE($6, 'pending'),
           COALESCE($7, 'in_progress'),
           NOW()
         )
         ON CONFLICT (user_id) DO UPDATE SET
           id_type = COALESCE($2, driver_identity_verification.id_type),
           id_front_url = COALESCE($3, driver_identity_verification.id_front_url),
           id_back_url = COALESCE($4, driver_identity_verification.id_back_url),
           selfie_url = COALESCE($5, driver_identity_verification.selfie_url),
           selfie_status = COALESCE($6, driver_identity_verification.selfie_status),
           status = COALESCE($7, driver_identity_verification.status),
           updated_at = NOW()
         RETURNING *`,
        [
          uid,
          b.idType || null,
          b.idFrontUrl || null,
          b.idBackUrl || null,
          b.selfieUrl || null,
          b.selfieStatus || null,
          b.status || null,
        ]
      );
      res.json({ status: 'success', data: result.rows[0] });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

identityLinkRouter.post(
  '/me/step3/submit',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE driver_identity_verification
         SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [req.user!.id]
      );
      if (!result.rows[0]) {
        await db.query(
          `INSERT INTO driver_identity_verification (user_id, step, status, submitted_at)
           VALUES ($1, 3, 'submitted', NOW())`,
          [req.user!.id]
        );
      }
      res.json({
        status: 'success',
        data: { submitted: true, message: 'Identity verification submitted for review' },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** Driver self-serve: current document upload status for onboarding UI. */
identityLinkRouter.get(
  '/me/status',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const driver = (
        await db.query(`SELECT id FROM drivers WHERE user_id = $1 LIMIT 1`, [req.user!.id])
      ).rows[0];
      const latest = driver
        ? (
            await db.query(
              `SELECT * FROM identity_verifications WHERE driver_id = $1
               ORDER BY created_at DESC LIMIT 1`,
              [driver.id]
            )
          ).rows[0]
        : null;

      const badge = (uploaded: boolean) => (uploaded ? 'uploaded' : 'required');
      const meta: any[] = Array.isArray(latest?.details?.documents_meta)
        ? latest.details.documents_meta
        : [];
      const metaStatus = (type: string, fallback: boolean) => {
        const m = meta.find((d: any) => d.type === type);
        if (m?.fileUrl || m?.status === 'uploaded' || m?.status === 'confirmed') {
          return { status: 'uploaded' as const, fileUrl: m?.fileUrl || null };
        }
        return { status: badge(fallback) as 'uploaded' | 'required', fileUrl: null };
      };
      const gh = metaStatus('ghana_card', Boolean(latest?.national_id_number));
      const lic = metaStatus(
        'driving_license',
        Boolean(latest?.driving_license_number)
      );
      const veh = metaStatus(
        'vehicle_registration',
        Boolean(latest?.vehicle_registration_number)
      );
      const documents = [
        { type: 'ghana_card', label: 'Ghana Card', ...gh },
        { type: 'driving_license', label: 'Driving license', ...lic },
        { type: 'vehicle_registration', label: 'Vehicle registration', ...veh },
      ];

      res.json({
        status: 'success',
        data: {
          countryOfId: latest?.national_id_country || 'GH',
          countryLabel: 'Ghana',
          verificationStatus: latest?.status || 'not_started',
          documents,
          canSubmit: documents.every((d) => d.status === 'uploaded'),
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
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
      const userId = String(req.params.userId || '').trim();
      if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid user id' });
      }

      const checks = await db.query(
        `SELECT * FROM identity_link_checks WHERE user_id = $1::uuid ORDER BY checked_at DESC`,
        [userId]
      );
      const docs = await db.query(
        `SELECT iv.* FROM identity_verifications iv
         LEFT JOIN drivers d ON d.id = iv.driver_id
         WHERE d.user_id = $1::uuid OR iv.driver_id = $1::uuid
         ORDER BY iv.created_at DESC`,
        [userId]
      );
      const user = await db.query(
        `SELECT id, first_name, last_name, email, phone, avatar_url, user_type, created_at
         FROM users WHERE id = $1::uuid`,
        [userId]
      );
      const merchant = await db.query(
        `SELECT id, business_name, kyc_status, status, identity_linked, category, country, created_at
         FROM merchants WHERE user_id = $1::uuid LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as any[] }));
      const driver = await db.query(
        `SELECT id, kyc_status FROM drivers WHERE user_id = $1::uuid LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as any[] }));
      const merchantDocs = merchant.rows[0]
        ? await db
            .query(
              `SELECT id, document_type, label, document_number, file_url, status, created_at
               FROM merchant_kyc_documents WHERE merchant_id = $1 ORDER BY created_at DESC`,
              [merchant.rows[0].id]
            )
            .catch(() => ({ rows: [] as any[] }))
        : { rows: [] as any[] };
      const driverKycDocs = await db
        .query(
          `SELECT document_type AS key, label, status, rejection_reason, file_url
           FROM driver_kyc_documents WHERE driver_user_id = $1`,
          [userId]
        )
        .catch(() => ({ rows: [] as any[] }));
      const attestation = await db
        .query(`SELECT * FROM kyc_attestations WHERE user_id = $1::uuid`, [userId])
        .catch(() => ({ rows: [] as any[] }));

      const u = user.rows[0];
      const m = merchant.rows[0];
      const d = driver.rows[0];
      const latest = docs.rows[0] || {};
      const isMerchant = Boolean(m);
      const checkStatus = (type: string) => {
        const row = checks.rows.find((c: any) => c.check_type === type);
        return String(row?.status || 'pending').toLowerCase();
      };
      const normalizeDocStatus = (raw?: string, hasFile?: boolean) => {
        const s = String(raw || '').toLowerCase();
        if (/verif|approv|match/.test(s)) return 'verified';
        if (/reject|fail|mismatch/.test(s)) return 'rejected';
        if (/review|upload|pending|submitted|in_review/.test(s)) return 'pending';
        if (hasFile) return 'pending';
        return 'pending';
      };
      const docStatus = (hasValue: boolean, linkedCheck?: string) => {
        if (linkedCheck === 'match' || latest.status === 'verified' || latest.identity_linked) {
          return hasValue ? 'verified' : 'pending';
        }
        if (hasValue && (latest.status === 'verified' || latest.status === 'approved')) return 'verified';
        if (hasValue) return 'pending';
        return 'pending';
      };
      const idLic = checkStatus('id_to_license');
      const idVeh = checkStatus('id_to_vehicle');
      const idPhone = checkStatus('id_to_phone');

      const created = m?.created_at || u?.created_at ? new Date(m?.created_at || u.created_at) : null;
      let appliedAgo = '';
      if (created) {
        const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
        appliedAgo =
          days === 0 ? 'Applied today' : days === 1 ? 'Applied 1 day ago' : `Applied ${days} days ago`;
      }

      const merchantDocLabel = (type: string, fallback: string) => {
        const map: Record<string, string> = {
          ghana_card: 'Ghana Card',
          national_id: 'National ID',
          owner_id: 'Owner ID',
          business_reg: 'Business registration',
          cac: 'CAC Registration',
          tax_id: 'Tax ID / TIN',
          tin: 'Tax ID / TIN',
          driving_license: 'Driving license',
          vehicle_registration: 'Vehicle registration',
        };
        return map[type] || fallback;
      };

      let documentsSummary: any[];
      if (isMerchant && merchantDocs.rows.length) {
        documentsSummary = merchantDocs.rows.slice(0, 6).map((doc: any) => ({
          type: doc.document_type,
          label: doc.label || merchantDocLabel(doc.document_type, doc.document_type),
          status: normalizeDocStatus(doc.status, Boolean(doc.file_url)),
          fileUrl: doc.file_url || null,
          documentNumber: doc.document_number || null,
        }));
      } else if (driverKycDocs.rows.length) {
        documentsSummary = driverKycDocs.rows.map((doc: any) => ({
          type: doc.key,
          label: doc.label || merchantDocLabel(doc.key, doc.key),
          status: normalizeDocStatus(doc.status, Boolean(doc.file_url)),
          fileUrl: doc.file_url || null,
        }));
      } else if (isMerchant) {
        documentsSummary = [
          { type: 'ghana_card', label: 'Ghana Card', status: 'pending' },
          { type: 'business_reg', label: 'Business registration', status: 'pending' },
          { type: 'tax_id', label: 'Tax ID / TIN', status: 'pending' },
        ];
      } else {
        documentsSummary = [
          {
            type: 'ghana_card',
            label: 'Ghana Card',
            status: docStatus(Boolean(latest.national_id_number), idLic),
          },
          {
            type: 'driving_license',
            label: 'Driving license',
            status: docStatus(Boolean(latest.driving_license_number), idLic),
          },
          {
            type: 'vehicle_registration',
            label: 'Vehicle registration',
            status: docStatus(Boolean(latest.vehicle_registration_number), idVeh),
          },
        ];
      }

      const linkStatus = isMerchant
        ? [
            { label: 'Owner ID ↔ Business registration', type: 'id_to_license', status: idLic },
            { label: 'Owner ID ↔ Tax / credentials', type: 'id_to_vehicle', status: idVeh },
            { label: 'Owner ID ↔ Phone number', type: 'id_to_phone', status: idPhone },
          ]
        : [
            { label: 'National ID ↔ Driving license', type: 'id_to_license', status: idLic },
            { label: 'National ID ↔ Vehicle license', type: 'id_to_vehicle', status: idVeh },
            { label: 'National ID ↔ Phone number', type: 'id_to_phone', status: idPhone },
          ];

      const att = attestation.rows[0];
      const identityLinked =
        Boolean(m?.identity_linked) ||
        docs.rows.some((row: any) => row.identity_linked) ||
        [idLic, idVeh].every((s) => s === 'match');

      const displayName = isMerchant
        ? m.business_name || `${u?.first_name || ''} ${u?.last_name || ''}`.trim()
        : `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.email || u?.phone || u?.id;

      res.json({
        status: 'success',
        data: {
          checks: checks.rows,
          documents: docs.rows,
          merchantDocuments: merchantDocs.rows,
          documentsSummary,
          identityLinked,
          kycStatus: m?.kyc_status || d?.kyc_status || null,
          attestation: att
            ? {
                status: att.status,
                txHash: att.tx_hash,
                chain: att.chain,
                verifiedAt: att.verified_at,
                explorerUrl: kycAttestation.explorerTxUrl(att.tx_hash),
              }
            : null,
          linkStatus,
          profile: u
            ? {
                id: u.id,
                name: displayName || u.id,
                role: isMerchant ? 'Merchant' : d ? 'Driver' : u.user_type === 'driver' ? 'Driver' : 'Rider',
                avatarUrl: u.avatar_url || null,
                appliedAgo,
                createdAt: m?.created_at || u.created_at,
                merchantId: m?.id || null,
                driverId: d?.id || null,
                businessName: m?.business_name || null,
                category: m?.category || null,
              }
            : null,
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
        req.body.checkType || 'all',
        req.body.status || 'match'
      );
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** Approve identity + publish KYC attestation (driver or merchant). */
identityLinkRouter.post(
  '/:userId/approve',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = String(req.params.userId || '').trim();
      if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid user id' });
      }

      let linkResult: any = null;
      try {
        linkResult = await identityVerification.linkIdentityDocuments(userId);
      } catch {
        /* continue with manual approve */
      }

      // Force-match remaining checks when admin explicitly approves
      await identityVerification.manualOverrideLink(
        userId,
        req.user!.id,
        req.body.reason || 'Approved & attested on-chain',
        'all',
        'match'
      );

      const subject = await identityVerification.approveSubject(userId, req.user!.id, {
        reason: req.body.reason || 'Approved & attested on-chain',
      });

      const attestation = await kycAttestation.publishAttestation(userId, 'Verified', {
        documentType:
          subject.role === 'merchant' ? 'merchant_identity_review' : 'identity_review',
        verificationMethod: linkResult?.identityLinked
          ? 'full_identity_link_verified'
          : 'manual_admin_approve',
        approvalTimestamp: new Date(),
        verifierAdminId: req.user!.id,
        identityLinked: true,
        trustTier: 'full_identity_link_verified',
      });

      res.json({
        status: 'success',
        data: {
          ...subject,
          link: linkResult,
          attestation: {
            ...attestation,
            explorerUrl: kycAttestation.explorerTxUrl(attestation.tx_hash),
          },
        },
      });
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
        `SELECT t.claim_code,
                COALESCE(t.received_amount, t.sent_amount) AS amount,
                COALESCE(t.received_currency, t.sent_currency, 'NGN') AS currency,
                t.status,
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
        amount: Number(row.amount),
        currency: row.currency || 'NGN',
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

/** Local/dev fallback when S3 is unset — PUT raw video bytes. */
tripRecordingRouter.put(
  '/rides/:id/recording/upload-body',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      const buffer = Buffer.concat(chunks);
      if (!buffer.length) {
        return res.status(400).json({ status: 'error', message: 'empty body' });
      }
      const data = await recordings.saveLocalUploadBody(req.params.id, buffer);
      res.json({ status: 'success', data });
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
