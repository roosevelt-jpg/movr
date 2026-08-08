import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
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

type Pkg = {
  code: string;
  name: string;
  weight_label: string;
  base_fee: number;
  dvt_reward: number;
  icon_key?: string;
};

const FALLBACK: Pkg[] = [
  { code: 'document', name: 'Document', weight_label: 'Under 1kg', base_fee: 500, dvt_reward: 50, icon_key: 'document' },
  { code: 'small_box', name: 'Small Box', weight_label: '1-5kg', base_fee: 800, dvt_reward: 80, icon_key: 'box' },
  { code: 'large', name: 'Large', weight_label: '5-20kg', base_fee: 1500, dvt_reward: 150, icon_key: 'crate' },
];

function pkgIcon(key?: string) {
  if (key === 'document') return '📄';
  if (key === 'crate') return '🪑';
  return '📦';
}

/** Deliver — pickup/dropoff, package type cards, Schedule Pickup. */
export default function ParcelHomeScreen({
  onScheduled,
}: {
  activeTab?: string;
  onTabChange?: (t: any) => void;
  onScheduled?: (id: string) => void;
}) {
  const [pkgs, setPkgs] = useState<Pkg[]>(FALLBACK);
  const [selected, setSelected] = useState('small_box');
  const [pickup, setPickup] = useState('24 Admiralty Way, Lekki Phase 1, Lagos.');
  const [dropoff, setDropoff] = useState('Block C, Marina Square, Lagos Island.');
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/deliveries/quote?packageType=${selected}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data?.packageTypes) && j.data.packageTypes.length) {
          setPkgs(
            j.data.packageTypes.map((p: any) => ({
              code: p.code,
              name: p.name,
              weight_label: p.weight_label,
              base_fee: Number(p.base_fee),
              dvt_reward: Number(p.dvt_reward),
              icon_key: p.icon_key,
            }))
          );
        }
        if (j?.data?.currency) setCurrency(j.data.currency);
      })
      .catch(() => undefined);
  }, [selected]);

  const active = pkgs.find((p) => p.code === selected) || pkgs[1] || pkgs[0];
  const fee = Number(active?.base_fee || 800);
  const dvt = Number(active?.dvt_reward || Math.round(fee * 0.1));

  const schedule = async () => {
    if (!pickup || !dropoff) {
      setMsg('Enter pickup and drop-off');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/deliveries`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          packageType: selected,
          speedTier: 'standard',
        }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMsg('Pickup scheduled');
        onScheduled?.(String(json.data?.id || ''));
      } else {
        setMsg(json.message || 'Could not schedule');
      }
    } catch (e: any) {
      setMsg(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Deliver</Text>
      <Text style={styles.sub}>Send a parcel anywhere in the city</Text>

      <View style={styles.locCard}>
        <Text style={styles.locLabel}>PICKUP LOCATION</Text>
        <View style={styles.locRow}>
          <View style={[styles.dot, { backgroundColor: '#8E2DE2' }]} />
          <Text style={styles.locText}>{pickup}</Text>
        </View>
        <View style={styles.vline} />
        <Text style={styles.locLabel}>DROP-OFF LOCATION</Text>
        <View style={styles.locRow}>
          <View style={[styles.dot, { backgroundColor: '#3B5CFF' }]} />
          <Text style={styles.locText}>{dropoff}</Text>
        </View>
      </View>

      <Text style={styles.section}>PACKAGE TYPE</Text>
      <View style={styles.pkgRow}>
        {pkgs.map((p) => {
          const on = selected === p.code;
          return (
            <Pressable
              key={p.code}
              style={[styles.pkgCard, on && styles.pkgOn]}
              onPress={() => setSelected(p.code)}
            >
              <Text style={styles.pkgIcon}>{pkgIcon(p.icon_key)}</Text>
              <Text style={styles.pkgName}>{p.name}</Text>
              <Text style={styles.pkgWeight}>{p.weight_label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.costCard}>
        <View>
          <Text style={styles.costLabel}>Estimated Cost</Text>
          <Text style={styles.dvt}>+{dvt} DVT tokens earned</Text>
        </View>
        <Text style={styles.costValue}>{formatCurrency(fee, currency)}</Text>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={schedule} disabled={loading}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{loading ? 'Scheduling…' : 'Schedule Pickup'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 8 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800' },
  sub: { color: '#888', marginTop: 4, marginBottom: 18 },
  locCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  locLabel: { color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  locText: { flex: 1, color: '#fff', fontWeight: '600', lineHeight: 20 },
  vline: {
    width: 2,
    height: 18,
    backgroundColor: '#333',
    marginLeft: 4,
    marginVertical: 8,
  },
  section: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  pkgRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  pkgCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 6,
  },
  pkgOn: { borderColor: '#3B5CFF' },
  pkgIcon: { fontSize: 22 },
  pkgName: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  pkgWeight: { color: '#888', fontSize: 10, textAlign: 'center' },
  costCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  costLabel: { color: '#888', fontSize: 13 },
  dvt: { color: '#a78bfa', fontSize: 12, marginTop: 4, fontWeight: '600' },
  costValue: { color: '#fff', fontSize: 28, fontWeight: '800' },
  msg: { color: '#4ade80', textAlign: 'center', marginBottom: 8 },
  cta: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#8E2DE2',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#8E2DE2', opacity: 0.9 },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.7,
    left: '40%',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 17, zIndex: 1 },
});
