import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const RANGES = ['today', 'week', 'month'] as const;

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtAt(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Driver Earnings — online, period tabs, activity, Go Offline (mockup). */
export default function DriverEarningsScreen({
  onWithdraw,
  onSettlement,
  onDestination,
  onGuarantee,
  onPerformance,
  onSubscription,
}: {
  onSend?: () => void;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onSettlement?: () => void;
  onDestination?: () => void;
  onGuarantee?: () => void;
  onDemand?: () => void;
  onVehicle?: () => void;
  onPerformance?: () => void;
  onSubscription?: () => void;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>('today');
  const [online, setOnline] = useState(false);
  const [promise, setPromise] = useState<any>(null);
  const [data, setData] = useState<any>({
    amount: 0,
    trips: 0,
    hours: 0,
    dvtEarned: 0,
    rating: 0,
    activity: [],
    currency: 'NGN',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch(`${API}/driver/earnings/dashboard?range=${range}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData(j.data);
          if (typeof j.data.online === 'boolean') setOnline(j.data.online);
        }
      })
      .catch((e) => {
        setData({ amount: 0, trips: 0, hours: 0, dvtEarned: 0, rating: 0, activity: [], currency: 'NGN' });
        setOnline(false);
        setError(e?.message || 'Could not load earnings');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [range]);

  useEffect(() => {
    fetch(`${API}/trust/promise`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
  }, []);

  const setPresence = async (next: boolean) => {
    setOnline(next);
    await fetch(`${API}/driver/presence`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isOnline: next }),
    }).catch(() => undefined);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.top}>
          <View style={[styles.badge, online ? styles.badgeOn : styles.badgeOff]}>
            <Text style={[styles.badgeText, online ? styles.badgeTextOn : null]}>
              {online ? '● Online' : '● Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLab}>
            {range === 'today' ? "TODAY'S" : range === 'week' ? "WEEK'S" : "MONTH'S"} EARNINGS
          </Text>
          <Text style={styles.cardVal}>
            {formatCurrency(Number(data.amount || 0), data.currency || 'NGN')}
          </Text>
          <View style={styles.metrics}>
            {[
              ['TRIPS', String(data.trips ?? 0)],
              ['HOURS', `${data.hours ?? 0}h`],
              ['DVT EARNED', String(data.dvtEarned ?? 0)],
              ['RATING', `★ ${Number(data.rating || 0).toFixed(1)}`],
            ].map(([l, v]) => (
              <View key={l} style={styles.metric}>
                <Text style={styles.metricVal}>{v}</Text>
                <Text style={styles.metricLab}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tabs}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.tab, range === r && styles.tabOn]}
            >
              <Text style={[styles.tabText, range === r && styles.tabTextOn]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? <Text style={styles.state}>Loading earnings…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !(data.activity || []).length ? <Text style={styles.state}>No earnings activity.</Text> : null}

        {(data.activity || []).map((a: any) => (
          <View key={a.id} style={styles.row}>
            <View
              style={[
                styles.icon,
                a.type === 'delivery' ? { backgroundColor: '#14532D' } : { backgroundColor: '#3B0764' },
              ]}
            >
              <Text>{a.type === 'delivery' ? '📦' : '🚗'}</Text>
            </View>
            <Text style={styles.rowTime}>
              {fmtAt(a.at)} · {a.durationMinutes} min
            </Text>
            <Text style={styles.rowDvt}>+{Number(a.dvtEarned || 0)} DVT</Text>
          </View>
        ))}

        {onWithdraw ? (
          <Pressable onPress={onWithdraw} style={{ marginTop: 16 }}>
            <Text style={styles.withdraw}>Withdraw earnings →</Text>
          </Pressable>
        ) : null}
        {onSettlement ? (
          <Pressable onPress={onSettlement} style={{ marginTop: 10 }}>
            <Text style={styles.withdraw}>Settlement rails (MoMo · agents) →</Text>
          </Pressable>
        ) : null}
        {onDestination ? (
          <Pressable onPress={onDestination} style={{ marginTop: 10 }}>
            <Text style={styles.withdraw}>Destination mode →</Text>
          </Pressable>
        ) : null}
        {onGuarantee ? (
          <Pressable onPress={onGuarantee} style={{ marginTop: 10 }}>
            <Text style={styles.withdraw}>Income floor guarantee →</Text>
          </Pressable>
        ) : null}
        {promise?.keep100Note ? (
          <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 12 }}>{promise.keep100Note}</Text>
        ) : null}

        {(onPerformance || onSubscription) && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            {onPerformance ? (
              <Pressable
                onPress={onPerformance}
                style={{
                  flex: 1,
                  backgroundColor: '#1A1A1A',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Profile & ratings</Text>
              </Pressable>
            ) : null}
            {onSubscription ? (
              <Pressable
                onPress={onSubscription}
                style={{
                  flex: 1,
                  backgroundColor: '#1A1A1A',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Driver plans</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.goBtn, !online && styles.goOnline]}
        onPress={() => setPresence(!online)}
      >
        <Text style={[styles.goText, !online && { color: '#166534' }]}>
          {online ? 'Go Offline' : 'Go Online'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  top: { alignItems: 'flex-end', marginBottom: spacing[3] },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeOn: { backgroundColor: '#DCFCE7' },
  badgeOff: { backgroundColor: '#3F3F46' },
  badgeText: { fontWeight: '700', fontSize: 13, color: '#A1A1AA' },
  badgeTextOn: { color: '#15803D' },
  card: {
    borderRadius: 20,
    padding: spacing[4],
    backgroundColor: '#4F46E5',
    marginBottom: spacing[4],
  },
  cardLab: { color: '#E0E7FF', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardVal: { color: '#FFF', fontSize: 36, fontWeight: '800', marginTop: 8 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[5] },
  metric: { alignItems: 'flex-start' },
  metricVal: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  metricLab: { color: '#C7D2FE', fontSize: 10, marginTop: 4, fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 999,
    padding: 4,
    marginBottom: spacing[4],
  },
  tab: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  tabOn: { backgroundColor: '#6366F1' },
  tabText: { color: '#71717A', fontWeight: '700' },
  tabTextOn: { color: '#FFF' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTime: { flex: 1, color: '#E4E4E7', fontWeight: '600' },
  rowDvt: { color: '#A78BFA', fontWeight: '800' },
  withdraw: { color: '#A78BFA', fontWeight: '700', textAlign: 'center' },
  goBtn: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
    backgroundColor: '#FECACA',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goOnline: { backgroundColor: '#BBF7D0' },
  goText: { color: '#DC2626', fontWeight: '800', fontSize: 16 },
  state: { color: '#71717A', textAlign: 'center', marginBottom: spacing[3] },
  error: { color: '#F87171', textAlign: 'center', marginBottom: spacing[3] },
});
