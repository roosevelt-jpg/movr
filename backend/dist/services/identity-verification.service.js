"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/services/identity-verification.service.ts
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
class IdentityVerificationService {
    constructor() {
        this.s3 = new aws_sdk_1.default.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
        this.rekognition = new aws_sdk_1.default.Rekognition({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
    }
    /**
     * Upload identity document to secure storage
     */
    async uploadIdentityDocument(driverId, documentType, file) {
        try {
            const key = `movr-identity-docs/${driverId}/${documentType}/${(0, uuid_1.v4)()}.jpg`;
            const params = {
                Bucket: process.env.AWS_S3_BUCKET || 'movr-documents',
                Key: key,
                Body: file,
                ContentType: 'image/jpeg',
                ServerSideEncryption: 'AES256',
                Metadata: {
                    driverId,
                    documentType,
                    uploadedAt: new Date().toISOString(),
                },
            };
            const result = await this.s3.upload(params).promise();
            console.log(`✅ Document uploaded: ${result.Location}`);
            return result.Location;
        }
        catch (error) {
            console.error('❌ Document upload failed:', error);
            throw error;
        }
    }
    /**
     * Verify identity using 3rd party API (IDology, Jumio, or similar)
     */
    async verifyIdentityDocument(driverId, documentType, documentNumber, frontImageUrl, backImageUrl) {
        try {
            // Use IDology API for real-time verification
            const verificationResponse = await axios_1.default.post('https://api.idology.com/api/idologyid/Verification', {
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
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            // Verify face match between document and selfie
            const faceVerificationResult = await this.verifyFaceMatch(driverId, frontImageUrl);
            // Check for fraud signals
            const fraudCheckResult = await this.checkFraudSignals(verificationResponse.data);
            const verified = verificationResponse.data.result.idNumber === 'PASS' &&
                faceVerificationResult.match &&
                !fraudCheckResult.fraudDetected;
            const documentId = (0, uuid_1.v4)();
            // Store verification result
            await db.query(`INSERT INTO identity_verifications (id, driver_id, document_type, verified, confidence, details, result_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
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
            ]);
            console.log(`✅ Identity verification completed for driver ${driverId}: ${verified ? 'VERIFIED' : 'FAILED'}`);
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
        }
        catch (error) {
            console.error('❌ Identity verification failed:', error);
            throw error;
        }
    }
    /**
     * Verify face match between document and driver selfie
     */
    async verifyFaceMatch(driverId, documentImageUrl) {
        try {
            // Get driver's selfie from database
            const driverResult = await db.query('SELECT profile_photo_url FROM drivers WHERE id = $1', [driverId]);
            if (!driverResult.rows[0])
                throw new Error('Driver not found');
            const selfieUrl = driverResult.rows[0].profile_photo_url;
            // Download both images
            const docImage = await axios_1.default.get(documentImageUrl, { responseType: 'arraybuffer' });
            const selfieImage = await axios_1.default.get(selfieUrl, { responseType: 'arraybuffer' });
            // Use AWS Rekognition for face comparison
            const params = {
                SourceImage: { Bytes: docImage.data },
                TargetImage: { Bytes: selfieImage.data },
                SimilarityThreshold: 90, // 90% match required
            };
            const comparisonResult = await this.rekognition.compareFaces(params).promise();
            const match = comparisonResult.FaceMatches && comparisonResult.FaceMatches.length > 0;
            const confidence = match ? Math.round(comparisonResult.FaceMatches[0].Similarity || 0) : 0;
            return {
                match,
                confidence,
                similarity: match ? comparisonResult.FaceMatches[0].Similarity : 0,
            };
        }
        catch (error) {
            console.error('❌ Face verification failed:', error);
            return { match: false, confidence: 0 };
        }
    }
    /**
     * Check for fraud signals using ML
     */
    async checkFraudSignals(verificationData) {
        try {
            // Check for common fraud patterns
            const fraudRisks = [];
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
                const siftResult = await axios_1.default.post('https://api.siftscience.com/v203/users/{user_id}/decisions', {
                    $user_id: verificationData.client_id,
                    $type: 'identity_verification',
                    $reasons: fraudRisks,
                }, {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(process.env.SIFT_SCIENCE_API_KEY + ':').toString('base64')}`,
                    },
                });
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
        }
        catch (error) {
            console.error('❌ Fraud check failed:', error);
            return { fraudDetected: false, risks: [], riskScore: 0 };
        }
    }
    /**
     * Extract text from document using OCR
     */
    async extractFromDocument(imageUrl, field) {
        try {
            const image = await axios_1.default.get(imageUrl, { responseType: 'arraybuffer' });
            const params = {
                Image: { Bytes: image.data },
            };
            const textResult = await this.rekognition.detectText(params).promise();
            // Extract specific field using regex or ML
            const fullText = textResult.TextDetections?.map((t) => t.DetectedText).join(' ') || '';
            // Simple extraction logic (would be more sophisticated in production)
            if (field === 'firstName') {
                return fullText.split(/\s+/)[0];
            }
            // Add more field extraction logic as needed
            return '';
        }
        catch (error) {
            console.error(`❌ OCR extraction failed for ${field}:`, error);
            return '';
        }
    }
    async extractNameFromDoc(imageUrl, part) {
        return this.extractFromDocument(imageUrl, part);
    }
    async extractDOBFromDoc(imageUrl) {
        return this.extractFromDocument(imageUrl, 'dob');
    }
    async extractAddressFromDoc(imageUrl) {
        return this.extractFromDocument(imageUrl, 'address');
    }
    async extractCityFromDoc(imageUrl) {
        return this.extractFromDocument(imageUrl, 'city');
    }
    async extractStateFromDoc(imageUrl) {
        return this.extractFromDocument(imageUrl, 'state');
    }
    async extractZipFromDoc(imageUrl) {
        return this.extractFromDocument(imageUrl, 'zip');
    }
    /**
     * Verify business and merchant credentials
     */
    async verifyMerchantBusiness(merchantId, businessName, businessRegistrationNumber, businessLicenseUrl, ownerIdUrl) {
        try {
            // Verify business registration using government APIs
            const businessVerification = await axios_1.default.get(`https://api.business-registry.gov.gh/verify?registration=${businessRegistrationNumber}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.BUSINESS_REGISTRY_API_KEY}`,
                },
            });
            if (!businessVerification.data.registered) {
                throw new Error('Business not registered');
            }
            // Verify owner identity
            const ownerVerification = await this.verifyIdentityDocument(merchantId, 'national_id', '', ownerIdUrl);
            // Verify business license image
            const licenseImage = await axios_1.default.get(businessLicenseUrl, { responseType: 'arraybuffer' });
            const params = {
                Image: { Bytes: licenseImage.data },
            };
            const textResult = await this.rekognition.detectText(params).promise();
            const verified = businessVerification.data.registered &&
                ownerVerification.verified &&
                textResult.TextDetections && textResult.TextDetections.length > 5;
            const verificationId = (0, uuid_1.v4)();
            // Store merchant verification
            await db.query(`INSERT INTO merchant_verifications (id, merchant_id, business_name, verified, confidence, details, verified_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
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
            ]);
            console.log(`✅ Merchant verification completed: ${businessName} - ${verified ? 'VERIFIED' : 'FAILED'}`);
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
        }
        catch (error) {
            console.error('❌ Merchant verification failed:', error);
            throw error;
        }
    }
    /**
     * Get verification status for dashboard
     */
    async getVerificationStatus(userId, userType) {
        try {
            const verifications = await db.query(`SELECT * FROM ${userType === 'driver' ? 'identity_verifications' : 'merchant_verifications'}
         WHERE ${userType === 'driver' ? 'driver_id' : 'merchant_id'} = $1
         ORDER BY result_date DESC`, [userId]);
            return {
                verified: verifications.rows.some((v) => v.verified),
                documents: verifications.rows.map((v) => ({
                    type: userType === 'driver' ? v.document_type : 'business',
                    verified: v.verified,
                    confidence: v.confidence,
                    date: v.result_date,
                    details: JSON.parse(v.details),
                })),
            };
        }
        catch (error) {
            console.error('❌ Error getting verification status:', error);
            throw error;
        }
    }
}
exports.default = new IdentityVerificationService();
//# sourceMappingURL=identity-verification.service.js.map