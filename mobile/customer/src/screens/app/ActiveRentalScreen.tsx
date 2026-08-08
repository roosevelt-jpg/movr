import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
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

function formatRemaining(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Active Rental — countdown, return hub, fuel reminder, extend (mockup). */
export default function ActiveRentalScreen({
  onBack,
  onSupport,
  onReceipt,
}: {
  onBack?: () => void;
  onSupport?: () => void;
  onReceipt?: (id: string) => void;
}) {
  const [data, setData] = useState<any>({
    id: 'demo',
    statusLabel: 'Active',
    vehicle: {
      name: 'Honda CR-V',
      meta: 'LAG-481-KJ · Silver',
      rating: 4.9,
      mode: 'Self-drive',
      emoji: '🚙',
    },
    remainingMs: 14 * 3600000 + 32 * 60000 + 8000,
    returnBy: 'Return by Apr 11 · 9:00 AM',
    startedLabel: 'Started 9:00 AM',
    elapsedPct: 38,
    returnLocation: { address: 'Movr Hub, Victoria Island, Lagos' },
    fuelReminder: 'Return with same fuel level. Charges apply otherwise.',
    extendDailyRate: 22500,
    currency: 'NGN',
  });
  const [remaining, setRemaining] = useState(data.remainingMs);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReceipt, setShowReceipt] = useState<any>(null);

  const load = () => {
    fetch(`${API}/rentals/active`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData((d: any) => ({ ...d, ...j.data }));
          if (j.data.remainingMs != null) setRemaining(Number(j.data.remainingMs));
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setRemaining((ms: number) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const extend = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rentals/${data.id}/extend`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ days: 1 }),
      });
      const j = await res.json();
      setMsg(j?.data?.message || 'Rental extended');
      load();
    } catch {
      setMsg('Extended (demo)');
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async () => {
    onReceipt?.(data.id);
    try {
      const res = await fetch(`${API}/rentals/${data.id}/receipt`, { headers: authHeaders() });
      const j = await res.json();
      if (j?.data) setShowReceipt(j.data);
    } catch {
      setShowReceipt({ total: 46000, currency: 'NGN' });
    }
  };

  const navigate = () => {
    const q = encodeURIComponent(data.returnLocation?.address || 'Victoria Island Lagos');
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => undefined);
  };

  const v = data.vehicle || {};
  const currency = data.currency || 'NGN';
  const rate = Number(data.extendDailyRate || 22500);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Active Rental</Text>
        <View style={styles.activeBadge}>
          <Text style={styles.activeTxt}>● Active</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <View style={styles.carRow}>
            <View style={styles.thumb}>
              <Text style={{ fontSize: 32 }}>{v.emoji || '🚙'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.carName}>{v.name}</Text>
              <Text style={styles.carMeta}>{v.meta}</Text>
              <Text style={styles.rating}>
                ★ {Number(v.rating || 4.9).toFixed(1)} {v.mode || 'Self-drive'}
              </Text>
            </View>
          </View>

          <Text style={styles.timeLab}>TIME REMAINING</Text>
          <Text style={styles.countdown}>{formatRemaining(remaining)}</Text>
          <Text style={styles.returnBy}>{data.returnBy}</Text>

          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Number(data.elapsedPct || 38)}%` }]} />
          </View>
          <View style={styles.barMeta}>
            <Text style={styles.barLab}>{data.startedLabel}</Text>
            <Text style={styles.barLab}>{Number(data.elapsedPct || 38)}% elapsed</Text>
          </View>
        </View>

        <View style={styles.loc}>
          <Text style={styles.pin}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>Return Location</Text>
            <Text style={styles.locAddr}>{data.returnLocation?.address}</Text>
          </View>
          <Pressable onPress={navigate}>
            <Text style={styles.nav}>Navigate</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          {[
            { id: 'support', icon: '📞', label: 'Support', onPress: onSupport },
            {
              id: 'map',
              icon: '🗺',
              label: 'Map View',
              onPress: navigate,
            },
            { id: 'receipt', icon: '📋', label: 'Receipt', onPress: openReceipt },
          ].map((a) => (
            <Pressable key={a.id} style={styles.action} onPress={a.onPress}>
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLab}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fuel}>
          <Text style={styles.fuelIcon}>⛽</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.fuelTitle}>Fuel reminder</Text>
            <Text style={styles.fuelBody}>{data.fuelReminder}</Text>
          </View>
        </View>

        {showReceipt ? (
          <View style={styles.receipt}>
            <Text style={styles.receiptTitle}>Receipt</Text>
            <Text style={styles.receiptBody}>
              Total {formatCurrency(Number(showReceipt.total || 0), showReceipt.currency || currency)}
            </Text>
            <Pressable onPress={() => setShowReceipt(null)}>
              <Text style={styles.nav}>Close</Text>
            </Pressable>
          </View>
        ) : null}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>

      <Pressable style={styles.extend} onPress={extend} disabled={busy}>
        <Text style={styles.extendTxt}>
          {busy
            ? 'Extending…'
            : `Extend Rental · ${formatCurrency(rate, currency)}/day`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    marginBottom: spacing[4],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  activeBadge: {
    backgroundColor: '#052E16',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeTxt: { color: '#4ADE80', fontWeight: '800', fontSize: 12 },
  hero: {
    backgroundColor: '#1E1033',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  carRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#2A1848',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carName: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  carMeta: { color: '#A1A1AA', marginTop: 3 },
  rating: { color: '#FBBF24', fontWeight: '700', marginTop: 6 },
  timeLab: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  countdown: { color: '#FFF', fontSize: 36, fontWeight: '800', marginTop: 6 },
  returnBy: { color: '#A1A1AA', marginTop: 4, marginBottom: 14 },
  barBg: { height: 6, backgroundColor: '#3F3F46', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#8E2DE2', borderRadius: 3 },
  barMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barLab: { color: '#71717A', fontSize: 12 },
  loc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  pin: { fontSize: 20 },
  locTitle: { color: '#FFF', fontWeight: '800' },
  locAddr: { color: '#A1A1AA', fontSize: 13, marginTop: 2 },
  nav: { color: '#A78BFA', fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  action: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionIcon: { fontSize: 20, marginBottom: 6 },
  actionLab: { color: '#E4E4E7', fontWeight: '700', fontSize: 12 },
  fuel: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F97316',
    backgroundColor: '#431407',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  fuelIcon: { fontSize: 20 },
  fuelTitle: { color: '#FFF', fontWeight: '800' },
  fuelBody: { color: '#FDBA74', fontSize: 12, marginTop: 2 },
  receipt: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  receiptTitle: { color: '#FFF', fontWeight: '800', marginBottom: 6 },
  receiptBody: { color: '#A1A1AA', marginBottom: 8 },
  msg: { color: '#A78BFA', textAlign: 'center' },
  extend: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[5],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#450A0A',
    paddingVertical: 16,
    alignItems: 'center',
  },
  extendTxt: { color: '#FCA5A5', fontWeight: '800', fontSize: 15 },
});
