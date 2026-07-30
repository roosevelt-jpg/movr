import axios from 'axios';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import getLogger from '../utils/logger';

export interface LicenseVerifyResult {
  matched: boolean;
  confidence: number;
  biodata?: Record<string, any>;
  pendingManualReview?: boolean;
  message?: string;
}

/**
 * Ghana DVLA driving license + vehicle registration checks.
 * Falls back to OCR + manual review when API credentials are absent.
 */
export class DrivingLicenseVerificationService {
  private logger = getLogger('dvla');
  private integrations: IntegrationsService;

  constructor(private db: DatabaseService) {
    this.integrations = new IntegrationsService(db);
  }

  async verifyLicense(
    licenseNumber: string,
    fullName: string
  ): Promise<LicenseVerifyResult> {
    const apiKey = await this.integrations.getCredential('dvla_ghana', 'api_key');
    const base =
      (await this.integrations.getCredential('dvla_ghana', 'base_url')) ||
      'https://api.dvla.gov.gh';

    if (!apiKey) {
      return {
        matched: false,
        confidence: 0,
        pendingManualReview: true,
        message: 'DVLA API not configured — known gap until access is secured',
        biodata: { licenseNumber, fullName },
      };
    }

    try {
      const res = await axios.post(
        `${base}/v1/license/verify`,
        { licenseNumber, fullName },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
      );
      return {
        matched: Boolean(res.data?.matched),
        confidence: Number(res.data?.confidence ?? 0),
        biodata: res.data?.biodata || {},
      };
    } catch (err: any) {
      this.logger.warn('DVLA license verify failed', { error: err.message });
      return {
        matched: false,
        confidence: 0,
        pendingManualReview: true,
        message: err.message,
      };
    }
  }

  async verifyVehicleRegistration(
    registrationNumber: string,
    ownerName: string
  ): Promise<LicenseVerifyResult> {
    const apiKey = await this.integrations.getCredential('dvla_ghana', 'api_key');
    if (!apiKey) {
      return {
        matched: false,
        confidence: 0,
        pendingManualReview: true,
        message: 'DVLA vehicle API not configured',
        biodata: { registrationNumber, ownerName },
      };
    }
    try {
      const base =
        (await this.integrations.getCredential('dvla_ghana', 'base_url')) ||
        'https://api.dvla.gov.gh';
      const res = await axios.post(
        `${base}/v1/vehicle/verify`,
        { registrationNumber, ownerName },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
      );
      return {
        matched: Boolean(res.data?.matched),
        confidence: Number(res.data?.confidence ?? 0),
        biodata: res.data?.biodata || {},
      };
    } catch (err: any) {
      return {
        matched: false,
        confidence: 0,
        pendingManualReview: true,
        message: err.message,
      };
    }
  }
}
