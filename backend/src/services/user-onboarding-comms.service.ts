import winston from 'winston';
import { DatabaseService } from './database.service';
import { getEmailService } from './email.service';
import { getOtpDeliveryService } from './otp-delivery.service';

export type OnboardingUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  firstName?: string | null;
  user_type?: string | null;
  userType?: string | null;
};

type PersistOtpFn = (opts: {
  identifier: string;
  code: string;
  purpose: 'reset' | 'signup';
  userId?: string;
}) => Promise<unknown>;

/**
 * After signup: CEO welcome email + email OTP + phone SMS/WhatsApp OTP.
 */
export class UserOnboardingCommsService {
  private db: DatabaseService;
  private logger: winston.Logger;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    this.logger = winston.createLogger({
      defaultMeta: { service: 'onboarding-comms' },
      transports: [new winston.transports.Console()],
    });
  }

  private code() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  async afterSignup(
    user: OnboardingUser,
    persistOtp: PersistOtpFn
  ): Promise<{
    welcomeEmail?: { sent: boolean; skipped?: string };
    emailVerification?: { sent: boolean; skipped?: string; code?: string };
    phoneVerification?: {
      sms: { sent: boolean; skipped?: string };
      whatsapp: { sent: boolean; skipped?: string };
      code?: string;
    };
  }> {
    const email = user.email ? String(user.email).trim().toLowerCase() : '';
    const phone = user.phone ? String(user.phone).replace(/[\s\-()]/g, '') : '';
    const firstName = user.first_name || user.firstName || null;
    const userType = user.user_type || user.userType || 'customer';
    const emailSvc = getEmailService(this.db);
    const otpDelivery = getOtpDeliveryService(this.db);
    const out: any = {};

    if (email && email.includes('@') && !email.endsWith('@phone.movr')) {
      try {
        out.welcomeEmail = await emailSvc.sendWelcome({
          to: email,
          firstName,
          userType,
        });
      } catch (e: any) {
        this.logger.warn('Welcome email failed', { error: e?.message });
        out.welcomeEmail = { sent: false, skipped: e?.message };
      }

      try {
        const code = this.code();
        await persistOtp({
          identifier: email,
          code,
          purpose: 'signup',
          userId: user.id,
        });
        const sent = await emailSvc.sendEmailVerification({
          to: email,
          firstName,
          code,
        });
        out.emailVerification = {
          ...sent,
          ...(process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP === 'true'
            ? { code }
            : {}),
        };
      } catch (e: any) {
        this.logger.warn('Email verification failed', { error: e?.message });
        out.emailVerification = { sent: false, skipped: e?.message };
      }
    }

    if (phone) {
      try {
        const code = this.code();
        await persistOtp({
          identifier: phone,
          code,
          purpose: 'signup',
          userId: user.id,
        });
        const channels = await otpDelivery.sendPhoneVerificationOtp(phone, code);
        out.phoneVerification = {
          ...channels,
          ...(process.env.NODE_ENV !== 'production' || process.env.EXPOSE_OTP === 'true'
            ? { code }
            : {}),
        };
      } catch (e: any) {
        this.logger.warn('Phone verification failed', { error: e?.message });
        out.phoneVerification = {
          sms: { sent: false, skipped: e?.message },
          whatsapp: { sent: false, skipped: e?.message },
        };
      }
    }

    return out;
  }
}

let singleton: UserOnboardingCommsService | null = null;
export function getUserOnboardingComms(db?: DatabaseService) {
  if (!singleton) singleton = new UserOnboardingCommsService(db);
  return singleton;
}
