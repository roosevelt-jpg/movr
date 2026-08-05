import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const LABELS: Record<string, string> = {
  ride_completed: 'Rides',
  ride: 'Rides',
  rides: 'Rides',
  order_completed: 'Orders',
  order: 'Orders',
  orders: 'Orders',
  delivery_completed: 'Orders',
  referral_qualified: 'Referrals',
  referral_confirmed: 'Referrals',
  referral: 'Referrals',
  staking_accrual: 'Staking',
  staking: 'Staking',
  stake_created: 'Staking',
};

const BREAKDOWN_ORDER = ['Rides', 'Orders', 'Referrals', 'Staking'];

/** Pre-launch points — total, activity bars, estimated DVT at TGE. */
export default function PointsScreen({ onRedeem }: { onRedeem?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [balance, setBalance] = useState(0);
  const [estimate, setEstimate] = useState<{ estimatedDvt?: number; conversionRate?: number }>({});
  const [byActivity, setByActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const h = authHeaders();
    Promise.all([
      fetch(`${API}/points/balance`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/history`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/estimated-dvt`, { headers: h }).then((r) => r.json()).catch(() => null),
    ])
      .then(([b, hist, e]) => {
        if (b?.data?.balance != null) setBalance(Number(b.data.balance));
        if (hist?.data?.byActivity) setByActivity(hist.data.byActivity);
        if (e?.data) setEstimate(e.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const map: Record<string, number> = {
      Rides: 0,
      Orders: 0,
      Referrals: 0,
      Staking: 0,
    };
    for (const r of byActivity) {
      const label = LABELS[String(r.activity_type || '').toLowerCase()] || null;
      if (!label || !(label in map)) continue;
      map[label] += Number(r.points || r.points_earned || 0);
    }
    return BREAKDOWN_ORDER.map((label) => ({ label, points: map[label] }));
  }, [byActivity]);

  const maxPts = Math.max(1, ...rows.map((r) => r.points));
  const dvt = estimate?.estimatedDvt ?? balance * Number(estimate?.conversionRate || 0.01);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Movr points</Text>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroLabel}>Total points</Text>
        <Text style={styles.heroValue}>
          {loading ? '…' : Number(balance).toLocaleString()}
        </Text>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Estimated DVT at TGE: {Number(dvt).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </Text>
          {estimate?.conversionRate != null ? (
            <Text style={styles.bannerMeta}>
              Rate · {Number(estimate.conversionRate)} pts→DVT
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.section}>Breakdown by activity</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowPts}>+{Number(row.points).toLocaleString()} pts</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(4, (row.points / maxPts) * 100)}%` },
              ]}
            />
          </View>
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

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  hero: {
    borderRadius: radius.lg,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    backgroundColor: colors.surface,
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
  banner: {
    marginTop: spacing[3],
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  bannerText: { color: colors.pureWhite, fontWeight: '600', fontSize: 13 },
  bannerMeta: { color: 'rgba(200,180,255,0.85)', fontSize: 11, marginTop: 2 },
  section: { color: colors.textSecondary, marginBottom: spacing[3] },
  row: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  rowLabel: { color: colors.pureWhite, fontWeight: '700' },
  rowPts: { color: colors.motionBlue, fontWeight: '700' },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.motionBlue,
  },
  redeemBtn: {
    marginTop: spacing[4],
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.motionBlue,
  },
  redeemText: { color: colors.pureWhite, fontWeight: '700' },
});
}
