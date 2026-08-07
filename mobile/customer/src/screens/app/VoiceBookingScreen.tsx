import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
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
    }
  } catch {
    /* optional */
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

/** Voice booking — Listening mic, transcript, Economy/Comfort card, Book CTA (Phase 23). */
export default function VoiceBookingScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [booking, setBooking] = useState(false);

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
      speak(
        `Pickup ${json.data.pickup?.address || 'current location'} to ${json.data.destination?.address}. ${o.name}, ${formatCurrency(o.price, json.data.currency || 'GHS')}.`
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
      const sample = "I'm going from Osu to the airport";
      setTranscript(sample);
      setListening(false);
      setMessage('Demo utterance — enable mic for live STT');
      await parse(sample);
    }
  };

  const selectedOpt = result?.options?.find((o: any) => o.code === selected) || result?.options?.[0];

  const confirm = async (spoken?: string) => {
    if (!result?.pickup || !result?.destination) return;
    setBooking(true);
    try {
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
          vehicleTypeCode: selected,
          spoken: spoken || 'yes',
          countryCode: 'GH',
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setMessage('Ride booked — finding a driver');
        speak('Ride booked. Finding a driver.');
      } else {
        setMessage(json.message || 'Booking failed');
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={startListen} style={[styles.mic, listening && styles.micActive]}>
          <View style={styles.micGlowOuter} />
          <View style={styles.micGlowInner} />
          <Text style={styles.micGlyph}>🎤</Text>
        </Pressable>
        <Text style={styles.status}>{listening ? 'Listening...' : 'Tap mic to speak'}</Text>
        <Text style={styles.quote}>
          {transcript ? `“${transcript}”` : '“I\'m going from Osu to the airport”'}
        </Text>
        {message ? <Text style={styles.warn}>{message}</Text> : null}
        {result?.needsClarification ? <Text style={styles.warn}>{result.prompt}</Text> : null}
      </View>

      {result?.options ? (
        <View style={styles.card}>
          <Text style={styles.routeLabel}>PICKUP → DESTINATION</Text>
          <Text style={styles.route}>
            {result.pickup?.address || 'Osu'} → {result.destination?.address || 'Kotoka Airport'}
          </Text>

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
                      {item.etaMinutes != null ? `${item.etaMinutes} min away` : 'Nearby'}
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

          <Pressable
            style={[styles.cta, booking && { opacity: 0.6 }]}
            disabled={booking}
            onPress={() => confirm('yes')}
          >
            <View style={styles.ctaGlow} />
            <Text style={styles.ctaText}>
              Book {selectedOpt?.name || 'ride'} ·{' '}
              {formatCurrency(selectedOpt?.price || 0, result.currency || 'GHS')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.jetBlack,
      padding: spacing[4],
      justifyContent: 'space-between',
    },
    top: { alignItems: 'center', paddingTop: spacing[8] },
    mic: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.electricViolet,
    },
    micActive: { transform: [{ scale: 1.06 }] },
    micGlowOuter: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.55,
    },
    micGlowInner: {
      position: 'absolute',
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.electricViolet,
      opacity: 0.9,
    },
    micGlyph: { fontSize: 34, zIndex: 1 },
    status: { color: colors.textSecondary, marginTop: spacing[4], fontSize: 15 },
    quote: {
      color: colors.pureWhite,
      fontStyle: 'italic',
      fontSize: 16,
      textAlign: 'center',
      marginTop: spacing[2],
      paddingHorizontal: spacing[4],
    },
    warn: { color: colors.warning, marginTop: spacing[3], textAlign: 'center', fontSize: 13 },
    card: {
      width: '100%',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 24,
      padding: spacing[5],
      marginBottom: spacing[4],
    },
    routeLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    route: {
      color: colors.pureWhite,
      fontSize: 18,
      fontWeight: '700',
      marginTop: spacing[2],
      marginBottom: spacing[4],
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[3],
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
      marginBottom: spacing[2],
    },
    optionActive: {
      borderColor: colors.motionBlue,
      backgroundColor: 'rgba(0,85,255,0.08)',
    },
    optionName: { color: colors.pureWhite, fontWeight: '700' },
    optionMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    price: { color: colors.pureWhite, fontWeight: '700' },
    priceMuted: { color: colors.textSecondary },
    cta: {
      marginTop: spacing[3],
      borderRadius: radius.pill,
      paddingVertical: spacing[4],
      alignItems: 'center',
      backgroundColor: colors.electricViolet,
      overflow: 'hidden',
    },
    ctaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.4,
    },
    ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1, fontSize: 15 },
  });
}
