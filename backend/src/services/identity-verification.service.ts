// backend/src/services/identity-verification.service.ts
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';
import { DatabaseService } from './database.service';
import getLogger from '../utils/logger';

const logger = getLogger('identity-verification');

interface IdentityDocument {
  type: 'national_id' | 'passport' | 'driving_license';
  documentNumber: string;
  issuedDate: Date;
  expiryDate: Date;
  frontImageUrl: string;
  backImageUrl?: string;
}

interface VerificationResult {
  documentId: string;
  verified: boolean;
  verificationMethod: 'api' | 'manual';
  confidence: number; // 0-100
  details: any;
  timestamp: Date;
}

class IdentityVerificationService {
  private s3: AWS.S3;
  private rekognition: AWS.Rekognition;
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.rekognition = new AWS.Rekognition({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  /**
   * Upload identity document to assets storage (S3 under assets/…, else local backend/assets).
   */
  async uploadIdentityDocument(driverId: string, documentType: string, file: Buffer): Promise<string> {
    try {
      const { cloudAssetKey, saveAssetBuffer } = await import('../utils/asset-storage');
      const key = cloudAssetKey(
        'images',
        'identity',
        driverId,
        documentType,
        `${uuidv4()}.jpg`
      );

      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const params = {
          Bucket: process.env.AWS_S3_BUCKET || 'movr-documents',
          Key: key,
          Body: file,
          ContentType: 'image/jpeg',
          ServerSideEncryption: 'AES256' as const,
          Metadata: {
            driverId,
            documentType,
            uploadedAt: new Date().toISOString(),
          },
        };
        const result = await this.s3.upload(params).promise();
        logger.info('Document uploaded', { location: result.Location, key });
        return result.Location;
      }

      const saved = saveAssetBuffer(file, {
        mime: 'image/jpeg',
        filename: path.basename(key),
        subdir: path.posix.join('identity', driverId, documentType),
      });
      logger.info('Document saved to assets', { url: saved.url });
      return saved.url;
    } catch (error) {
      console.error('❌ Document upload failed:', error);
      throw error;
    }
  }

  /**
   * Verify identity using 3rd party API (IDology, Jumio, or similar)
   */
  async verifyIdentityDocument(
    driverId: string,
    documentType: string,
    documentNumber: string,
    frontImageUrl: string,
    backImageUrl?: string
  ): Promise<VerificationResult> {
    try {
      // Use IDology API for real-time verification
      const verificationResponse = await axios.post(
        'https://api.idology.com/api/idologyid/Verification',
        {
          username: process.env.IDOLOGY_USERNAME,
          password: process.env.IDOLOGY_PASSWORD,
          useSsl: true,
          client_id: driverId,
          firstName: await this.extractNameFromDoc(frontImageUrl, 'firstName'),
          lastName: await this.extractNameFromDoc(frontImageUrl, 'lastName'),
          dob: await this.extractDOBFromDoc(frontImageUrl),
          address: await this.extractAddressFromDoc(frontImageUrl),
          city: await this.extractCityFromDoc(frontImageUrl),
          state: await this.extractStateFromDoc(frontImageUrl),
          zip: await this.extractZipFromDoc(frontImageUrl),
          ssn: '', // Will be extracted
          documentType,
          documentNumber,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Verify face match between document and selfie
      const faceVerificationResult = await this.verifyFaceMatch(driverId, frontImageUrl);

      // Check for fraud signals
      const fraudCheckResult = await this.checkFraudSignals(verificationResponse.data);

      const verified =
        verificationResponse.data.result.idNumber === 'PASS' &&
        faceVerificationResult.match &&
        !fraudCheckResult.fraudDetected;

      const documentId = uuidv4();

      // Store verification result
      await this.db.query(
        `INSERT INTO identity_verifications (id, driver_id, document_type, verified, confidence, details, result_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          documentId,
          driverId,
          documentType,
          verified,
          faceVerificationResult.confidence || 0,
          JSON.stringify({
            idologyResult: verificationResponse.data,
            faceVerification: faceVerificationResult,
            fraudCheck: fraudCheckResult,
          }),
          new Date(),
        ]
      );

      logger.info('Identity verification completed', { driverId, verified });

      return {
        documentId,
        verified,
        verificationMethod: 'api',
        confidence: faceVerificationResult.confidence || 0,
        details: {
          idologyResult: verificationResponse.data.result,
          faceMatch: faceVerificationResult.match,
          fraudDetected: fraudCheckResult.fraudDetected,
          fraudRisks: fraudCheckResult.risks,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ Identity verification failed:', error);
      throw error;
    }
  }

  /**
   * Verify face match between document and driver selfie
   */
  private async verifyFaceMatch(driverId: string, documentImageUrl: string): Promise<any> {
    try {
      // Get driver's selfie from database
      const driverResult = await this.db.query(
        'SELECT profile_photo_url FROM drivers WHERE id = $1',
        [driverId]
      );

      if (!driverResult.rows[0]) throw new Error('Driver not found');

      const selfieUrl = driverResult.rows[0].profile_photo_url;

      // Download both images
      const docImage = await axios.get(documentImageUrl, { responseType: 'arraybuffer' });
      const selfieImage = await axios.get(selfieUrl, { responseType: 'arraybuffer' });

      // Use AWS Rekognition for face comparison
      const params = {
        SourceImage: { Bytes: docImage.data },
        TargetImage: { Bytes: selfieImage.data },
        SimilarityThreshold: 90, // 90% match required
      };

      const comparisonResult = await this.rekognition.compareFaces(params).promise();

      const match = !!(comparisonResult.FaceMatches && comparisonResult.FaceMatches.length > 0);
      const confidence = match
        ? Math.round(comparisonResult.FaceMatches![0].Similarity || 0)
        : 0;

      return {
        match,
        confidence,
        similarity: match ? comparisonResult.FaceMatches![0].Similarity : 0,
      };
    } catch (error) {
      console.error('❌ Face verification failed:', error);
      return { match: false, confidence: 0 };
    }
  }

  /**
   * Check for fraud signals using ML
   */
  private async checkFraudSignals(verificationData: any): Promise<any> {
    try {
      // Check for common fraud patterns
      const fraudRisks: string[] = [];
      let fraudDetected = false;

      // Check if document is expired
      if (new Date(verificationData.expiryDate) < new Date()) {
        fraudRisks.push('Document expired');
        fraudDetected = true;
      }

      // Check if document is too old
      const docAge = (new Date().getTime() - new Date(verificationData.issuedDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (docAge > 10) {
        fraudRisks.push('Document too old');
        fraudDetected = true;
      }

      // Check IDology fraud indicators
      if (verificationData.result && verificationData.result.fraudIndicators) {
        fraudRisks.push(...verificationData.result.fraudIndicators);
        fraudDetected = true;
      }

      // Use Sift Science API for additional fraud detection
      if (process.env.SIFT_SCIENCE_API_KEY) {
        const siftResult = await axios.post(
          'https://api.siftscience.com/v203/users/{user_id}/decisions',
          {
            $user_id: verificationData.client_id,
            $type: 'identity_verification',
            $reasons: fraudRisks,
          },
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(process.env.SIFT_SCIENCE_API_KEY + ':').toString('base64')}`,
            },
          }
        );

        if (siftResult.data.decisions.identity_verification.decision.id === 'block') {
          fraudDetected = true;
          fraudRisks.push('Flagged by fraud detection system');
        }
      }

      return {
        fraudDetected,
        risks: fraudRisks,
        riskScore: fraudRisks.length * 25, // 0-100
      };
    } catch (error) {
      console.error('❌ Fraud check failed:', error);
      return { fraudDetected: false, risks: [], riskScore: 0 };
    }
  }

  /**
   * Extract text from document using OCR
   */
  private async extractFromDocument(imageUrl: string, field: string): Promise<string> {
    try {
      const image = await axios.get(imageUrl, { responseType: 'arraybuffer' });

      const params = {
        Image: { Bytes: image.data },
      };

      const textResult = await this.rekognition.detectText(params).promise();

      // Extract specific field using regex or ML
      const fullText = textResult.TextDetections?.map((t: any) => t.DetectedText).join(' ') || '';

      // Simple extraction logic (would be more sophisticated in production)
      if (field === 'firstName') {
        return fullText.split(/\s+/)[0];
      }
      // Add more field extraction logic as needed

      return '';
    } catch (error) {
      console.error(`❌ OCR extraction failed for ${field}:`, error);
      return '';
    }
  }

  private async extractNameFromDoc(imageUrl: string, part: 'firstName' | 'lastName'): Promise<string> {
    return this.extractFromDocument(imageUrl, part);
  }

  private async extractDOBFromDoc(imageUrl: string): Promise<string> {
    return this.extractFromDocument(imageUrl, 'dob');
  }

  private async extractAddressFromDoc(imageUrl: string): Promise<string> {
    return this.extractFromDocument(imageUrl, 'address');
  }

  private async extractCityFromDoc(imageUrl: string): Promise<string> {
    return this.extractFromDocument(imageUrl, 'city');
  }

  private async extractStateFromDoc(imageUrl: string): Promise<string> {
    return this.extractFromDocument(imageUrl, 'state');
  }

  private async extractZipFromDoc(imageUrl: string): Promise<string> {
    return this.extractFromDocument(imageUrl, 'zip');
  }

  /**
   * Lightweight merchant document attestation (Phase 3) — reuses driver upload pipeline.
   * Full registry checks still go through verifyMerchantBusiness when available.
   */
  async verifyMerchantDocument(input: {
    merchantId: string;
    documentType: string;
    documentNumber?: string;
    fileUrl: string;
  }): Promise<VerificationResult> {
    const documentId = uuidv4();
    try {
      if (!input.fileUrl) {
        return {
          documentId,
          verified: false,
          verificationMethod: 'manual',
          confidence: 0,
          details: { reason: 'missing_file' },
          timestamp: new Date(),
        };
      }

      // Attempt image text signal when AWS is configured; otherwise queue for manual review.
      let confidence = 40;
      try {
        const licenseImage = await axios.get(input.fileUrl, { responseType: 'arraybuffer' });
        const textResult = await this.rekognition
          .detectText({ Image: { Bytes: licenseImage.data } })
          .promise();
        const detections = textResult.TextDetections?.length || 0;
        confidence = Math.min(95, 40 + detections * 5);
      } catch {
        confidence = 35;
      }

      return {
        documentId,
        verified: confidence >= 70,
        verificationMethod: confidence >= 70 ? 'api' : 'manual',
        confidence,
        details: {
          merchantId: input.merchantId,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
        },
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        documentId,
        verified: false,
        verificationMethod: 'manual',
        confidence: 0,
        details: { error: error.message },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Verify business and merchant credentials
   */
  async verifyMerchantBusiness(
    merchantId: string,
    businessName: string,
    businessRegistrationNumber: string,
    businessLicenseUrl: string,
    ownerIdUrl: string
  ): Promise<VerificationResult> {
    try {
      // Verify business registration using government APIs
      const businessVerification = await axios.get(
        `https://api.business-registry.gov.gh/verify?registration=${businessRegistrationNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.BUSINESS_REGISTRY_API_KEY}`,
          },
        }
      );

      if (!businessVerification.data.registered) {
        throw new Error('Business not registered');
      }

      // Verify owner identity
      const ownerVerification = await this.verifyIdentityDocument(
        merchantId,
        'national_id',
        '',
        ownerIdUrl
      );

      // Verify business license image
      const licenseImage = await axios.get(businessLicenseUrl, { responseType: 'arraybuffer' });
      const params = {
        Image: { Bytes: licenseImage.data },
      };
      const textResult = await this.rekognition.detectText(params).promise();

      const verified =
        businessVerification.data.registered &&
        ownerVerification.verified &&
        textResult.TextDetections && textResult.TextDetections.length > 5;

      const verificationId = uuidv4();

      // Store merchant verification
      await this.db.query(
        `INSERT INTO merchant_verifications (id, merchant_id, business_name, verified, confidence, details, verified_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          verificationId,
          merchantId,
          businessName,
          verified,
          ownerVerification.confidence,
          JSON.stringify({
            businessVerification: businessVerification.data,
            ownerVerification,
            licenseOCR: textResult.TextDetections,
          }),
          new Date(),
        ]
      );

      logger.info('Merchant verification completed', { businessName, verified });

      return {
        documentId: verificationId,
        verified,
        verificationMethod: 'api',
        confidence: ownerVerification.confidence,
        details: {
          businessVerified: businessVerification.data.registered,
          ownerVerified: ownerVerification.verified,
          licenseValid: (textResult.TextDetections?.length || 0) > 5,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('❌ Merchant verification failed:', error);
      throw error;
    }
  }

  /**
   * Get verification status for dashboard
   */
  async getVerificationStatus(userId: string, userType: 'driver' | 'merchant') {
    try {
      const verifications = await this.db.query(
        `SELECT * FROM ${userType === 'driver' ? 'identity_verifications' : 'merchant_verifications'}
         WHERE ${userType === 'driver' ? 'driver_id' : 'merchant_id'} = $1
         ORDER BY result_date DESC`,
        [userId]
      );

      return {
        verified: verifications.rows.some((v: any) => v.verified),
        documents: verifications.rows.map((v: any) => ({
          type: userType === 'driver' ? v.document_type : 'business',
          verified: v.verified,
          confidence: v.confidence,
          date: v.result_date,
          details: JSON.parse(v.details),
        })),
      };
    } catch (error) {
      console.error('❌ Error getting verification status:', error);
      throw error;
    }
  }

  /**
   * Phase 26 — cross-check national ID, license, vehicle, phone into an identity graph.
   */
  async linkIdentityDocuments(userId: string) {
    const database = this.db;
    const { NationalIdVerificationService } = require('./ghana-card-verification.service');
    const { DrivingLicenseVerificationService } = require('./driving-license-verification.service');
    const national = new NationalIdVerificationService(database);
    const dvla = new DrivingLicenseVerificationService(database);

    const user = (await database.query(`SELECT * FROM users WHERE id = $1`, [userId])).rows[0];
    if (!user) throw new Error('User not found');

    const driver = (
      await database.query(`SELECT * FROM drivers WHERE user_id = $1 LIMIT 1`, [userId])
    ).rows[0];
    const driverId = driver?.id;

    const docs = driverId
      ? (
          await database.query(
            `SELECT * FROM identity_verifications WHERE driver_id = $1 ORDER BY created_at DESC`,
            [driverId]
          )
        ).rows
      : [];

    const nationalDoc =
      docs.find((d: any) => d.document_type === 'national_id' || d.national_id_number) || docs[0];
    const licenseDoc = docs.find((d: any) => d.document_type === 'driving_license');
    const country = nationalDoc?.national_id_country || user.country || 'GH';
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    const idNumber = nationalDoc?.national_id_number || nationalDoc?.document_number;
    const licenseNumber =
      nationalDoc?.driving_license_number || licenseDoc?.document_number;
    const vehicleReg = nationalDoc?.vehicle_registration_number;
    const phone = nationalDoc?.linked_phone_number || user.phone;

    const checks: any[] = [];

    let licenseStatus: 'match' | 'mismatch' | 'unverifiable' = 'unverifiable';
    if (idNumber && licenseNumber) {
      const nia = await national.verifyNationalId(country, idNumber, fullName);
      const lic = await dvla.verifyLicense(licenseNumber, fullName);
      if (nia.pendingManualReview || lic.pendingManualReview) {
        licenseStatus = 'unverifiable';
      } else if (nia.matched && lic.matched) {
        licenseStatus = 'match';
      } else {
        licenseStatus = 'mismatch';
      }
    }
    checks.push(
      (
        await database.query(
          `INSERT INTO identity_link_checks (user_id, check_type, status, details_json)
           VALUES ($1,'id_to_license',$2,$3::jsonb) RETURNING *`,
          [userId, licenseStatus, JSON.stringify({ idNumber, licenseNumber })]
        )
      ).rows[0]
    );

    let vehicleStatus: 'match' | 'mismatch' | 'unverifiable' = 'unverifiable';
    const authLetter = docs.find(
      (d: any) =>
        d.document_type === 'authorization_letter' ||
        d.document_type === 'vehicle_lease_agreement'
    );
    if (vehicleReg && idNumber) {
      const veh = await dvla.verifyVehicleRegistration(vehicleReg, fullName);
      if (veh.pendingManualReview) vehicleStatus = 'unverifiable';
      else if (veh.matched || authLetter) vehicleStatus = 'match';
      else vehicleStatus = 'mismatch';
    } else if (authLetter) {
      vehicleStatus = 'match';
    }
    checks.push(
      (
        await database.query(
          `INSERT INTO identity_link_checks (user_id, check_type, status, details_json)
           VALUES ($1,'id_to_vehicle',$2,$3::jsonb) RETURNING *`,
          [
            userId,
            vehicleStatus,
            JSON.stringify({
              vehicleReg,
              authorizationLetter: Boolean(authLetter),
              note:
                vehicleStatus === 'mismatch'
                  ? 'Fleet/authorized-operator may need authorization letter override'
                  : authLetter
                    ? 'Authorized via authorization letter / lease agreement'
                    : undefined,
            }),
          ]
        )
      ).rows[0]
    );

    checks.push(
      (
        await database.query(
          `INSERT INTO identity_link_checks (user_id, check_type, status, details_json)
           VALUES ($1,'id_to_phone',$2,$3::jsonb) RETURNING *`,
          [
            userId,
            'unverifiable',
            JSON.stringify({
              phone,
              message: 'Telco SIM-registration API not available; skipped without scraping',
            }),
          ]
        )
      ).rows[0]
    );

    const allPass =
      checks.some((c) => c.check_type === 'id_to_license' && c.status === 'match') &&
      checks.every(
        (c) =>
          c.check_type === 'id_to_phone' ||
          c.status === 'match' ||
          c.status === 'unverifiable'
      );

    if (driverId && allPass) {
      await database.query(
        `UPDATE identity_verifications
         SET identity_linked = TRUE, link_verified = TRUE, link_verified_at = NOW()
         WHERE driver_id = $1`,
        [driverId]
      );
    }

    return {
      identityLinked: allPass,
      checks,
      countryOfId: country,
      fieldPattern: national.idFieldPattern(country),
    };
  }

  /**
   * OCR preview for confirm/correct step — uses Textract when available, else body stubs.
   */
  async ocrPreviewDocument(opts: {
    fileUrl?: string;
    imageBase64?: string;
    documentType?: string;
    countryCode?: string;
  }) {
    const extracted: Record<string, any> = {
      fullName: null,
      idNumber: null,
      dateOfBirth: null,
      licenseNumber: null,
      vehicleRegistration: null,
      documentType: opts.documentType || 'national_id',
    };

    try {
      if (opts.imageBase64 || opts.fileUrl) {
        // Soft OCR: when AWS Textract is configured, DetectDocumentText; otherwise return stubs
        const AWS = require('aws-sdk');
        if (process.env.AWS_ACCESS_KEY_ID && opts.imageBase64) {
          const textract = new AWS.Textract({ region: process.env.AWS_REGION || 'us-east-1' });
          const buf = Buffer.from(opts.imageBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
          const result = await textract
            .detectDocumentText({ Document: { Bytes: buf } })
            .promise();
          const lines = (result.Blocks || [])
            .filter((b: any) => b.BlockType === 'LINE')
            .map((b: any) => b.Text)
            .join('\n');
          extracted.rawText = lines;
          const ghanaCard = lines.match(/[A-Z]{3}-\d{9}-\d/);
          const nin = lines.match(/\b\d{11}\b/);
          extracted.idNumber = ghanaCard?.[0] || nin?.[0] || null;
          const dob = lines.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/);
          extracted.dateOfBirth = dob?.[0] || null;
        }
      }
    } catch (err: any) {
      extracted.ocrError = err.message;
      extracted.pendingManualReview = true;
    }

    return extracted;
  }

  async manualOverrideLink(
    userId: string,
    adminId: string,
    reason: string,
    checkType: string,
    status: 'match' | 'mismatch' | 'unverifiable'
  ) {
    const database = this.db;
    const row = await database.query(
      `INSERT INTO identity_link_checks (user_id, check_type, status, details_json)
       VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
      [userId, checkType, status, JSON.stringify({ manualOverride: true, adminId, reason })]
    );
    await database.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
       VALUES ($1,'identity_link_override','user',$2,$3,$4::jsonb)`,
      [adminId, userId, reason, JSON.stringify({ checkType, status })]
    );
    return row.rows[0];
  }
}

export default new IdentityVerificationService();
