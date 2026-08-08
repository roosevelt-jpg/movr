import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const EARN_ICONS: Record<string, string> = {
  car: '🚗',
  bag: '🛍',
  people: '👥',
  box: '📦',
};

const AVATAR_BG = ['#F97316', '#71717A', '#8E2DE2', '#3B82F6', '#22C55E'];

/** Rewards — points, Gold→Platinum progress, earn grid, leaderboard (mockup). */
export default function RewardsScreen({ onRefer }: { onRefer?: () => void }) {
  const [data, setData] = useState<any>({
    points: 850,
    tierLabel: 'Gold Tier',
    nextTier: 'Platinum',
    pointsAway: 150,
    currentTierMin: 500,
    nextTierMin: 1000,
    progress: 0.7,
    earnCards: [
      { id: 'ride', label: 'Ride', subtitle: '+10 pts per ride', icon: 'car' },
      { id: 'shop', label: 'Shop', subtitle: '+5 pts per order', icon: 'bag' },
      { id: 'refer', label: 'Refer Friends', subtitle: '+50 pts per referral', icon: 'people' },
      { id: 'deliver', label: 'Deliver', subtitle: '+8 pts per parcel', icon: 'box' },
    ],
    leaderboard: [
      { rank: 1, name: 'Olumide Adebayo', initials: 'OA', points: 2340, isYou: false },
      { rank: 2, name: 'Chioma Ferreira', initials: 'CF', points: 1980, isYou: false },
      { rank: 7, name: 'You', initials: 'KA', points: 850, isYou: true },
    ],
  });

  useEffect(() => {
    fetch(`${API}/points/rewards-hub`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData((d: any) => ({ ...d, ...j.data }));
      })
      .catch(() => undefined);
  }, []);

  const pts = Number(data.points || 0);
  const progress = Math.min(1, Math.max(0.08, Number(data.progress || 0.7)));

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.header}>
        <Text style={styles.title}>Rewards</Text>
        <View style={styles.tierPill}>
          <Text style={styles.tierIcon}>🏆</Text>
          <Text style={styles.tierText}>{data.tierLabel || 'Gold Tier'}</Text>
        </View>
      </View>

      <View style={styles.pointsCard}>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsBig}>{pts.toLocaleString()} pts</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.nextLabel}>Next: {data.nextTier || 'Platinum'}</Text>
            <Text style={styles.away}>
              {Number(data.pointsAway || 0).toLocaleString()} pts away
            </Text>
          </View>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.barLabels}>
          <Text style={styles.barLab}>
            Gold ({Number(data.currentTierMin || 500).toLocaleString()})
          </Text>
          <Text style={styles.barLab}>
            Platinum ({Number(data.nextTierMin || 1000).toLocaleString()})
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Earn Points</Text>
      <View style={styles.earnGrid}>
        {(data.earnCards || []).map((c: any) => (
          <Pressable
            key={c.id}
            style={styles.earnCard}
            onPress={() => (c.id === 'refer' ? onRefer?.() : undefined)}
          >
            <Text style={styles.earnIcon}>{EARN_ICONS[c.icon] || '✨'}</Text>
            <Text style={styles.earnLabel}>{c.label}</Text>
            <Text style={styles.earnSub}>{c.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Leaderboard</Text>
      {(data.leaderboard || []).map((r: any, i: number) => (
        <View key={`${r.rank}-${r.name}`} style={[styles.rankRow, r.isYou && styles.rankYou]}>
          <Text style={[styles.rankNum, r.rank === 1 && styles.rankGold, r.isYou && styles.rankPurple]}>
            {r.rank}
          </Text>
          <View
            style={[
              styles.avatar,
              { backgroundColor: AVATAR_BG[i % AVATAR_BG.length] },
            ]}
          >
            <Text style={styles.avatarText}>{r.initials || '?'}</Text>
          </View>
          <Text style={styles.rankName}>{r.isYou ? 'You' : r.name}</Text>
          <Text
            style={[
              styles.rankPts,
              r.rank === 1 && styles.rankGold,
              r.isYou && styles.rankPurple,
            ]}
          >
            {Number(r.points || 0).toLocaleString()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[5],
    marginBottom: spacing[4],
  },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1917',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A16207',
  },
  tierIcon: { fontSize: 14 },
  tierText: { color: '#EAB308', fontWeight: '700', fontSize: 13 },
  pointsCard: {
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsBig: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  nextLabel: { color: '#A1A1AA', fontSize: 13 },
  away: { color: '#A78BFA', fontWeight: '700', marginTop: 2 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#27272A',
    marginTop: spacing[4],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#8E2DE2',
  },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barLab: { color: '#71717A', fontSize: 12 },
  section: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  earnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing[5] },
  earnCard: {
    width: '47%',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[3],
  },
  earnIcon: { fontSize: 22, marginBottom: 8 },
  earnLabel: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  earnSub: { color: '#A78BFA', fontSize: 12, marginTop: 4 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderRadius: 14,
  },
  rankYou: { borderWidth: 1.5, borderColor: '#8E2DE2', backgroundColor: '#8E2DE218' },
  rankNum: { width: 28, color: '#A1A1AA', fontWeight: '800', fontSize: 16 },
  rankGold: { color: '#EAB308' },
  rankPurple: { color: '#A78BFA' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  rankName: { flex: 1, color: '#FFF', fontWeight: '600' },
  rankPts: { color: '#FFF', fontWeight: '800' },
});
