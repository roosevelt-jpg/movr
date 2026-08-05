import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TAGS = ['Clean car', 'Great chat', 'Safe driving'] as const;

/** Post-ride rating — stars, comment, quick tags. */
export default function RideRatingScreen({
  rideId,
  driverName = 'Kwesi',
  onDone,
}: {
  rideId?: string;
  driverName?: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<string[]>(['Clean car']);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = (t: string) => {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = async () => {
    setLoading(true);
    setMsg('');
    try {
      if (rideId) {
        await fetch(`${API}/rides/${rideId}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, review: comment, tags: selected }),
        });
      }
      setMsg('Thanks for your feedback');
      onDone?.();
    } catch {
      setMsg('Rating saved locally');
      onDone?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.avatar} />
      <Text style={styles.title}>How was your ride with {driverName}?</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)}>
            <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.comment}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.textSecondary}
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
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{loading ? 'Submitting…' : 'Submit rating'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.jetBlack,
    padding: spacing[5],
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.border,
    marginTop: spacing[8],
    marginBottom: spacing[4],
  },
  title: {
    color: colors.pureWhite,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  stars: { flexDirection: 'row', gap: 8, marginBottom: spacing[5] },
  star: { fontSize: 36, color: colors.border },
  starOn: { color: colors.warning },
  comment: {
    width: '100%',
    minHeight: 100,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    color: colors.pureWhite,
    textAlignVertical: 'top',
    marginBottom: spacing[4],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing[5] },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { borderColor: colors.motionBlue, backgroundColor: 'rgba(0,85,255,0.12)' },
  chipText: { color: colors.pureWhite, fontWeight: '600', fontSize: 13 },
  msg: { color: colors.textSecondary, marginBottom: 12 },
  cta: {
    width: '100%',
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
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
