import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, FlatList } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function ReferralScreen() {
  const [code, setCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalRewards, setTotalRewards] = useState(0);

  useEffect(() => {
    fetch(`${API}/referrals/my-code`)
      .then((r) => r.json())
      .then((j) => {
        setCode(j?.data?.code || '');
        setShareLink(j?.data?.shareLink || '');
      })
      .catch(() => undefined);
    fetch(`${API}/referrals/progress`)
      .then((r) => r.json())
      .then((j) => {
        setReferrals(j?.data?.referrals || []);
        setTotalRewards(j?.data?.totalRewards || 0);
      })
      .catch(() => undefined);
  }, []);

  const share = async () => {
    await Share.share({ message: `Join MOVR with my code ${code}: ${shareLink}` });
  };

  const milestoneProgress = (status: string) => {
    if (status === 'qualified') return 1;
    if (status === 'first_ride_completed') return 0.66;
    return 0.33;
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Referrals</Text>
      <Text style={styles.code}>{code || '—'}</Text>
      <Text style={styles.meta}>Rewards earned: {totalRewards} pts</Text>
      <Button label="Share code" onPress={share} />

      <FlatList
        style={{ marginTop: spacing[5] }}
        data={referrals}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.first_name || item.email}</Text>
            <Text style={styles.meta}>{item.status}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${milestoneProgress(item.status) * 100}%` }]} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  code: { color: colors.electricViolet, fontSize: 28, fontWeight: '700', marginVertical: spacing[3] },
  meta: { color: colors.textSecondary, marginBottom: spacing[3] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTitle: { color: colors.pureWhite, fontWeight: '600' },
  barTrack: {
    marginTop: spacing[3],
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: 6, backgroundColor: colors.motionBlue },
});
