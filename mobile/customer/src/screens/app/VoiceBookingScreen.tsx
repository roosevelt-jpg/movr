import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Speak-to-order — matches voice booking mockup. */
export default function VoiceBookingScreen() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const parse = async (text: string) => {
    const res = await fetch(`${API}/voice/parse-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  };

  const startListen = async () => {
    setListening(true);
    const sample = "I'm going from Osu to the airport";
    setTranscript(sample);
    setListening(false);
    await parse(sample);
  };

  const selectedOpt = result?.options?.find((o: any) => o.code === selected) || result?.options?.[0];

  const confirm = async () => {
    if (!result?.pickup || !result?.destination) return;
    await fetch(`${API}/voice/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupLat: result.pickup.lat,
        pickupLng: result.pickup.lng,
        dropoffLat: result.destination.lat,
        dropoffLng: result.destination.lng,
        pickupAddress: result.pickup.address,
        dropoffAddress: result.destination.address,
        rideType: selected,
        spoken: 'yes',
      }),
    });
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

      {result?.needsClarification ? <Text style={styles.warn}>{result.prompt}</Text> : null}

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

          <Pressable style={styles.cta} onPress={confirm}>
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
  warn: { color: colors.warning, marginBottom: spacing[3] },
  card: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
  },
  routeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
    marginBottom: 4,
  },
  route: { color: colors.pureWhite, fontSize: 18, fontWeight: '700', marginBottom: spacing[4] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing[2],
  },
  optionActive: { borderColor: colors.motionBlue, backgroundColor: 'rgba(0,85,255,0.08)' },
  optionName: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  optionMeta: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  price: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
  priceMuted: { color: colors.textSecondary },
  cta: {
    marginTop: spacing[3],
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.electricViolet,
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
});
