import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Driver Home — online map, surge, KPIs, Go Offline (mockup). */
export default function DriverHomeScreen({
  onOffer,
  onEarnings,
  onWithdraw,
}: {
  onOffer?: (offerId: string) => void;
  onEarnings?: () => void;
  onWithdraw?: () => void;
  onDemand?: () => void;
  onVehicle?: () => void;
  onPerformance?: () => void;
  onSubscription?: () => void;
}) {
  const [online, setOnline] = useState(false);
  const [data, setData] = useState<any>({
    todayEarnings: 0,
    trips: 0,
    onlineHours: 0,
    rating: 0,
    surge: null,
    currency: 'NGN',
  });

  const load = (openOffer = false) => {
    fetch(`${API}/driver/home`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData((d: any) => ({ ...d, ...j.data }));
          if (typeof j.data.online === 'boolean') setOnline(j.data.online);
          if (openOffer && j.data.pendingOfferId) onOffer?.(j.data.pendingOfferId);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 20000);
    return () => clearInterval(t);
  }, []);

  const setPresence = async (next: boolean) => {
    setOnline(next);
    await fetch(`${API}/driver/presence`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isOnline: next }),
    }).catch(() => undefined);
    if (next) {
      fetch(`${API}/driver/offers/pending`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((j) => {
          if (j?.data?.id) onOffer?.(j.data.id);
        })
        .catch(() => undefined);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLab}>ONLINE</Text>
          <Text style={[styles.chipVal, online ? styles.active : styles.offline]}>
            {online ? '• Active' : '• Offline'}
          </Text>
        </View>
        <Pressable style={styles.chip} onPress={onEarnings}>
          <Text style={styles.chipLab}>TODAY</Text>
          <Text style={styles.chipEarn}>
            {formatCurrency(Number(data.todayEarnings || 0), data.currency || 'NGN')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.map}>
        <View style={styles.grid} />
        {[
          { t: '18%', l: '22%' },
          { t: '30%', l: '70%' },
          { t: '55%', l: '18%' },
          { t: '62%', l: '75%' },
        ].map((p, i) => (
          <View key={i} style={[styles.dot, { top: p.t as any, left: p.l as any }]} />
        ))}
        <View style={styles.glow} />
        <Text style={styles.car}>🚗</Text>
        <View style={styles.surge}>
          <Text style={styles.surgeText}>
            ⚡ {Number(data.surge?.multiplier || 1.8)}x surge ·{' '}
            {data.surge?.label || 'High demand nearby'}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        {[
          { v: String(data.trips ?? 14), l: 'Trips', c: '#FFF' },
          { v: `${data.onlineHours ?? 6.5}h`, l: 'Online', c: '#FFF' },
          { v: `★ ${Number(data.rating || 4.9).toFixed(1)}`, l: 'Rating', c: '#4ADE80' },
        ].map((s) => (
          <View key={s.l} style={styles.stat}>
            <Text style={[styles.statVal, { color: s.c }]}>{s.v}</Text>
            <Text style={styles.statLab}>{s.l}</Text>
          </View>
        ))}
      </View>

      {onWithdraw ? (
        <Pressable onPress={onWithdraw}>
          <Text style={styles.withdraw}>Withdraw →</Text>
        </Pressable>
      ) : null}

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
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  topRow: { flexDirection: 'row', gap: 10, marginBottom: spacing[3] },
  chip: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 12,
  },
  chipLab: { color: '#71717A', fontSize: 11, fontWeight: '700' },
  chipVal: { fontWeight: '800', marginTop: 4, fontSize: 15 },
  active: { color: '#22C55E' },
  offline: { color: '#A1A1AA' },
  chipEarn: { color: '#FFF', fontWeight: '800', marginTop: 4, fontSize: 18 },
  map: {
    height: 280,
    borderRadius: 20,
    backgroundColor: '#0A0A0F',
    overflow: 'hidden',
    marginBottom: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.25,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
    shadowColor: '#A78BFA',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  glow: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#4C1D9555',
    position: 'absolute',
  },
  car: { fontSize: 36, zIndex: 2 },
  surge: {
    position: 'absolute',
    bottom: 16,
    borderWidth: 1.5,
    borderColor: '#F97316',
    backgroundColor: '#1C1917',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  surgeText: { color: '#FB923C', fontWeight: '700', fontSize: 12 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: spacing[3] },
  stat: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statVal: { fontWeight: '800', fontSize: 16 },
  statLab: { color: '#71717A', fontSize: 11, marginTop: 4 },
  withdraw: { color: '#A78BFA', textAlign: 'center', fontWeight: '700', marginBottom: 8 },
  goBtn: {
    marginTop: 'auto',
    marginBottom: spacing[4],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#450A0A',
    paddingVertical: 16,
    alignItems: 'center',
  },
  goOnline: { borderColor: '#22C55E', backgroundColor: '#052E16' },
  goText: { color: '#EF4444', fontWeight: '800', fontSize: 16 },
});
