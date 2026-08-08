import twilio from 'twilio';
import winston from 'winston';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';

/**
 * SMS + WhatsApp delivery for auth OTPs.
 * The verified phone number is the same channel used for WhatsApp messages later.
 */
export class OtpDeliveryService {
  private db: DatabaseService;
  private integrations: IntegrationsService;
  private logger: winston.Logger;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    this.integrations = new IntegrationsService(this.db);
    this.logger = winston.createLogger({
      defaultMeta: { service: 'otp-delivery' },
      transports: [new winston.transports.Console()],
    });
  }

  private async twilioCreds(): Promise<{
    sid: string | null;
    token: string | null;
    smsFrom: string | null;
    waFrom: string | null;
  }> {
    const sid =
      (await this.integrations
        .resolveSecret('twilio', ['account_sid', 'sid'], ['TWILIO_ACCOUNT_SID'])
        .catch(() => null)) ||
      (await this.integrations
        .resolveSecret('whatsapp', ['account_sid', 'sid'], ['TWILIO_ACCOUNT_SID'])
        .catch(() => null));
    const token =
      (await this.integrations
        .resolveSecret('twilio', ['auth_token', 'secret_key'], ['TWILIO_AUTH_TOKEN'])
        .catch(() => null)) ||
      (await this.integrations
        .resolveSecret('whatsapp', ['auth_token', 'secret_key'], ['TWILIO_AUTH_TOKEN'])
        .catch(() => null));
    const smsFrom =
      (await this.integrations
        .resolveSecret('twilio', ['from_number', 'phone_number'], ['TWILIO_PHONE_NUMBER', 'TWILIO_PROXY_NUMBER'])
        .catch(() => null)) ||
      process.env.TWILIO_PHONE_NUMBER ||
      process.env.TWILIO_PROXY_NUMBER ||
      null;
    const waFrom =
      (await this.integrations
        .resolveSecret('whatsapp', ['from_number', 'whatsapp_number'], [
          'TWILIO_WHATSAPP_NUMBER',
          'WHATSAPP_BUSINESS_NUMBER',
        ])
        .catch(() => null)) ||
      process.env.TWILIO_WHATSAPP_NUMBER ||
      process.env.WHATSAPP_BUSINESS_NUMBER ||
      null;
    return { sid, token, smsFrom, waFrom };
  }

  private normalizeE164(phone: string): string {
    const raw = String(phone || '').replace(/[\s\-()]/g, '');
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    if (raw.startsWith('00')) return `+${raw.slice(2)}`;
    return raw.startsWith('+') ? raw : `+${raw.replace(/^\+/, '')}`;
  }

  private client(sid: string, token: string) {
    return twilio(sid, token);
  }

  async sendSms(to: string, body: string): Promise<{ sent: boolean; skipped?: string }> {
    const phone = this.normalizeE164(to);
    if (!phone) return { sent: false, skipped: 'invalid_phone' };
    const { sid, token, smsFrom } = await this.twilioCreds();
    if (!sid || !token || !smsFrom) {
      this.logger.warn('SMS skipped — Twilio not configured', { to: phone });
      return { sent: false, skipped: 'twilio_not_configured' };
    }
    try {
      await this.client(sid, token).messages.create({
        body,
        from: smsFrom,
        to: phone,
      });
      this.logger.info('SMS sent', { to: phone });
      return { sent: true };
    } catch (error: any) {
      this.logger.error('SMS send failed', { to: phone, error: error?.message });
      return { sent: false, skipped: error?.message || 'sms_failed' };
    }
  }

  async sendWhatsApp(to: string, body: string): Promise<{ sent: boolean; skipped?: string }> {
    const phone = this.normalizeE164(to);
    if (!phone) return { sent: false, skipped: 'invalid_phone' };
    const { sid, token, waFrom } = await this.twilioCreds();
    if (!sid || !token || !waFrom) {
      this.logger.warn('WhatsApp skipped — number not configured', { to: phone });
      return { sent: false, skipped: 'whatsapp_not_configured' };
    }
    const from = waFrom.startsWith('whatsapp:') ? waFrom : `whatsapp:${waFrom}`;
    const dest = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    try {
      await this.client(sid, token).messages.create({
        body,
        from,
        to: dest,
      });
      this.logger.info('WhatsApp OTP sent', { to: phone });
      return { sent: true };
    } catch (error: any) {
      this.logger.error('WhatsApp send failed', { to: phone, error: error?.message });
      return { sent: false, skipped: error?.message || 'whatsapp_failed' };
    }
  }

  /** Phone verification OTP — SMS + WhatsApp (same number used for later WA messages). */
  async sendPhoneVerificationOtp(phone: string, code: string) {
    const body = `Your Movr verification code is ${code}. It expires in 10 minutes. This number will be used for WhatsApp updates from Movr.`;
    const [sms, wa] = await Promise.all([
      this.sendSms(phone, body),
      this.sendWhatsApp(phone, body),
    ]);
    return { sms, whatsapp: wa };
  }

  async sendPasswordResetSms(phone: string, code: string) {
    return this.sendSms(
      phone,
      `Your Movr password reset code is ${code}. It expires in 10 minutes.`
    );
  }
}

let singleton: OtpDeliveryService | null = null;
export function getOtpDeliveryService(db?: DatabaseService) {
  if (!singleton) singleton = new OtpDeliveryService(db);
  return singleton;
}
