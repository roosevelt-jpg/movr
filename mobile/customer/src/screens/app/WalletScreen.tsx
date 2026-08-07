import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency, formatRelativeTime } from '@movr/design-system/format';
import { useWallet } from '../../context/WalletContext';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Wallet — mockup: gradient balance card, Send money / Top up, recent activity badges. */
export default function WalletScreen({
  onSend,
  onTopUp,
  onRedeem,
}: {
  onSend?: () => void;
  onTopUp?: () => void;
  onRedeem?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const { balance: ctxBalance, rewardsBalance, transactions, currency, refresh, dvtBalance, refreshDvt } =
    useWallet();
  const [estimatedDvt, setEstimatedDvt] = useState(0);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);

  useEffect(() => {
    refresh();
    refreshDvt();
    fetch(`${API}/points/estimated-dvt`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.estimatedDvt != null) setEstimatedDvt(Number(j.data.estimatedDvt));
      })
      .catch(() => undefined);
    fetch(`${API}/points/history`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) setPointsHistory(j.data.slice(0, 5));
      })
      .catch(() => undefined);
  }, [refresh, refreshDvt]);

  const dvtDisplay = estimatedDvt || dvtBalance || Math.round(Number(rewardsBalance) / 10);

  const activity = [
    ...transactions.slice(0, 8).map((t) => {
      const type = String(t.type || '').toLowerCase();
      const amt = Number(t.amount);
      const isReward = /reward|points|referral|bonus/.test(type);
      const title =
        t.reference ||
        (type.includes('ride')
          ? 'Ride'
          : type.includes('transfer') || type.includes('sent')
            ? 'Sent'
            : type.includes('topup')
              ? 'Top up'
              : t.type || 'Transaction');
      return {
        id: `w-${t.id}`,
        title,
        when: formatRelativeTime(t.created_at),
        amount: amt,
        kind: 'fiat' as const,
        status: isReward ? 'Reward' : 'Completed',
      };
    }),
    ...pointsHistory.map((p) => ({
      id: `p-${p.id}`,
      title: p.reason || p.activity_type || 'Referral reward',
      when: formatRelativeTime(p.created_at),
      amount: Number(p.points || p.amount || 0),
      kind: 'pts' as const,
      status: 'Reward' as const,
    })),
  ].slice(0, 10);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Wallet</Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceGlowA} />
        <View style={styles.balanceGlowB} />
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.balance}>{formatCurrency(ctxBalance, currency || 'GHS')}</Text>
        <View style={styles.divider} />
        <View style={styles.pointsRow}>
          <View>
            <Text style={styles.label}>Movr points</Text>
            <Text style={styles.points}>{Number(rewardsBalance).toLocaleString()} pts</Text>
          </View>
          <Text style={styles.dvt}>≈ {Number(dvtDisplay).toLocaleString()} DVT at TGE</Text>
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

      <Text style={styles.section}>RECENT ACTIVITY</Text>
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
                  : `${row.amount >= 0 ? '' : '-'}${formatCurrency(Math.abs(row.amount), currency || 'GHS')}`}
              </Text>
              <View style={[styles.badge, row.status === 'Reward' && styles.badgeReward]}>
                <Text
                  style={[styles.badgeText, row.status === 'Reward' && styles.badgeRewardText]}
                >
                  {row.status}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
    balanceCard: {
      borderRadius: 24,
      padding: spacing[5],
      backgroundColor: '#0a1628',
      overflow: 'hidden',
      marginBottom: spacing[4],
    },
    balanceGlowA: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.45,
    },
    balanceGlowB: {
      position: 'absolute',
      right: -40,
      top: -40,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: colors.electricViolet,
      opacity: 0.35,
    },
    label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, zIndex: 1 },
    balance: { color: colors.pureWhite, fontSize: 36, fontWeight: '700', marginTop: 6, zIndex: 1 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: spacing[4] },
    pointsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      zIndex: 1,
    },
    points: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginTop: 4 },
    dvt: { color: '#8eb6ff', fontSize: 13, fontWeight: '600' },
    actions: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
    sendBtn: {
      flex: 1.35,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.electricViolet,
      overflow: 'hidden',
    },
    sendGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.motionBlue,
      opacity: 0.45,
    },
    sendText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
    topUp: {
      flex: 1,
      borderRadius: radius.lg,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    topUpText: { color: colors.pureWhite, fontWeight: '700' },
    section: {
      color: colors.textSecondary,
      fontSize: 12,
      letterSpacing: 0.8,
      fontWeight: '600',
      marginBottom: spacing[3],
    },
    empty: { color: colors.textSecondary, fontSize: 14 },
    item: {
      flexDirection: 'row',
      padding: spacing[4],
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing[3],
    },
    itemTitle: { color: colors.pureWhite, fontWeight: '600' },
    itemWhen: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    itemAmt: { color: colors.pureWhite, fontWeight: '700' },
    ptsAmt: { color: colors.motionBlue },
    badge: {
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,217,122,0.18)',
    },
    badgeReward: { backgroundColor: 'rgba(0,85,255,0.22)' },
    badgeText: { color: colors.success, fontSize: 11, fontWeight: '700' },
    badgeRewardText: { color: colors.motionBlue },
  });
}
