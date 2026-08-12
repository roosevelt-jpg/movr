import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency, formatRelativeTime } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ICONS: Record<string, string> = {
  topup: '↓',
  ride: '🚗',
  points: '✦',
  parcel: '📦',
  withdraw: '↑',
  transfer: '↔',
  tx: '•',
};

type Tx = {
  id: string;
  title: string;
  amount: number;
  unit: string;
  icon: string;
  createdAt: string;
  credit: boolean;
};

/** My Wallet — portfolio card, quick actions, transactions (mockup). */
export default function WalletScreen({
  onTopUp,
  onWithdraw,
  onSettlement,
  onTransfer,
  onPaymentMethods,
  onRedeem,
}: {
  onSend?: () => void;
  onTopUp?: () => void;
  onRedeem?: () => void;
  onWithdraw?: () => void;
  onSettlement?: () => void;
  onTransfer?: () => void;
  onPaymentMethods?: () => void;
}) {
  const [portfolio, setPortfolio] = useState(0);
  const [fiat, setFiat] = useState(0);
  const [points, setPoints] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promise, setPromise] = useState<any>(null);
  const [mobilityCredit, setMobilityCredit] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/wallet/portfolio`, { headers: authHeaders() });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || 'Could not load wallet');
      const d = j?.data;
      if (!d) throw new Error('Wallet data is unavailable');
      setPortfolio(Number(d.portfolioValue ?? 0));
      setFiat(Number(d.fiatBalance ?? 0));
      setPoints(Number(d.points ?? 0));
      setCurrency(d.currency || 'NGN');
      if (Array.isArray(d.transactions)) {
        setTxs(d.transactions.filter((t: Tx) => t.unit !== 'dvt'));
      }
      const cr = await fetch(`${API}/rails/credit`, { headers: authHeaders() }).then((r) => r.json());
      setMobilityCredit(Number(cr?.data?.mobilityCredit || 0));
    } catch (e: any) {
      setPortfolio(0);
      setFiat(0);
      setPoints(0);
      setTxs([]);
      setError(e?.message || 'Could not load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch(`${API}/trust/promise`)
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
  }, [load]);

  const fmtAmt = (t: Tx) => {
    if (t.unit === 'points' || t.unit === 'pts') {
      return `${t.credit || t.amount > 0 ? '+' : ''}${Math.abs(t.amount)} pts`;
    }
    const sign = t.amount >= 0 || t.credit ? '+' : '-';
    return `${sign}${formatCurrency(Math.abs(t.amount), currency)}`;
  };

  const actions = [
    { key: 'topup', label: 'Top Up', icon: '↑', onPress: onTopUp },
    { key: 'credit', label: 'Ride credit', icon: '🎫', onPress: onTopUp },
    { key: 'settle', label: 'Gifts · Settle', icon: '🏦', onPress: onSettlement },
    { key: 'methods', label: 'Cards', icon: '💳', onPress: onPaymentMethods },
    { key: 'withdraw', label: 'Withdraw', icon: '↓', onPress: onWithdraw || onTopUp },
    { key: 'transfer', label: 'Transfer', icon: '↔', onPress: onTransfer },
    { key: 'redeem', label: 'Redeem', icon: '✨', onPress: onRedeem },
  ].filter((a) => a.onPress);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <Text style={styles.title}>My Wallet</Text>
      {promise?.matchSlaText ? (
        <Text style={{ color: '#6ee7b7', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
          {promise.matchSlaText} · {promise.noShowText}
        </Text>
      ) : null}
      {loading ? <Text style={styles.empty}>Loading wallet…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <View style={styles.glowA} />
        <View style={styles.glowB} />
        <Text style={styles.portfolio}>{formatCurrency(portfolio, currency)}</Text>
        <View style={styles.breakdown}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Fiat Balance</Text>
            <Text style={styles.metricVal}>{formatCurrency(fiat, currency)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ride credit</Text>
            <Text style={styles.metricVal}>{formatCurrency(mobilityCredit, currency)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Points</Text>
            <Text style={styles.metricVal}>{Number(points).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable key={a.key} style={styles.actionBtn} onPress={a.onPress}>
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>TRANSACTIONS</Text>
      {txs.length === 0 ? (
        <Text style={styles.empty}>No transactions yet.</Text>
      ) : (
        txs.map((t) => (
          <View key={t.id} style={styles.txRow}>
            <View style={styles.txIcon}>
              <Text style={styles.txIconText}>{ICONS[t.icon] || ICONS.tx}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txTitle}>{t.title}</Text>
              <Text style={styles.txWhen}>{formatRelativeTime(t.createdAt)}</Text>
            </View>
            <Text
              style={[
                styles.txAmt,
                (t.credit || t.amount > 0) && styles.txCredit,
              ]}
            >
              {fmtAmt(t)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: spacing[4] },
  card: {
    borderRadius: 22,
    padding: spacing[5],
    overflow: 'hidden',
    backgroundColor: '#3B5CFF',
    marginBottom: spacing[4],
  },
  glowA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#8E2DE2', opacity: 0.75 },
  glowB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.45,
    left: '40%',
  },
  portfolio: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    zIndex: 1,
  },
  breakdown: {
    flexDirection: 'row',
    marginTop: spacing[5],
    zIndex: 1,
    gap: 8,
  },
  metric: { flex: 1 },
  metricLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  metricVal: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing[5],
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: { color: '#E4E4E7', fontSize: 18 },
  actionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  section: {
    color: '#71717A',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: spacing[3],
  },
  empty: { color: '#71717A', fontSize: 14 },
  error: { color: '#F87171', fontSize: 14, marginBottom: spacing[3] },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F1F1F',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconText: { fontSize: 16, color: '#A1A1AA' },
  txTitle: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  txWhen: { color: '#71717A', fontSize: 12, marginTop: 3 },
  txAmt: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  txCredit: { color: '#22C55E' },
});
