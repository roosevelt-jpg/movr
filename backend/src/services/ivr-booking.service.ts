import { DatabaseService } from './database.service';
import { VoiceIntentService } from './voice-intent.service';
import { RideBookingService } from './ride-booking.service';
import { ChannelSessionService } from './channel-session.service';
import getLogger from '../utils/logger';

/**
 * Twilio Voice / IVR booking — record → voice-intent → DTMF confirm (Phase 22).
 */
export class IvrBookingService {
  private logger = getLogger('ivr-booking');

  constructor(
    private db: DatabaseService,
    private voice: VoiceIntentService,
    private booking: RideBookingService,
    private sessions: ChannelSessionService,
    private findOrCreateUserByPhone: (phone: string, name?: string) => Promise<any>
  ) {}

  async handleRecording(opts: {
    from: string;
    recordingUrl: string;
  }): Promise<{ say: string; pendingKey: string; conf: number }> {
    const phone = opts.from;
    await this.sessions.rateLimitPhone(phone, 'ivr');

    let transcript = '';
    try {
      const res = await fetch(opts.recordingUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      transcript = await this.voice.transcribeAudio(buf, 'audio/wav');
    } catch (e: any) {
      this.logger.warn('IVR download/transcribe failed', { error: e.message });
    }

    const user = await this.findOrCreateUserByPhone(phone);
    const intent = await this.voice.extractTripIntent(transcript, user.id);

    if (!intent.destination || intent.confidence < 0.45) {
      return {
        say: 'Sorry, I did not catch your destination. Please call again and say where you are going after the beep.',
        pendingKey: '',
        conf: intent.confidence,
      };
    }

    const pickup = intent.origin
      ? await this.voice.geocode(intent.origin)
      : { lat: 5.6037, lng: -0.187 };
    const dest = await this.voice.geocode(intent.destination);
    const estimates = await this.booking.estimateFares(
      pickup.lat,
      pickup.lng,
      dest.lat,
      dest.lng
    );
    const cheapest = estimates.options?.[0];
    const pendingKey = `ivr:${phone}`;
    await this.sessions.setPending(pendingKey, {
      userId: user.id,
      pickup,
      dest,
      destination: intent.destination,
      origin: intent.origin || 'Current location',
      rideType: cheapest?.code || 'standard',
      sourceChannel: 'ivr',
    });

    const price = cheapest?.price ?? '';
    const currency = estimates.currency || 'GHS';
    const surge =
      estimates.surgeReason && Number(estimates.surgeMultiplier) > 1
        ? ` ${estimates.surgeReason}.`
        : '';
    return {
      say: `From ${intent.origin || 'your location'} to ${intent.destination}. ${cheapest?.name || 'Economy'}, ${price} ${currency}.${surge} Press 1 to confirm, or hang up to cancel.`,
      pendingKey,
      conf: intent.confidence,
    };
  }

  async confirm(phone: string) {
    const pending = await this.sessions.getPending(`ivr:${phone}`);
    if (!pending) throw new Error('No pending IVR booking');
    const result = await this.booking.createRideRequest({
      userId: pending.userId,
      pickupLat: pending.pickup.lat,
      pickupLng: pending.pickup.lng,
      dropoffLat: pending.dest.lat,
      dropoffLng: pending.dest.lng,
      pickupAddress: pending.origin,
      dropoffAddress: pending.destination,
      rideType: pending.rideType,
      sourceChannel: 'ivr',
    });
    await this.sessions.clearPending(`ivr:${phone}`);
    return result;
  }
}
