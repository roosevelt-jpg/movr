import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Share } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Payment Successful receipt — txn breakdown (mockup). */
export default function TransactionReceiptScreen({
  rideId,
  onBack,
  onDone,
}: {
  rideId?: string;
  onBack?: () => void;
  onDone?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!rideId) {
      setLoading(false);
      setError('Receipt not found');
      return;
    }
    fetch(`${API}/rides/${rideId}/receipt`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData(j.data);
        else throw new Error('Receipt not found');
      })
      .catch((e) => setError(e?.message || 'Could not load receipt'))
      .finally(() => setLoading(false));
  }, [rideId]);

  const cur = data?.currency || 'NGN';
  const rows = [
    ['Transaction ID', data?.txnRef],
    ['Service', data?.service],
    ['Driver', data?.driverName],
    ['From', data?.from],
    ['To', data?.to],
    ['Distance', data?.distanceLabel],
    ['Base fare', formatCurrency(Number(data?.baseFare || 0), cur)],
    ['Distance charge', formatCurrency(Number(data?.distanceFare || 0), cur)],
  ];

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({
        message: `Movr receipt ${data.txnRef}: ${formatCurrency(Number(data.totalPaid || 0), cur)}`,
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topLine} />
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Receipt</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing[4] }}>
        {loading ? <Text style={styles.when}>Loading receipt…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!data ? null : (
        <>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.status}>{data.statusLabel || 'Payment Successful'}</Text>
        <Text style={styles.amount}>{formatCurrency(Number(data.totalPaid || 0), cur)}</Text>
        <Text style={styles.when}>{data.paidAtLabel}</Text>

        <View style={styles.card}>
          {rows.map(([k, v]) => (
            <View key={String(k)} style={styles.row}>
              <Text style={styles.k}>{k}</Text>
              <Text style={styles.v}>{v}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.k}>Platform fee</Text>
            <Text style={styles.green}>
              {formatCurrency(Number(data?.platformFee ?? 0), cur)}
            </Text>
          </View>
          {Number(data?.dvtDiscount || data?.rewardsDiscount || 0) > 0 ? (
            <View style={styles.row}>
              <Text style={styles.k}>Rewards discount</Text>
              <Text style={styles.green}>
                -{formatCurrency(Number(data.dvtDiscount || data.rewardsDiscount || 0), cur)}
              </Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLab}>Total</Text>
            <Text style={styles.totalVal}>{formatCurrency(Number(data.totalPaid || 0), cur)}</Text>
          </View>
          <View style={styles.keepBox}>
            <Text style={styles.keepText}>
              {data.driverKeepsLabel || 'Driver keeps 100% of this fare'}
            </Text>
            <Text style={styles.keepSub}>
              {data.fairFareNote ||
                'No commission — Movr is funded by driver subscriptions, not your fare.'}
            </Text>
          </View>
        </View>

        <View style={styles.reward}>
          <Text style={styles.rewardIcon}>⚭</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardTitle}>Paid with: {data.paymentMethod || 'Movr Wallet'}</Text>
            <Text style={styles.rewardSub}>Thanks for riding with Movr</Text>
          </View>
        </View>

        <Pressable
          style={styles.referStrip}
          onPress={() => {
            /* parent can wire refer via onDone then navigate */
          }}
        >
          <Text style={styles.referText}>Refer a friend · they ride fair too →</Text>
        </Pressable>
        </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondary} onPress={share}>
          <Text style={styles.secondaryText}>Share</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={onDone || onBack}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  topLine: {
    height: 3,
    backgroundColor: '#7C3AED',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  back: { color: '#FFFFFF', fontSize: 22 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing[4],
  },
  checkMark: { color: '#000000', fontSize: 36, fontWeight: '800' },
  status: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing[4],
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  when: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing[5],
  },
  error: { color: '#F87171', textAlign: 'center', marginVertical: spacing[4] },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  k: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  v: { color: '#FFFFFF', fontWeight: '600', fontSize: 14, textAlign: 'right', flexShrink: 1 },
  green: { color: '#4ADE80', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 8 },
  totalLab: { color: '#FFFFFF', fontWeight: '800' },
  totalVal: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: spacing[4],
    gap: 12,
  },
  rewardIcon: { color: '#A78BFA', fontSize: 28 },
  rewardTitle: { color: '#FFFFFF', fontWeight: '700' },
  rewardSub: { color: 'rgba(255,255,255,0.45)', marginTop: 4, fontSize: 13 },
  keepBox: {
    marginTop: 12,
    backgroundColor: '#052e16',
    borderRadius: 12,
    padding: 12,
  },
  keepText: { color: '#86efac', fontWeight: '700', fontSize: 13 },
  keepSub: { color: '#a7f3d0', fontSize: 11, marginTop: 4, lineHeight: 16 },
  referStrip: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b0764',
    backgroundColor: '#1a0b2e',
  },
  referText: { color: '#e9d5ff', fontWeight: '600', textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    padding: spacing[4],
    backgroundColor: '#000000',
  },
  secondary: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#FFFFFF', fontWeight: '700' },
  primary: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: '#7C3AED',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
});
