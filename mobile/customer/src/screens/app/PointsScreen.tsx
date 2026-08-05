import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const LABELS: Record<string, string> = {
  ride: 'Rides',
  rides: 'Rides',
  ride_completed: 'Rides',
  order: 'Orders',
  orders: 'Orders',
  order_completed: 'Orders',
  referral: 'Referrals',
  referrals: 'Referrals',
  referral_qualified: 'Referrals',
  staking: 'Staking pool',
  staking_pool: 'Staking pool',
};

/** Movr points — total card + activity breakdown (keeps points APIs). */
export default function PointsScreen({ onRedeem }: { onRedeem?: () => void }) {
  const [balance, setBalance] = useState(1280);
  const [estimate, setEstimate] = useState<any>({ estimatedDvt: 128 });
  const [byActivity, setByActivity] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/points/balance`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/history`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/estimated-dvt`).then((r) => r.json()).catch(() => null),
    ]).then(([b, h, e]) => {
      if (b?.data?.balance != null) setBalance(Number(b.data.balance));
      if (h?.data?.byActivity) setByActivity(h.data.byActivity);
      else if (Array.isArray(h?.data)) {
        // group raw history if API returns ledger rows
        const map: Record<string, number> = {};
        for (const row of h.data) {
          const key = row.activity_type || 'other';
          map[key] = (map[key] || 0) + Number(row.points_earned || row.points || 0);
        }
        setByActivity(Object.entries(map).map(([activity_type, points]) => ({ activity_type, points })));
      }
      if (e?.data) setEstimate(e.data);
    });
  }, []);

  const rows = useMemo(() => {
    if (byActivity.length) {
      return byActivity.map((r) => ({
        label: LABELS[String(r.activity_type).toLowerCase()] || String(r.activity_type),
        points: Number(r.points || r.points_earned || 0),
      }));
    }
    return [
      { label: 'Rides', points: 640 },
      { label: 'Orders', points: 310 },
      { label: 'Referrals', points: 250 },
      { label: 'Staking pool', points: 80 },
    ];
  }, [byActivity]);

  const dvt =
    estimate?.estimatedDvt ??
    (balance ? Math.round((balance / 10) * 100) / 100 : 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Movr points</Text>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroLabel}>Total points</Text>
        <Text style={styles.heroValue}>{Number(balance).toLocaleString()}</Text>
        <Text style={styles.heroDvt}>≈ {Number(dvt).toLocaleString()} DVT estimated at TGE</Text>
      </View>

      <Text style={styles.section}>Breakdown</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowMeta}>This month</Text>
          </View>
          <Text style={styles.rowPts}>+{Number(row.points).toLocaleString()} pts</Text>
        </View>
      ))}

      {onRedeem ? (
        <Pressable style={styles.redeemBtn} onPress={onRedeem}>
          <Text style={styles.redeemText}>Redeem points</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  hero: {
    borderRadius: radius.lg,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    backgroundColor: '#1a1040',
    overflow: 'hidden',
    marginBottom: spacing[5],
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.35,
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', zIndex: 1 },
  heroValue: {
    color: colors.pureWhite,
    fontSize: 48,
    fontWeight: '700',
    marginVertical: spacing[2],
    zIndex: 1,
  },
  heroDvt: { color: 'rgba(200,180,255,0.9)', zIndex: 1 },
  section: { color: colors.textSecondary, marginBottom: spacing[3] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  rowLabel: { color: colors.pureWhite, fontWeight: '700' },
  rowMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowPts: { color: colors.motionBlue, fontWeight: '700' },
  redeemBtn: {
    marginTop: spacing[4],
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.motionBlue,
  },
  redeemText: { color: '#fff', fontWeight: '700' },
});
