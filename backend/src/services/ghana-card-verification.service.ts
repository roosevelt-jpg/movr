import axios from 'axios';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import getLogger from '../utils/logger';

export interface NationalIdVerifyInput {
  idNumber: string;
  fullName: string;
  dateOfBirth?: string;
}

export interface NationalIdVerifyResult {
  matched: boolean;
  confidence: number;
  biodata?: Record<string, any>;
  provider: string;
  pendingManualReview?: boolean;
  message?: string;
}

export interface NationalIdVerifier {
  countryCode: string;
  idType: string;
  verify(input: NationalIdVerifyInput): Promise<NationalIdVerifyResult>;
}

/** Ghana NIA Ghana Card — credentials via Integrations Hub (nia_ghana_card). */
export class GhanaCardVerifier implements NationalIdVerifier {
  countryCode = 'GH';
  idType = 'ghana_card';
  private logger = getLogger('ghana-card');

  constructor(
    private db: DatabaseService,
    private integrations: IntegrationsService
  ) {}

  async verify(input: NationalIdVerifyInput): Promise<NationalIdVerifyResult> {
    const apiKey = await this.integrations.getCredential('nia_ghana_card', 'api_key');
    const base =
      (await this.integrations.getCredential('nia_ghana_card', 'base_url')) ||
      'https://api.nia.gov.gh';

    if (!apiKey) {
      this.logger.warn('NIA credentials missing — OCR + manual review path');
      return {
        matched: false,
        confidence: 0,
        provider: 'nia_ghana_card',
        pendingManualReview: true,
        message: 'NIA API not configured; pending automated verification',
        biodata: { fullName: input.fullName, idNumber: input.idNumber },
      };
    }

    try {
      const res = await axios.post(
        `${base}/v1/verify`,
        {
          ghanaCardNumber: input.idNumber,
          fullName: input.fullName,
          dateOfBirth: input.dateOfBirth,
        },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
      );
      const confidence = Number(res.data?.confidence ?? 0);
      return {
        matched: Boolean(res.data?.matched) && confidence >= 70,
        confidence,
        biodata: res.data?.biodata || {},
        provider: 'nia_ghana_card',
      };
    } catch (err: any) {
      this.logger.warn('NIA verify failed', { error: err.message });
      return {
        matched: false,
        confidence: 0,
        provider: 'nia_ghana_card',
        pendingManualReview: true,
        message: err.message,
      };
    }
  }
}

/** Nigeria NIN — live when Integrations Hub has nimc_nin api_key; else manual review. */
export class NigeriaNinVerifier implements NationalIdVerifier {
  countryCode = 'NG';
  idType = 'nigeria_nin';
  private logger = getLogger('nimc-nin');

  constructor(
    private db: DatabaseService,
    private integrations: IntegrationsService
  ) {}

  async verify(input: NationalIdVerifyInput): Promise<NationalIdVerifyResult> {
    const apiKey = await this.integrations.getCredential('nimc_nin', 'api_key');
    const base =
      (await this.integrations.getCredential('nimc_nin', 'base_url')) ||
      'https://api.nimc.gov.ng';

    if (!apiKey) {
      // Format gate: 11-digit NIN → soft pass for demo, still pending manual
      const digits = String(input.idNumber || '').replace(/\D/g, '');
      const formatOk = digits.length === 11;
      return {
        matched: false,
        confidence: formatOk ? 40 : 0,
        provider: 'nimc_nin',
        pendingManualReview: true,
        message: formatOk
          ? 'NIMC credentials missing — format OK, pending manual review'
          : 'Invalid NIN format (expect 11 digits)',
        biodata: { fullName: input.fullName, idNumber: input.idNumber },
      };
    }

    try {
      const res = await axios.post(
        `${base}/v1/verify`,
        {
          nin: input.idNumber,
          fullName: input.fullName,
          dateOfBirth: input.dateOfBirth,
        },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
      );
      const confidence = Number(res.data?.confidence ?? 0);
      return {
        matched: Boolean(res.data?.matched) && confidence >= 70,
        confidence,
        biodata: res.data?.biodata || {},
        provider: 'nimc_nin',
      };
    } catch (err: any) {
      this.logger.warn('NIMC verify failed', { error: err.message });
      return {
        matched: false,
        confidence: 0,
        provider: 'nimc_nin',
        pendingManualReview: true,
        message: err.message,
      };
    }
  }
}

/** Côte d'Ivoire ONECI stub. */
export class CoteDivoireOneciVerifier implements NationalIdVerifier {
  countryCode = 'CI';
  idType = 'cote_divoire_oneci';

  async verify(input: NationalIdVerifyInput): Promise<NationalIdVerifyResult> {
    return {
      matched: false,
      confidence: 0,
      provider: 'oneci',
      pendingManualReview: true,
      message: 'ONECI integration pending credentials — OCR + manual review',
      biodata: { fullName: input.fullName, idNumber: input.idNumber },
    };
  }
}

/** Senegal CNI stub. */
export class SenegalCniVerifier implements NationalIdVerifier {
  countryCode = 'SN';
  idType = 'senegal_cni';

  async verify(input: NationalIdVerifyInput): Promise<NationalIdVerifyResult> {
    return {
      matched: false,
      confidence: 0,
      provider: 'senegal_cni',
      pendingManualReview: true,
      message: 'Senegal CNI integration pending credentials — OCR + manual review',
      biodata: { fullName: input.fullName, idNumber: input.idNumber },
    };
  }
}

export class NationalIdVerificationService {
  private integrations: IntegrationsService;
  private verifiers: NationalIdVerifier[];

  constructor(private db: DatabaseService) {
    this.integrations = new IntegrationsService(db);
    this.verifiers = [
      new GhanaCardVerifier(db, this.integrations),
      new NigeriaNinVerifier(db, this.integrations),
      new CoteDivoireOneciVerifier(),
      new SenegalCniVerifier(),
    ];
  }

  async verifyNationalId(
    countryCode: string,
    idNumber: string,
    fullName: string,
    dateOfBirth?: string
  ) {
    const provider = await this.db.query(
      `SELECT * FROM id_verification_providers
       WHERE country_code = $1 AND is_active = TRUE
       ORDER BY id_type LIMIT 1`,
      [countryCode.toUpperCase()]
    );
    const idType = provider.rows[0]?.id_type;
    const verifier =
      this.verifiers.find(
        (v) =>
          v.countryCode === countryCode.toUpperCase() &&
          (!idType || v.idType === idType)
      ) || this.verifiers.find((v) => v.countryCode === countryCode.toUpperCase());

    if (!verifier) {
      return {
        matched: false,
        confidence: 0,
        provider: 'none',
        pendingManualReview: true,
        message: `No verifier for ${countryCode}`,
      } as NationalIdVerifyResult;
    }
    return verifier.verify({ idNumber, fullName, dateOfBirth });
  }

  idFieldPattern(countryCode: string): { idType: string; label: string; regex: string; example?: string } {
    const map: Record<string, { idType: string; label: string; regex: string; example?: string }> = {
      GH: {
        idType: 'ghana_card',
        label: 'Ghana Card number',
        regex: '^[A-Z]{3}-\\d{9}-\\d$',
        example: 'GHA-123456789-0',
      },
      NG: { idType: 'nigeria_nin', label: 'NIN', regex: '^\\d{11}$', example: '12345678901' },
      CI: {
        idType: 'cote_divoire_oneci',
        label: 'ONECI number',
        regex: '^[A-Z0-9-]{6,20}$',
      },
      SN: { idType: 'senegal_cni', label: 'CNI number', regex: '^[A-Z0-9-]{6,20}$' },
    };
    return map[countryCode.toUpperCase()] || map.GH;
  }

  validateIdNumber(countryCode: string, idNumber: string) {
    const pattern = this.idFieldPattern(countryCode);
    const re = new RegExp(pattern.regex);
    return { valid: re.test(String(idNumber || '').trim()), pattern };
  }
}
