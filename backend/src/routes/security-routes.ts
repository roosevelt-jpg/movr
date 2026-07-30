// backend/src/routes/security.routes.ts
import express, { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import videoRecordingService from '../services/video-recording.service';
import identityVerificationService from '../services/identity-verification.service';
import sosEmergencyService from '../services/sos-emergency.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router: Router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================
// DRIVER DOCUMENT UPLOAD & VERIFICATION
// ============================================

/**
 * POST /api/v1/driver/documents/upload
 * Upload driver identity documents for verification
 */
router.post(
  '/driver/documents/upload',
  authenticateToken,
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.user as any;
      const { documentType, documentNumber, issuedDate, expiryDate } = req.body;
      const files = req.files as { [key: string]: Express.Multer.File[] };

      if (!files.frontImage) {
        return res.status(400).json({ error: 'Front image required' });
      }

      // Upload front image
      const frontImageUrl = await identityVerificationService.uploadIdentityDocument(
        driverId,
        documentType,
        files.frontImage[0].buffer
      );

      // Upload back image if provided
      let backImageUrl = null;
      if (files.backImage) {
        backImageUrl = await identityVerificationService.uploadIdentityDocument(
          driverId,
          `${documentType}_back`,
          files.backImage[0].buffer
        );
      }

      // Store document record in database
      const documentId = uuidv4();
      await db.query(
        `INSERT INTO driver_documents (id, driver_id, document_type, document_number, issued_date, expiry_date, front_image_url, back_image_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [documentId, driverId, documentType, documentNumber, issuedDate, expiryDate, frontImageUrl, backImageUrl, 'pending_verification']
      );

      // Trigger real-time verification immediately
      const verificationResult = await identityVerificationService.verifyIdentityDocument(
        driverId,
        documentType,
        documentNumber,
        frontImageUrl,
        backImageUrl
      );

      // Update driver status based on verification result
      const allDocuments = await db.query(
        'SELECT * FROM identity_verifications WHERE driver_id = $1 AND verified = true',
        [driverId]
      );

      const driverStatus = allDocuments.rows.length >= 1 ? 'verified' : 'pending';

      await db.query(
        `UPDATE drivers SET status = $1, verification_score = $2, verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE verified_at END
         WHERE id = $3`,
        [driverStatus, verificationResult.confidence, driverId]
      );

      // Emit real-time notification
      io.to(`driver_${driverId}`).emit('DOCUMENT_VERIFIED', {
        documentType,
        verified: verificationResult.verified,
        confidence: verificationResult.confidence,
        message: verificationResult.verified
          ? `✅ ${documentType} verified successfully!`
          : `❌ Verification failed. Please upload clearer images.`,
      });

      return res.status(201).json({
        documentId,
        verified: verificationResult.verified,
        confidence: verificationResult.confidence,
        details: verificationResult.details,
        message: verificationResult.verified
          ? 'Document verified successfully!'
          : 'Verification pending - please resubmit clearer images',
      });
    } catch (error) {
      console.error('Document upload error:', error);
      return res.status(500).json({ error: 'Document upload failed' });
    }
  }
);

/**
 * GET /api/v1/driver/verification-status
 * Get driver's verification status and documents
 */
router.get('/driver/verification-status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.user as any;

    const driver = await db.query(
      `SELECT id, name, email, status, verification_score, verified_at FROM drivers WHERE id = $1`,
      [driverId]
    );

    const documents = await db.query(
      `SELECT document_type, status, issued_date, expiry_date, created_at FROM driver_documents WHERE driver_id = $1 ORDER BY created_at DESC`,
      [driverId]
    );

    const verifications = await db.query(
      `SELECT document_type, verified, confidence, result_date FROM identity_verifications WHERE driver_id = $1 ORDER BY result_date DESC`,
      [driverId]
    );

    return res.json({
      driver: driver.rows[0],
      documents: documents.rows,
      verifications: verifications.rows,
      allVerified: verifications.rows.every((v: any) => v.verified),
    });
  } catch (error) {
    console.error('Error getting verification status:', error);
    return res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// ============================================
// MERCHANT/BUSINESS VERIFICATION
// ============================================

/**
 * POST /api/v1/merchant/verify
 * Submit merchant and business documents for verification
 */
router.post(
  '/merchant/verify',
  authenticateToken,
  upload.fields([
    { name: 'ownerIdFront', maxCount: 1 },
    { name: 'ownerIdBack', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 },
    { name: 'registrationCertificate', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const { merchantId } = req.user as any;
      const {
        businessName,
        businessRegistrationNumber,
        businessCategory,
        businessPhone,
        businessEmail,
        businessAddress,
      } = req.body;

      const files = req.files as { [key: string]: Express.Multer.File[] };

      // Upload all business documents
      const ownerIdFront = await identityVerificationService.uploadIdentityDocument(
        merchantId,
        'owner_id_front',
        files.ownerIdFront[0].buffer
      );

      const ownerIdBack = await identityVerificationService.uploadIdentityDocument(
        merchantId,
        'owner_id_back',
        files.ownerIdBack[0].buffer
      );

      const businessLicenseUrl = await identityVerificationService.uploadIdentityDocument(
        merchantId,
        'business_license',
        files.businessLicense[0].buffer
      );

      const registrationUrl = files.registrationCertificate
        ? await identityVerificationService.uploadIdentityDocument(
            merchantId,
            'registration_certificate',
            files.registrationCertificate[0].buffer
          )
        : null;

      // Trigger merchant verification
      const verificationResult = await identityVerificationService.verifyMerchantBusiness(
        merchantId,
        businessName,
        businessRegistrationNumber,
        businessLicenseUrl,
        ownerIdFront
      );

      // Store merchant data
      const merchantId_uuid = uuidv4();
      await db.query(
        `INSERT INTO merchants (id, user_id, business_name, business_registration_number, business_category, 
         business_phone, business_email, business_address, owner_id_front_url, owner_id_back_url, 
         business_license_url, registration_certificate_url, status, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          merchantId_uuid,
          merchantId,
          businessName,
          businessRegistrationNumber,
          businessCategory,
          businessPhone,
          businessEmail,
          businessAddress,
          ownerIdFront,
          ownerIdBack,
          businessLicenseUrl,
          registrationUrl,
          verificationResult.verified ? 'active' : 'pending',
          verificationResult.verified,
        ]
      );

      // Emit notification
      io.to(`merchant_${merchantId}`).emit('MERCHANT_VERIFICATION_RESULT', {
        verified: verificationResult.verified,
        confidence: verificationResult.confidence,
        message: verificationResult.verified
          ? '✅ Your business has been verified! You can now start selling.'
          : '❌ Verification failed. Please check your documents and resubmit.',
      });

      return res.status(201).json({
        merchantId: merchantId_uuid,
        verified: verificationResult.verified,
        confidence: verificationResult.confidence,
        details: verificationResult.details,
      });
    } catch (error) {
      console.error('Merchant verification error:', error);
      return res.status(500).json({ error: 'Merchant verification failed' });
    }
  }
);

// ============================================
// VIDEO RECORDING - RIDES
// ============================================

/**
 * POST /api/v1/ride/start-with-recording
 * Start a ride and begin video recording
 */
router.post('/ride/start-with-recording', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.user as any;
    const { customerId, pickupLocation, dropoffLocation } = req.body;

    // Check driver verification
    const driver = await db.query('SELECT status FROM drivers WHERE id = $1', [driverId]);

    if (driver.rows[0].status !== 'verified') {
      return res.status(403).json({
        error: 'Only verified drivers can accept rides. Please complete verification.',
      });
    }

    // Create ride record
    const rideId = uuidv4();
    await db.query(
      `INSERT INTO rides (id, driver_id, customer_id, pickup_location, dropoff_location, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        rideId,
        driverId,
        customerId,
        JSON.stringify(pickupLocation),
        JSON.stringify(dropoffLocation),
        'active',
        new Date(),
      ]
    );

    // Start video recording automatically
    const recordingResult = await videoRecordingService.startRecording(
      rideId,
      driverId,
      customerId,
      pickupLocation
    );

    // Notify driver and customer
    io.to(`driver_${driverId}`).emit('RIDE_STARTED_WITH_RECORDING', {
      rideId,
      recordingId: recordingResult.recordingId,
      message: '🎥 Video recording started. Please place your phone on a stand facing the passenger.',
    });

    io.to(`customer_${customerId}`).emit('RIDE_ACCEPTED_WITH_RECORDING', {
      rideId,
      driverId,
      driverVerified: true,
      recordingActive: true,
      message: '✅ Ride accepted. Trip is being recorded for safety.',
    });

    return res.status(201).json({
      rideId,
      recordingId: recordingResult.recordingId,
      status: 'recording_active',
      instructions: 'Place your phone on a stand that faces the passenger.',
    });
  } catch (error) {
    console.error('Ride start error:', error);
    return res.status(500).json({ error: 'Failed to start ride' });
  }
});

/**
 * POST /api/v1/ride/end
 * End ride and upload video to blockchain
 */
router.post('/ride/end', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.user as any;
    const { rideId, dropoffLocation, videoBuffer, fare } = req.body;

    // Stop recording
    const recordingResult = await videoRecordingService.stopRecording(rideId, driverId, dropoffLocation);

    // Upload video to blockchain if buffer provided
    let videoStorageResult = null;
    if (videoBuffer) {
      const buffer = Buffer.from(videoBuffer, 'base64');
      videoStorageResult = await videoRecordingService.uploadVideoToBlockchain(rideId, buffer, {
        driverId,
        duration: recordingResult.duration,
      });
    }

    // Update ride record
    await db.query(
      `UPDATE rides SET status = $1, dropoff_location = $2, fare = $3, ended_at = $4 WHERE id = $5`,
      ['completed', JSON.stringify(dropoffLocation), fare, new Date(), rideId]
    );

    // Calculate earnings
    const driverEarnings = fare * 1.0; // 100% commission model
    await db.query(
      `INSERT INTO driver_earnings (id, driver_id, ride_id, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), driverId, rideId, driverEarnings, 'pending_payout', new Date()]
    );

    return res.json({
      rideId,
      status: 'completed',
      recordingDuration: recordingResult.duration,
      videoStorageStatus: videoStorageResult?.status || 'processing',
      earnings: driverEarnings,
      blockchainHash: videoStorageResult?.blockchainHash,
    });
  } catch (error) {
    console.error('Ride end error:', error);
    return res.status(500).json({ error: 'Failed to end ride' });
  }
});

// ============================================
// SOS EMERGENCY BUTTON
// ============================================

/**
 * POST /api/v1/emergency/sos
 * Trigger SOS emergency with video evidence
 */
router.post('/emergency/sos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const userType = (req.user as any).userType; // 'driver' or 'customer'
    const { rideId, location, sosType } = req.body;

    // Get ride details
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);

    if (!ride.rows[0]) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const rideData = ride.rows[0];
    const driverId = userType === 'driver' ? userId : rideData.driver_id;
    const customerId = userType === 'customer' ? userId : rideData.customer_id;

    // Trigger SOS
    const sosResult = await sosEmergencyService.triggerSOS(
      rideId,
      driverId,
      customerId,
      sosType,
      location
    );

    // Notify both parties
    io.to(`driver_${driverId}`).emit('SOS_TRIGGERED', {
      sosId: sosResult.sosId,
      initiatedBy: sosType,
      location,
      videoStreamUrl: sosResult.videoStreamUrl,
      personnelCount: sosResult.personnelNotified,
    });

    io.to(`customer_${customerId}`).emit('SOS_TRIGGERED', {
      sosId: sosResult.sosId,
      initiatedBy: sosType,
      videoStreamUrl: sosResult.videoStreamUrl,
      message: '🚨 Emergency services have been notified with video evidence.',
    });

    return res.status(201).json({
      sosId: sosResult.sosId,
      status: 'activated',
      videoStreamUrl: sosResult.videoStreamUrl,
      personnelNotified: sosResult.personnelNotified,
      message: 'Emergency services have been notified immediately.',
    });
  } catch (error) {
    console.error('SOS trigger error:', error);
    return res.status(500).json({ error: 'Failed to trigger SOS' });
  }
});

/**
 * POST /api/v1/emergency/sos/:sosId/resolve
 * Resolve SOS and store evidence
 */
router.post('/emergency/sos/:sosId/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sosId } = req.params;
    const { resolution, notes } = req.body;
    const securityPersonnelId = (req.user as any).id;

    const resolveResult = await sosEmergencyService.resolveSOS(
      sosId,
      securityPersonnelId,
      resolution,
      notes
    );

    return res.json(resolveResult);
  } catch (error) {
    console.error('SOS resolution error:', error);
    return res.status(500).json({ error: 'Failed to resolve SOS' });
  }
});

// ============================================
// VIDEO EVIDENCE FOR DISPUTES
// ============================================

/**
 * GET /api/v1/ride/:rideId/video-evidence
 * Get video evidence for a specific ride (for dispute resolution)
 */
router.get('/ride/:rideId/video-evidence', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rideId } = req.params;
    const userType = (req.user as any).userType;

    // Verify access - only security personnel, driver, or customer can view
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);

    if (!ride.rows[0]) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (
      userType !== 'security_personnel' &&
      (req.user as any).id !== ride.rows[0].driver_id &&
      (req.user as any).id !== ride.rows[0].customer_id
    ) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get video evidence
    const evidence = await videoRecordingService.getVideoEvidence(rideId);

    return res.json(evidence);
  } catch (error) {
    console.error('Error getting video evidence:', error);
    return res.status(500).json({ error: 'Failed to get video evidence' });
  }
});

// ============================================
// DISPUTE MANAGEMENT
// ============================================

/**
 * POST /api/v1/disputes/create
 * Create a dispute with video evidence
 */
router.post('/disputes/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { rideId, disputeType, description } = req.body;

    // Get ride details
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    const driverId = ride.rows[0].driver_id;
    const customerId = ride.rows[0].customer_id;

    // Get video evidence automatically
    const videoEvidence = await db.query(
      'SELECT id FROM video_recordings WHERE ride_id = $1',
      [rideId]
    );

    const disputeId = uuidv4();
    await db.query(
      `INSERT INTO disputes (id, ride_id, customer_id, driver_id, dispute_type, description, video_recording_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        disputeId,
        rideId,
        customerId,
        driverId,
        disputeType,
        description,
        videoEvidence.rows[0]?.id || null,
        'open',
        new Date(),
      ]
    );

    // Notify security personnel
    const securityPersonnel = await db.query(
      'SELECT id FROM security_personnel WHERE status = $1 LIMIT 1',
      ['active']
    );

    if (securityPersonnel.rows[0]) {
      io.to(`security_${securityPersonnel.rows[0].id}`).emit('NEW_DISPUTE', {
        disputeId,
        rideId,
        videoAvailable: !!videoEvidence.rows[0],
        type: disputeType,
      });
    }

    return res.status(201).json({
      disputeId,
      status: 'open',
      videoEvidenceAvailable: !!videoEvidence.rows[0],
      message: 'Dispute created. Security team will review video evidence and contact you within 24 hours.',
    });
  } catch (error) {
    console.error('Dispute creation error:', error);
    return res.status(500).json({ error: 'Failed to create dispute' });
  }
});

/**
 * GET /api/v1/disputes/:disputeId
 * Get dispute details with video evidence
 */
router.get('/disputes/:disputeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { disputeId } = req.params;

    const dispute = await db.query(
      `SELECT d.*, vr.s3_url, vr.blockchain_hash, vr.duration 
       FROM disputes d
       LEFT JOIN video_recordings vr ON d.video_recording_id = vr.id
       WHERE d.id = $1`,
      [disputeId]
    );

    if (!dispute.rows[0]) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    return res.json(dispute.rows[0]);
  } catch (error) {
    console.error('Error getting dispute:', error);
    return res.status(500).json({ error: 'Failed to get dispute' });
  }
});

/**
 * POST /api/v1/disputes/:disputeId/resolve
 * Resolve dispute with video evidence review
 */
router.post('/disputes/:disputeId/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { disputeId } = req.params;
    const { resolution, refundAmount, notes } = req.body;
    const securityPersonnelId = (req.user as any).id;

    // Update dispute
    await db.query(
      `UPDATE disputes SET status = $1, resolution = $2, refund_amount = $3, resolved_by = $4, notes = $5, resolved_at = $6
       WHERE id = $7`,
      ['resolved', resolution, refundAmount, securityPersonnelId, notes, new Date(), disputeId]
    );

    // Process refund if applicable
    if (refundAmount && refundAmount > 0) {
      const dispute = await db.query('SELECT customer_id, ride_id FROM disputes WHERE id = $1', [disputeId]);
      const customerId = dispute.rows[0].customer_id;

      await db.query(
        `INSERT INTO refunds (id, customer_id, ride_id, amount, reason, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          customerId,
          dispute.rows[0].ride_id,
          refundAmount,
          resolution,
          'pending',
          new Date(),
        ]
      );
    }

    return res.json({
      disputeId,
      status: 'resolved',
      resolution,
      refundAmount,
      message: 'Dispute resolved and video evidence stored on blockchain.',
    });
  } catch (error) {
    console.error('Dispute resolution error:', error);
    return res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;
