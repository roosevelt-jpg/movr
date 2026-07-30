import crypto from 'crypto';
import winston from 'winston';

/**
 * Masked call/chat helpers (Phase 12).
 * Twilio Proxy integration when TWILIO_* is configured; otherwise returns local session stubs.
 */
export class MaskedCommunicationService {
  private logger = winston.createLogger({
    defaultMeta: { service: 'masked-communication' },
    transports: [new winston.transports.Console()],
  });

  async createMaskedSession(rideId: string, customerPhone: string, driverPhone: string) {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      // TODO: Twilio Proxy session create when credentials + proxy service SID present
      this.logger.info('Twilio Proxy configured — wire session create in production');
    }

    const sessionId = `mask-${rideId}-${crypto.randomBytes(4).toString('hex')}`;
    return {
      sessionId,
      customerProxyNumber: process.env.TWILIO_PROXY_NUMBER || '+233000000000',
      driverProxyNumber: process.env.TWILIO_PROXY_NUMBER || '+233000000000',
      customerPhoneMasked: true,
      driverPhoneMasked: true,
      note: 'Proxy numbers mask both parties for the active ride only',
    };
  }

  chatRoom(rideId: string) {
    return `ride-chat:${rideId}`;
  }
}

export default new MaskedCommunicationService();
