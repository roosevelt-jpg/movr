import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function speak(text: string) {
  try {
    const synth = (globalThis as any).speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(text);
      synth.cancel();
      synth.speak(u);
      return;
    }
  } catch {
    /* native TTS optional */
  }
}

function listenOnce(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR =
      (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
    if (!SR) {
      reject(new Error('Speech recognition unavailable'));
      return;
    }
    const rec = new SR();
    rec.lang = 'en-GH';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (interim) (globalThis as any).__movrVoiceInterim = interim;
    };
    rec.onerror = (e: any) => reject(e.error || e);
    rec.onend = () => resolve(finalText || (globalThis as any).__movrVoiceInterim || '');
    rec.start();
  });
}

/** Speak-to-order — STT + confirm → createRideRequest sourceChannel=voice (Phase 23). */
export default function VoiceBookingScreen() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const parse = async (text: string) => {
    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text,
        currentLat: 5.6037,
        currentLng: -0.187,
        countryCode: 'GH',
      }),
    });
    const json = await res.json();
    setResult(json.data);
    setSelected(json.data?.options?.[0]?.code || null);
    if (json.data?.needsClarification) {
      speak(json.data.prompt || 'Where are you going?');
    } else if (json.data?.options?.[0]) {
      const o = json.data.options[0];
      const surge = json.data.surgeReason ? ` ${json.data.surgeReason}.` : '';
      speak(
        `Pickup ${json.data.pickup?.address || 'current location'} to ${json.data.destination?.address}. ${o.name}, ${o.price} ${json.data.currency || 'GHS'}.${surge} Say yes or tap book.`
      );
    }
  };

  const startListen = async () => {
    setListening(true);
    setMessage('');
    try {
      const heard = await listenOnce();
      const text = heard?.trim() || '';
      if (!text) throw new Error('empty');
      setTranscript(text);
      setListening(false);
      await parse(text);
    } catch {
      // Fallback sample when device STT unavailable (dev / Expo Go)
      const sample = "I'm going from Osu to the airport";
      setTranscript(sample);
      setListening(false);
      setMessage('Using demo utterance — enable mic permissions for live STT');
      await parse(sample);
    }
  };

  const selectedOpt = result?.options?.find((o: any) => o.code === selected) || result?.options?.[0];

  useEffect(() => {
    if (selectedOpt && result?.pickup) {
      // visual card is source of truth; TTS already ran on parse
    }
  }, [selectedOpt, result]);

  const confirm = async (spoken?: string) => {
    if (!result?.pickup || !result?.destination) return;
    const res = await fetch(`${API}/voice/confirm`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        pickupLat: result.pickup.lat,
        pickupLng: result.pickup.lng,
        dropoffLat: result.destination.lat,
        dropoffLng: result.destination.lng,
        pickupAddress: result.pickup.address,
        dropoffAddress: result.destination.address,
        rideType: selected,
        spoken: spoken || 'yes',
      }),
    });
    const json = await res.json();
    if (json.status === 'success') {
      setMessage('Ride booked');
      speak('Ride booked. Finding a driver.');
    } else {
      setMessage(json.message || 'Booking failed');
    }
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={startListen} style={[styles.mic, listening && styles.micActive]}>
        <View style={styles.micGlow} />
        <Text style={styles.micGlyph}>🎤</Text>
      </Pressable>
      <Text style={styles.status}>{listening ? 'Listening...' : 'Tap to speak'}</Text>
      <Text style={styles.quote}>
        {transcript ? `“${transcript}”` : '“I\'m going from Osu to the airport”'}
      </Text>
      {message ? <Text style={styles.warn}>{message}</Text> : null}

      {result?.needsClarification ? <Text style={styles.warn}>{result.prompt}</Text> : null}

      {result?.options ? (
        <View style={styles.card}>
          <Text style={styles.routeLabel}>PICKUP → DESTINATION</Text>
          <Text style={styles.route}>
            {result.pickup?.address || 'Osu'} → {result.destination?.address || 'Kotoka Airport'}
          </Text>
          {result.surgeReason ? (
            <Text style={{ color: colors.warning, marginBottom: spacing[2], fontSize: 12 }}>
              {result.surgeReason}
            </Text>
          ) : null}

          <FlatList
            data={result.options}
            keyExtractor={(i) => i.code}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const active = selected === item.code;
              return (
                <Pressable
                  onPress={() => setSelected(item.code)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{item.name}</Text>
                    <Text style={styles.optionMeta}>
                      {item.etaMinutes} min away
                      {item.isRecommended ? ' · Best value' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.price, !active && styles.priceMuted]}>
                    {formatCurrency(item.price, result.currency || 'GHS')}
                  </Text>
                </Pressable>
              );
            }}
          />

          <Pressable style={styles.cta} onPress={() => confirm('yes')}>
            <View style={styles.ctaGlow} />
            <Text style={styles.ctaText}>
              Book {selectedOpt?.name || 'ride'} ·{' '}
              {formatCurrency(selectedOpt?.price || 0, result.currency || 'GHS')}
            </Text>
          </Pressable>
          <Pressable
            style={{ marginTop: spacing[2], padding: spacing[2] }}
            onPress={async () => {
              try {
                const heard = await listenOnce();
                if (/^(yes|book|confirm)/i.test(heard.trim())) await confirm(heard);
                else setMessage('Say yes to confirm');
              } catch {
                setMessage('Tap Book to confirm');
              }
            }}
          >
            <Text style={{ color: colors.motionBlue, textAlign: 'center' }}>Or say “yes”</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.jetBlack,
    padding: spacing[4],
    alignItems: 'center',
  },
  mic: {
    marginTop: spacing[6],
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.electricViolet,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  micActive: { transform: [{ scale: 1.06 }] },
  micGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.5,
  },
  micGlyph: { fontSize: 32, zIndex: 1 },
  status: { color: colors.textSecondary, marginTop: spacing[4], fontSize: 15 },
  quote: {
    color: colors.pureWhite,
    fontStyle: 'italic',
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[5],
    paddingHorizontal: spacing[4],
  },
  warn: { color: colors.warning, marginBottom: spacing[3], textAlign: 'center' },
  card: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  routeLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  route: { color: colors.pureWhite, fontSize: 16, fontWeight: '600', marginVertical: spacing[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionActive: { opacity: 1 },
  optionName: { color: colors.pureWhite, fontWeight: '600' },
  optionMeta: { color: colors.textSecondary, fontSize: 12 },
  price: { color: colors.pureWhite, fontWeight: '700' },
  priceMuted: { color: colors.textSecondary },
  cta: {
    marginTop: spacing[4],
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.35,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
});
