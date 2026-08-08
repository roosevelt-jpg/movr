import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const CRV_ID = 'e0000000-0000-4000-8000-000000000002';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Confirm Rental — vehicle, period, hub, price breakdown, Confirm & Pay (mockup). */
export default function RentalConfirmScreen({
  vehicleId = CRV_ID,
  mode = 'self_drive',
  days = 1,
  pickupAt,
  returnAt,
  onBack,
  onChangeLocation,
  onPaid,
}: {
  vehicleId?: string;
  mode?: 'self_drive' | 'chauffeur';
  days?: number;
  pickupAt?: string;
  returnAt?: string;
  onBack?: () => void;
  onChangeLocation?: () => void;
  onPaid?: (rentalId: string) => void;
}) {
  const [quote, setQuote] = useState<any>(null);
  const [hubs, setHubs] = useState<any[]>([]);
  const [hubId, setHubId] = useState<string | null>(null);
  const [showHubs, setShowHubs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = (hid?: string | null) => {
    const q = new URLSearchParams({
      vehicleId,
      mode,
      days: String(days),
    });
    if (pickupAt) q.set('pickupAt', pickupAt);
    if (returnAt) q.set('returnAt', returnAt);
    fetch(`${API}/rentals/confirm-quote?${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setQuote(j.data);
          if (!hid && j.data.location?.hubId) setHubId(j.data.location.hubId);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    fetch(`${API}/rentals/hubs`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) setHubs(j.data);
      })
      .catch(() => undefined);
  }, [vehicleId, mode, days]);

  const pay = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rentals/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rentalVehicleId: vehicleId,
          rentalType: mode,
          days,
          hubId,
          pickupAt: quote.period?.pickupAt,
          returnAt: quote.period?.returnAt,
          pickupAddress: quote.location?.address,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Payment failed');
      setMsg(j?.data?.message || 'Rental confirmed & paid');
      onPaid?.(String(j.data?.id || vehicleId));
    } catch (e: any) {
      setMsg(e.message || 'Could not confirm rental');
    } finally {
      setBusy(false);
    }
  };

  if (!quote) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backTxt}>←</Text>
          </Pressable>
          <Text style={styles.title}>Confirm Rental</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={{ color: '#aaa', padding: 16 }}>{msg || 'Loading quote…'}</Text>
      </View>
    );
  }

  const v = quote.vehicle || {};
  const p = quote.period || {};
  const loc = quote.location || {};
  const pricing = quote.pricing || {};
  const currency = pricing.currency || 'NGN';
  const total = Number(pricing.total || 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.title}>Confirm Rental</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.carCard}>
          <View style={styles.thumb}>
            <Text style={{ fontSize: 32 }}>{v.emoji || '🚙'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.carName}>{v.name || 'Vehicle'}</Text>
            <Text style={styles.carMeta}>{v.meta}</Text>
            <Text style={styles.rating}>
              ★ {Number(v.rating || 0).toFixed(1)} · {v.mode || 'Self-drive'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>RENTAL PERIOD</Text>
          <View style={styles.periodRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.periodLab}>PICKUP</Text>
              <Text style={styles.periodDate}>{p.pickupDate}</Text>
              <Text style={styles.periodTime}>{p.pickupTime}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.periodLab}>RETURN</Text>
              <Text style={styles.periodDate}>{p.returnDate}</Text>
              <Text style={styles.periodTime}>{p.returnTime}</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{p.label || `${days} day rental`}</Text>
          </View>
        </View>

        <View style={styles.locCard}>
          <Text style={styles.pin}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>Pickup Location</Text>
            <Text style={styles.locAddr}>{loc.address || '—'}</Text>
          </View>
          <Pressable
            onPress={() => {
              setShowHubs((s) => !s);
              onChangeLocation?.();
            }}
          >
            <Text style={styles.change}>Change</Text>
          </Pressable>
        </View>

        {showHubs
          ? hubs.map((h) => (
              <Pressable
                key={h.id}
                style={[styles.hubRow, hubId === h.id && styles.hubOn]}
                onPress={() => {
                  setHubId(h.id);
                  setQuote((q: any) => ({
                    ...q,
                    location: { ...q.location, hubId: h.id, address: h.address },
                  }));
                  setShowHubs(false);
                }}
              >
                <Text style={styles.locAddr}>{h.address || h.name}</Text>
              </Pressable>
            ))
          : null}

        <View style={styles.card}>
          {(pricing.lines || []).map((line: any) => (
            <View key={line.label} style={styles.priceRow}>
              <Text style={styles.priceLab}>{line.label}</Text>
              <Text
                style={[
                  styles.priceVal,
                  Number(line.amount) < 0 && styles.discount,
                ]}
              >
                {Number(line.amount) < 0 ? '−' : ''}
                {formatCurrency(Math.abs(Number(line.amount)), currency)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLab}>Total</Text>
            <Text style={styles.totalVal}>{formatCurrency(total, currency)}</Text>
          </View>
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>

      <Pressable style={styles.cta} onPress={pay} disabled={busy}>
        <Text style={styles.ctaTxt}>
          {busy ? 'Processing…' : `Confirm & Pay ${formatCurrency(total, currency)}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: {
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
  carCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carName: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  carMeta: { color: '#A1A1AA', fontSize: 13, marginTop: 3 },
  rating: { color: '#FBBF24', fontWeight: '700', fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodLab: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  periodDate: { color: '#FFF', fontWeight: '800', marginTop: 4 },
  periodTime: { color: '#A78BFA', fontWeight: '700', marginTop: 2 },
  arrow: { color: '#71717A', fontSize: 18, fontWeight: '700' },
  badge: {
    alignSelf: 'center',
    marginTop: 14,
    backgroundColor: '#2E1065',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeTxt: { color: '#C4B5FD', fontWeight: '700', fontSize: 12 },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  pin: { fontSize: 22 },
  locTitle: { color: '#FFF', fontWeight: '800' },
  locAddr: { color: '#A1A1AA', fontSize: 13, marginTop: 3 },
  change: { color: '#A78BFA', fontWeight: '800' },
  hubRow: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  hubOn: { borderColor: '#8E2DE2' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLab: { color: '#A1A1AA' },
  priceVal: { color: '#FFF', fontWeight: '700' },
  discount: { color: '#4ADE80' },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 6 },
  totalLab: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  totalVal: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  msg: { color: '#A78BFA', textAlign: 'center', marginTop: 8 },
  cta: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[5],
    borderRadius: 16,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
