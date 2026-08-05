import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import { useWallet } from '../../context/WalletContext';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Wallet — balance card, points/DVT, send/top-up, recent activity. */
export default function WalletScreen({
  onSend,
  onTopUp,
  onRedeem,
}: {
  onSend?: () => void;
  onTopUp?: () => void;
  onRedeem?: () => void;
}) {
  const { dvtBalance, refreshDvt } = useWallet();
  const [balance, setBalance] = useState(0);
  const [points, setPoints] = useState(0);
  const [estimatedDvt, setEstimatedDvt] = useState(0);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    refreshDvt();
    fetch(`${API}/wallet`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.balance_fiat != null) setBalance(Number(j.data.balance_fiat));
        if (j?.data?.points_balance != null) setPoints(Number(j.data.points_balance));
      })
      .catch(() => undefined);
    fetch(`${API}/points/estimated-dvt`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.estimatedDvt != null) setEstimatedDvt(Number(j.data.estimatedDvt));
        if (j?.data?.points != null) setPoints(Number(j.data.points));
      })
      .catch(() => undefined);
    fetch(`${API}/wallet/transactions`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) {
          setActivity(
            j.data.slice(0, 10).map((t: any) => ({
              id: t.id,
              title: t.type || t.reference || 'Transaction',
              when: t.created_at ? new Date(t.created_at).toLocaleString() : '',
              amount: Number(t.amount),
              kind: 'fiat',
              status: 'Completed',
            }))
          );
        }
      })
      .catch(() => undefined);
  }, []);

  const dvtDisplay = estimatedDvt || dvtBalance || 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Wallet</Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceGlow} />
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.balance}>{formatCurrency(balance, 'GHS')}</Text>
        <View style={styles.divider} />
        <View style={styles.pointsRow}>
          <View>
            <Text style={styles.label}>Movr points</Text>
            <Text style={styles.points}>{points.toLocaleString()} pts</Text>
          </View>
          <Text style={styles.dvt}>≈ {dvtDisplay.toLocaleString()} DVT at TGE</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.sendBtn} onPress={onSend}>
          <View style={styles.sendGlow} />
          <Text style={styles.sendText}>✈  Send money</Text>
        </Pressable>
        <Pressable style={styles.topUp} onPress={onTopUp}>
          <Text style={styles.topUpText}>+ Top up</Text>
        </Pressable>
      </View>

      {onRedeem ? (
        <Pressable onPress={onRedeem} style={{ marginBottom: spacing[4] }}>
          <Text style={{ color: colors.motionBlue, textAlign: 'center' }}>Redeem points →</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Recent activity</Text>
      {activity.length === 0 ? (
        <Text style={styles.empty}>No transactions yet.</Text>
      ) : (
        activity.map((row) => (
          <View key={row.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{row.title}</Text>
              <Text style={styles.itemWhen}>{row.when}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.itemAmt, row.kind === 'pts' && styles.ptsAmt]}>
                {row.kind === 'pts'
                  ? `${row.amount > 0 ? '+' : ''}${row.amount} pts`
                  : `${row.amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(row.amount), 'GHS')}`}
              </Text>
              <View style={[styles.badge, row.status === 'Reward' && styles.badgeReward]}>
                <Text style={styles.badgeText}>{row.status}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  balanceCard: {
    borderRadius: radius.lg,
    padding: spacing[5],
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  balanceGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.35,
  },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, zIndex: 1 },
  balance: { color: colors.pureWhite, fontSize: 36, fontWeight: '700', marginTop: 6, zIndex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: spacing[4] },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 },
  points: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginTop: 4 },
  dvt: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  sendBtn: {
    flex: 1.4,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  sendGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.4,
  },
  sendText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
  topUp: {
    flex: 1,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topUpText: { color: colors.pureWhite, fontWeight: '700' },
  section: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing[3] },
  empty: { color: colors.textSecondary, fontSize: 14 },
  item: {
    flexDirection: 'row',
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing[3],
  },
  itemTitle: { color: colors.pureWhite, fontWeight: '600' },
  itemWhen: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  itemAmt: { color: colors.pureWhite, fontWeight: '700' },
  ptsAmt: { color: colors.motionBlue },
  badge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(63,112,72,0.35)',
  },
  badgeReward: { backgroundColor: 'rgba(106,0,255,0.35)' },
  badgeText: { color: colors.pureWhite, fontSize: 11, fontWeight: '600' },
});
