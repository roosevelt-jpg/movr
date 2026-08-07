import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import TipPromptScreen from './TipPromptScreen';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TAGS = ['Clean car', 'Great chat', 'Safe driving'] as const;
const DEMO_RIDE = 'f3000000-0000-4000-8000-0000000000a9';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Post-ride rating — stars, comment, quick tags (mockup). */
export default function RideRatingScreen({
  rideId = DEMO_RIDE,
  driverName = 'Kwesi',
  onDone,
}: {
  rideId?: string;
  driverName?: string;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<'rate' | 'tip'>('rate');
  const [name, setName] = useState(driverName);
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!rideId) return;
    fetch(`${API}/rides/${rideId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data?.driver?.name;
        if (d) setName(d.split(' ')[0] || d);
      })
      .catch(() => undefined);
  }, [rideId]);

  const toggle = (t: string) => {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = async () => {
    setLoading(true);
    setMsg('');
    try {
      if (rideId) {
        const res = await fetch(`${API}/rides/${rideId}/rate`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ rating, review: comment, tags: selected }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || 'Failed to save rating');
      }
      setMsg('Thanks for your feedback');
      setStep('tip');
    } catch (e: any) {
      setMsg(e.message || 'Could not save rating');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'tip') {
    return (
      <TipPromptScreen
        rideId={rideId}
        driverName={name}
        onSkip={onDone}
        onDone={() => onDone?.()}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.avatar} />
      <Text style={styles.title}>How was your ride with {name}?</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)}>
            <Text style={[styles.star, n <= rating ? styles.starOn : styles.starOff]}>★</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.comment}
        placeholder="Add a comment (optional)"
        placeholderTextColor="#71717A"
        multiline
        value={comment}
        onChangeText={setComment}
      />

      <View style={styles.chips}>
        {TAGS.map((t) => {
          const on = selected.includes(t);
          return (
            <Pressable
              key={t}
              onPress={() => toggle(t)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={styles.chipText}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Submitting…' : 'Submit rating'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    padding: spacing[5],
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2A2A2A',
    marginTop: spacing[8],
    marginBottom: spacing[4],
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  stars: { flexDirection: 'row', gap: 10, marginBottom: spacing[5] },
  star: { fontSize: 36 },
  starOn: { color: '#F5C542' },
  starOff: { color: '#3F3F46' },
  comment: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    color: '#FFFFFF',
    textAlignVertical: 'top',
    marginBottom: spacing[4],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing[5],
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { borderColor: '#3B5CFF', backgroundColor: 'rgba(59,92,255,0.15)' },
  chipText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  msg: { color: '#A1A1AA', marginBottom: 12 },
  cta: {
    width: '100%',
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0F766E',
  },
  ctaLeft: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F766E' },
  ctaRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.7,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
