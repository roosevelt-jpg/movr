import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Driver Profile & Ratings — avatar, GOLD badge, stats, breakdown bars, reviews. */
export default function PerformanceScreen({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<any>({
    name: '',
    initials: '',
    role: '',
    location: '',
    sinceYear: null,
    loyaltyBadge: '',
    stats: { trips: 0, rating: 0, dvt: 0, dvtLabel: '', acceptance: 0 },
    ratingBreakdown: [],
    recentReviews: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/driver/profile/ratings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData(j.data);
        else throw new Error('Profile data is unavailable');
      })
      .catch((e) => setError(e?.message || 'Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  const s = data.stats || {};

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 48 }}>
      {loading ? <Text style={styles.state}>Loading profile…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
      ) : null}

      <View style={styles.profile}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <View style={styles.avatarGlowA} />
            <View style={styles.avatarGlowB} />
            <Text style={styles.avatarText}>{data.initials || ''}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{data.loyaltyBadge || ''}</Text>
          </View>
        </View>
        <Text style={styles.name}>{data.name}</Text>
        <Text style={styles.meta}>
          {[data.role, data.location, data.sinceYear ? `Since ${data.sinceYear}` : ''].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View style={styles.stats}>
        {[
          { label: 'Trips', value: String(s.trips ?? 0), color: '#FFFFFF' },
          { label: 'Rating', value: Number(s.rating ?? 0).toFixed(1), color: '#F5C542' },
          { label: 'DVT', value: s.dvtLabel || String(s.dvt ?? 0), color: '#A78BFA' },
          { label: 'Accept', value: `${Math.round(Number(s.acceptance ?? 0))}%`, color: '#FFFFFF' },
        ].map((m) => (
          <View key={m.label} style={styles.stat}>
            <Text style={[styles.statVal, { color: m.color }]}>{m.value}</Text>
            <Text style={styles.statLab}>{m.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>RATING BREAKDOWN</Text>
      {(data.ratingBreakdown || []).map((row: any) => (
        <View key={row.stars} style={styles.barRow}>
          <Text style={styles.barStars}>{row.stars}★</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                Number(row.stars) === 5 && styles.barFillHot,
                { width: `${Math.max(2, Number(row.percent) || 0)}%` },
              ]}
            />
          </View>
          <Text style={styles.barPct}>{row.percent}%</Text>
        </View>
      ))}

      <Text style={[styles.section, { marginTop: spacing[6] }]}>RECENT REVIEWS</Text>
      {!loading && !(data.recentReviews || []).length ? <Text style={styles.state}>No reviews yet.</Text> : null}
      {(data.recentReviews || []).map((r: any, i: number) => (
        <View key={`${r.name}-${i}`} style={styles.review}>
          <View style={styles.reviewTop}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewInit}>{r.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewName}>{r.name}</Text>
              <Text style={styles.reviewWhen}>{r.when}</Text>
            </View>
            <Text style={styles.stars}>{'★'.repeat(Number(r.rating) || 5)}</Text>
          </View>
          {r.comment ? <Text style={styles.reviewBody}>{r.comment}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: spacing[4] },
  backBtn: { paddingVertical: spacing[3] },
  back: { color: '#FFFFFF', fontSize: 22 },
  profile: { alignItems: 'center', marginTop: spacing[2], marginBottom: spacing[5] },
  avatarWrap: { position: 'relative', marginBottom: spacing[3] },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#5B21B6',
  },
  avatarGlowA: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#7C3AED',
    opacity: 0.9,
  },
  avatarGlowB: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#3B82F6',
    opacity: 0.85,
  },
  avatarText: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', zIndex: 1 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#000',
  },
  badgeText: { color: '#052E16', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.45)', marginTop: 6, fontSize: 13 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[6],
    paddingHorizontal: 4,
  },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLab: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  section: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barStars: { color: 'rgba(255,255,255,0.7)', width: 36, fontSize: 13, fontWeight: '600' },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: '#2A2A2A' },
  barFillHot: { backgroundColor: '#6366F1', shadowColor: '#8B5CF6', shadowOpacity: 0.8 },
  barPct: { color: 'rgba(255,255,255,0.55)', width: 36, textAlign: 'right', fontSize: 12 },
  review: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewInit: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  reviewName: { color: '#FFFFFF', fontWeight: '700' },
  reviewWhen: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  stars: { color: '#F5A623', fontSize: 12, letterSpacing: 1 },
  reviewBody: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20 },
  state: { color: '#71717A', textAlign: 'center', marginVertical: spacing[3] },
  error: { color: '#F87171', textAlign: 'center', marginVertical: spacing[3] },
});
