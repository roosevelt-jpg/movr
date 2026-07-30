interface VerificationResult {
    documentId: string;
    verified: boolean;
    verificationMethod: 'api' | 'manual';
    confidence: number;
    details: any;
    timestamp: Date;
}
declare class IdentityVerificationService {
    private s3;
    private rekognition;
    constructor();
    /**
     * Upload identity document to secure storage
     */
    uploadIdentityDocument(driverId: string, documentType: string, file: Buffer): Promise<string>;
    /**
     * Verify identity using 3rd party API (IDology, Jumio, or similar)
     */
    verifyIdentityDocument(driverId: string, documentType: string, documentNumber: string, frontImageUrl: string, backImageUrl?: string): Promise<VerificationResult>;
    /**
     * Verify face match between document and driver selfie
     */
    private verifyFaceMatch;
    /**
     * Check for fraud signals using ML
     */
    private checkFraudSignals;
    /**
     * Extract text from document using OCR
     */
    private extractFromDocument;
    private extractNameFromDoc;
    private extractDOBFromDoc;
    private extractAddressFromDoc;
    private extractCityFromDoc;
    private extractStateFromDoc;
    private extractZipFromDoc;
    /**
     * Verify business and merchant credentials
     */
    verifyMerchantBusiness(merchantId: string, businessName: string, businessRegistrationNumber: string, businessLicenseUrl: string, ownerIdUrl: string): Promise<VerificationResult>;
    /**
     * Get verification status for dashboard
     */
    getVerificationStatus(userId: string, userType: 'driver' | 'merchant'): Promise<{
        verified: any;
        documents: any;
    }>;
}
declare const _default: IdentityVerificationService;
export default _default;
//# sourceMappingURL=identity-verification.service.d.ts.map