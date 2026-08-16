import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
import { getAppLocale } from '../../services/locale';
import { getCurrentGps } from '../../lib/location';

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

async function recordNativeClip(ms = 6000): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const { Audio } = require('expo-av');
    const perm = await Audio.requestPermissionsAsync();
    if (perm.status !== 'granted') return null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();
    await new Promise((r) => setTimeout(r, ms));
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    if (!uri) return null;
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audioBase64 = globalThis.btoa ? globalThis.btoa(binary) : Buffer.from(bytes).toString('base64');
    return { audioBase64, mimeType: 'audio/m4a' };
  } catch {
    return null;
  }
}

function listenOnce(lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR =
      (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
    if (!SR) {
      reject(new Error('Speech recognition unavailable'));
      return;
    }
    const rec = new SR();
    rec.lang = lang;
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
export default function VoiceBookingScreen({ onBack }: { onBack?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const locale = getAppLocale();
  const countryCode = locale.countryCode || 'GH';

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [booking, setBooking] = useState(false);
  const [gps, setGps] = useState({ lat: 5.6037, lng: -0.187 });

  useEffect(() => {
    getCurrentGps()
      .then((fix) => {
        if (fix) setGps({ lat: fix.latitude, lng: fix.longitude });
      })
      .catch(() => undefined);
  }, []);

  const parse = async (text: string, audio?: { audioBase64: string; mimeType: string }) => {
    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text,
        audioBase64: audio?.audioBase64,
        mimeType: audio?.mimeType,
        currentLat: gps.lat,
        currentLng: gps.lng,
        countryCode,
      }),
    });
    const json = await res.json();
    setResult(json.data);
    if (json.data?.transcript) setTranscript(json.data.transcript);
    setSelected(json.data?.options?.[0]?.code || null);
    if (json.data?.needsClarification) {
      speak(json.data.prompt || 'Where are you going?');
    } else if (json.data?.options?.[0]) {
      const o = json.data.options[0];
      speak(
        `Pickup ${json.data.pickup?.address || 'current location'} to ${json.data.destination?.address}. ${o.name}, ${formatCurrency(o.price, json.data.currency || locale.currencyCode || 'GHS')}.`
      );
    }
  };

  const startListen = async () => {
    setListening(true);
    setMessage('');
    try {
      const stt =
        locale.languageCode === 'fr'
          ? 'fr-FR'
          : locale.languageCode === 'pt'
            ? 'pt-PT'
            : locale.languageCode === 'ar'
              ? 'ar-SA'
              : locale.languageCode === 'es'
                ? 'es-ES'
                : `en-${countryCode}`;
      let heard = '';
      try {
        heard = (await listenOnce(stt))?.trim() || '';
      } catch {
        heard = '';
      }
      if (heard) {
        setTranscript(heard);
        setListening(false);
        await parse(heard);
        return;
      }
      const clip = await recordNativeClip();
      if (!clip) throw new Error('mic');
      setTranscript('Transcribing…');
      setListening(false);
      await parse('', clip);
    } catch {
      setListening(false);
      setMessage('Could not hear that. Allow microphone access and try again.');
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
          countryCode,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        const rideId = json.data?.rideId || json.data?.id;
        setMessage(json.data?.confirmationMessage || 'Ride booked — finding a driver');
        speak(json.data?.confirmationMessage || 'Ride booked. Finding a driver.');
        if (rideId && onBack) {
          // Host navigates via global when available
          try {
            (globalThis as any).__MOVR_NAVIGATE_RIDE__?.(rideId);
          } catch {
            /* optional */
          }
        }
      } else {
        setMessage(json.message || 'Booking failed');
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <View style={styles.root}>
      {onBack ? (
        <Pressable onPress={onBack} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={{ color: '#a78bfa', fontWeight: '700' }}>← Back</Text>
        </Pressable>
      ) : null}
      <View style={styles.top}>
        <Pressable onPress={startListen} style={[styles.mic, listening && styles.micActive]}>
          <View style={styles.micGlowOuter} />
          <View style={styles.micGlowInner} />
          <Text style={styles.micGlyph}>🎤</Text>
        </Pressable>
        <Text style={styles.status}>{listening ? 'Listening...' : 'Tap mic to speak'}</Text>
        <Text style={styles.quote}>
          {transcript ? `“${transcript}”` : '“Take me to the airport”'}
        </Text>
        {message ? <Text style={styles.warn}>{message}</Text> : null}
        {result?.needsClarification ? <Text style={styles.warn}>{result.prompt}</Text> : null}
      </View>

      {result?.options ? (
        <View style={styles.card}>
          <Text style={styles.routeLabel}>PICKUP → DESTINATION</Text>
          <Text style={styles.route}>
            {result.pickup?.address || 'Pickup'} → {result.destination?.address || 'Destination'}
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
                    {formatCurrency(item.price, result.currency || locale.currencyCode || 'GHS')}
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
              {formatCurrency(selectedOpt?.price || 0, result.currency || locale.currencyCode || 'GHS')}
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
