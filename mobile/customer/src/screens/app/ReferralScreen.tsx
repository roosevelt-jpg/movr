import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, FlatList, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Invite friends — shareable code + milestone progress bars. */
export default function ReferralScreen() {
  const [code, setCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalRewards, setTotalRewards] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = authHeaders();
    setLoading(true);
    Promise.all([
      fetch(`${API}/referrals/my-code`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/referrals/progress`, { headers: h }).then((r) => r.json()).catch(() => null),
    ])
      .then(([c, p]) => {
        if (c?.data?.code) setCode(c.data.code);
        if (c?.data?.shareLink) setShareLink(c.data.shareLink);
        setReferrals(p?.data?.referrals || []);
        setTotalRewards(Number(p?.data?.totalRewards || 0));
      })
      .finally(() => setLoading(false));
  }, []);

  const share = async () => {
    await Share.share({
      message: `Join MOVR with my code ${code}: ${shareLink || `https://movr.io/r/${code}`}`,
    });
  };

  const milestoneProgress = (status: string) => {
    if (status === 'qualified') return 1;
    if (status === 'first_ride_completed') return 0.66;
    if (status === 'signed_up') return 0.33;
    return 0.15;
  };

  const statusLabel = (item: any) => {
    if (item.status === 'qualified') {
      return `Qualified · +${item.reward_points || 0} pts`;
    }
    if (item.status === 'first_ride_completed') return 'First ride done';
    return 'Signed up';
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Invite friends</Text>
      <Text style={styles.sub}>Earn points when they qualify (ride + activity)</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your code</Text>
        <Text style={styles.code}>{code || (loading ? '…' : '—')}</Text>
        <Pressable style={styles.shareBtn} onPress={share} disabled={!code}>
          <View style={styles.shareGlow} />
          <Text style={styles.shareText}>↗  Share invite link</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>
        {referrals.length} friends invited
        {totalRewards ? ` · ${totalRewards} pts earned` : ''}
      </Text>

      {!loading && referrals.length === 0 ? (
        <Text style={styles.empty}>No referrals yet — share your code to get started</Text>
      ) : null}

      <FlatList
        data={referrals}
        keyExtractor={(i) => String(i.id)}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>
                {item.first_name || item.email || 'Friend'}
              </Text>
              <Text style={styles.cardStatus}>{statusLabel(item)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${milestoneProgress(item.status) * 100}%` }]}
              />
            </View>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: 6, marginBottom: spacing[5] },
  codeCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  codeLabel: { color: colors.textSecondary, fontSize: 13 },
  code: {
    color: colors.pureWhite,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    marginVertical: spacing[3],
  },
  shareBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  shareGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  shareText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
  section: { color: colors.textSecondary, marginBottom: spacing[3] },
  empty: { color: colors.textSecondary, marginBottom: spacing[4] },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.pureWhite, fontWeight: '700' },
  cardStatus: { color: colors.textSecondary, fontSize: 13 },
  barTrack: {
    marginTop: spacing[3],
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: colors.motionBlue,
  },
});
