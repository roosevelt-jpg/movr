import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Speak-to-order (Phase 23). Visual confirmation always shown before booking.
 */
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
    // On-device STT (expo-speech-recognition) plugs in here; demo uses sample utterance.
    const sample = "I'm going from Osu to the airport";
    setTranscript(sample);
    setListening(false);
    await parse(sample);
  };

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
      <Text style={styles.title}>Speak to order</Text>
      <Pressable
        onPress={startListen}
        style={[styles.mic, listening && styles.micActive]}
      >
        <Text style={styles.micText}>{listening ? 'Listening…' : 'Tap mic'}</Text>
      </Pressable>
      <Text style={styles.transcript}>{transcript || 'Say pickup and destination'}</Text>

      {result?.needsClarification ? (
        <Text style={styles.meta}>{result.prompt}</Text>
      ) : null}

      {result?.options ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {result.pickup?.address} → {result.destination?.address}
          </Text>
          <FlatList
            data={result.options}
            keyExtractor={(i) => i.code}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelected(item.code)}
                style={[styles.option, selected === item.code && styles.optionActive]}
              >
                <Text style={styles.optionText}>
                  {item.name} · {formatCurrency(item.price, result.currency)} · ~{item.etaMinutes}m
                  {item.isRecommended ? ' · Best value' : ''}
                </Text>
              </Pressable>
            )}
          />
          <Button label="Book" onPress={confirm} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginBottom: spacing[4] },
  mic: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.electricViolet,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  micActive: { transform: [{ scale: 1.08 }], borderColor: colors.motionBlue },
  micText: { color: colors.pureWhite, fontWeight: '700' },
  transcript: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing[4] },
  meta: { color: colors.warning, marginBottom: spacing[3] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600' },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  optionActive: { borderColor: colors.electricViolet },
  optionText: { color: colors.pureWhite },
});
