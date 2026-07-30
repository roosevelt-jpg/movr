import axios from 'axios';
import { DatabaseService } from './database.service';
import getLogger from '../utils/logger';

export interface TripIntent {
  origin: string | null;
  destination: string | null;
  rideTypePreference: string | null;
  confidence: number;
}

/**
 * Shared voice transcription + intent extraction (Phase 23).
 * Used by in-app mic, WhatsApp/Telegram voice notes, and IVR recordings.
 */
export class VoiceIntentService {
  private logger = getLogger('voice-intent');

  constructor(private db: DatabaseService) {}

  async transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY missing — returning empty transcript');
      return '';
    }

    try {
      // Node 18+ Blob / FormData
      const form = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      form.append('file', blob, 'audio.webm');
      form.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form as any,
      });
      const data: any = await response.json();
      return data?.text || '';
    } catch (error: any) {
      this.logger.warn('Whisper transcription failed', { error: error.message });
      return '';
    }
  }

  async extractTripIntent(utterance: string, userId?: string): Promise<TripIntent> {
    const apiKey = process.env.OPENAI_API_KEY;
    let intent: TripIntent = {
      origin: null,
      destination: null,
      rideTypePreference: null,
      confidence: 0.3,
    };

    if (apiKey && utterance) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'Extract ride booking intent. Return JSON only: {origin, destination, rideTypePreference, confidence}. Use null when unknown. confidence 0-1.',
              },
              { role: 'user', content: utterance },
            ],
          },
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        const parsed = JSON.parse(response.data.choices[0].message.content);
        intent = {
          origin: parsed.origin || null,
          destination: parsed.destination || null,
          rideTypePreference: parsed.rideTypePreference || null,
          confidence: Number(parsed.confidence ?? 0.5),
        };
      } catch (error: any) {
        this.logger.warn('LLM intent parse failed', { error: error.message });
        intent = this.heuristicParse(utterance);
      }
    } else {
      intent = this.heuristicParse(utterance);
    }

    if (userId) {
      intent = await this.resolveSavedAddresses(userId, intent);
    }

    if (intent.confidence < 0.5 || !intent.destination) {
      await this.db.query(
        `INSERT INTO voice_parse_failures (user_id, utterance, parsed_json, confidence, channel)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [userId || null, utterance, JSON.stringify(intent), intent.confidence, 'voice']
      );
    }

    return intent;
  }

  async confirmIntent(utterance: string): Promise<boolean> {
    const t = (utterance || '').toLowerCase().trim();
    return /^(yes|yeah|yep|confirm|book( it)?|ok|okay|sure)$/i.test(t);
  }

  private heuristicParse(utterance: string): TripIntent {
    const text = utterance || '';
    const fromTo = text.match(/from\s+(.+?)\s+to\s+(.+)/i);
    const goingTo = text.match(/(?:going to|heading to|to)\s+(.+)/i);
    if (fromTo) {
      return {
        origin: fromTo[1].trim(),
        destination: fromTo[2].trim().replace(/[.!?].*$/, ''),
        rideTypePreference: null,
        confidence: 0.55,
      };
    }
    if (goingTo) {
      return {
        origin: null,
        destination: goingTo[1].trim().replace(/[.!?].*$/, ''),
        rideTypePreference: null,
        confidence: 0.45,
      };
    }
    return { origin: null, destination: null, rideTypePreference: null, confidence: 0.2 };
  }

  private async resolveSavedAddresses(userId: string, intent: TripIntent): Promise<TripIntent> {
    const next = { ...intent };
    for (const key of ['origin', 'destination'] as const) {
      const val = next[key];
      if (!val) continue;
      const label = val.toLowerCase();
      if (label === 'home' || label === 'work') {
        const row = await this.db.query(
          `SELECT address, lat, lng FROM saved_addresses
           WHERE user_id = $1 AND LOWER(label) = $2 LIMIT 1`,
          [userId, label]
        );
        if (row.rows[0]) {
          next[key] = row.rows[0].address;
          (next as any)[`${key}Lat`] = row.rows[0].lat;
          (next as any)[`${key}Lng`] = row.rows[0].lng;
          next.confidence = Math.min(1, next.confidence + 0.15);
        }
      }
    }
    return next;
  }

  /** Lightweight geocode stub — replace with Google/Mapbox via integrations hub */
  async geocode(address: string, fallback?: { lat: number; lng: number }) {
    if (!address && fallback) return fallback;
    // Accra-centric demo geocode
    const known: Record<string, { lat: number; lng: number }> = {
      osu: { lat: 5.5557, lng: -0.182 },
      airport: { lat: 5.6052, lng: -0.1668 },
      accra: { lat: 5.6037, lng: -0.187 },
      kumasi: { lat: 6.6885, lng: -1.6244 },
    };
    const key = Object.keys(known).find((k) => address.toLowerCase().includes(k));
    if (key) return known[key];
    return fallback || { lat: 5.6037, lng: -0.187 };
  }
}
