import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
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

function fmtShort(n: number, currency: string) {
  if (n >= 1000) {
    const k = Math.round(n / 1000);
    const sym = currency === 'NGN' ? '₦' : currency === 'GHS' ? 'GH₵' : '';
    return `${sym}${k}K`;
  }
  return formatCurrency(n, currency);
}

/** Rentals — Self-Drive | Chauffeur, dates, AVAILABLE CARS (mockup). */
export default function RentalHomeScreen({
  onBooked,
  onConfirm,
}: {
  onBooked?: (id: string) => void;
  onConfirm?: (opts: {
    vehicleId: string;
    mode: 'self_drive' | 'chauffeur';
    pickup: string;
    returnAt: string;
  }) => void;
}) {
  const [mode, setMode] = useState<'self_drive' | 'chauffeur'>('self_drive');
  const [pickup, setPickup] = useState('Apr 10, 9:00 AM');
  const [ret, setRet] = useState('Apr 11, 9:00 AM');
  const [cars, setCars] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/rentals/vehicles?mode=${mode}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data || [];
        setCars(rows);
        if (rows[0]?.id) setSelected(rows.find((c: any) => c.popular)?.id || rows[0].id);
      })
      .catch(() => {
        setCars([]);
        setSelected('');
      });
  }, [mode]);

  const selectedCar = useMemo(() => cars.find((c) => c.id === selected), [cars, selected]);

  const book = async () => {
    if (!selectedCar) return;
    if (onConfirm) {
      onConfirm({
        vehicleId: selectedCar.id,
        mode,
        pickup,
        returnAt: ret,
      });
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rentals/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rentalVehicleId: selectedCar.id,
          rentalType: mode,
          days: 1,
          pickupAddress: 'Movr Hub, Victoria Island, Lagos',
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Booking failed');
      setMsg('Booked');
      onBooked?.(String(j.data?.id || selectedCar.id));
    } catch (e: any) {
      setMsg(e.message || 'Booked (demo)');
      onBooked?.(String(selectedCar.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Rentals</Text>
      <Text style={styles.sub}>Self-drive & chauffeur options</Text>

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, mode === 'self_drive' && styles.toggleOn]}
          onPress={() => setMode('self_drive')}
        >
          {mode === 'self_drive' ? <View style={styles.toggleA} /> : null}
          {mode === 'self_drive' ? <View style={styles.toggleB} /> : null}
          <Text style={styles.toggleTxt}>Self-Drive</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, mode === 'chauffeur' && styles.toggleOn]}
          onPress={() => setMode('chauffeur')}
        >
          {mode === 'chauffeur' ? <View style={styles.toggleA} /> : null}
          {mode === 'chauffeur' ? <View style={styles.toggleB} /> : null}
          <Text style={styles.toggleTxt}>Chauffeur</Text>
        </Pressable>
      </View>

      <View style={styles.dates}>
        <Pressable style={styles.dateCard} onPress={() => setPickup('Apr 10, 9:00 AM')}>
          <Text style={styles.dateLabel}>PICKUP DATE</Text>
          <Text style={styles.dateVal}>{pickup}</Text>
        </Pressable>
        <Pressable style={styles.dateCard} onPress={() => setRet('Apr 11, 9:00 AM')}>
          <Text style={styles.dateLabel}>RETURN DATE</Text>
          <Text style={styles.dateVal}>{ret}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>AVAILABLE CARS</Text>
      {cars.map((c) => {
        const on = selected === c.id;
        return (
          <Pressable
            key={c.id}
            style={[styles.card, (c.popular || on) && styles.cardPopular]}
            onPress={() => setSelected(c.id)}
          >
            {c.popular ? (
              <View style={styles.popular}>
                <View style={styles.popA} />
                <View style={styles.popB} />
                <Text style={styles.popularTxt}>POPULAR</Text>
              </View>
            ) : null}
            <View style={styles.thumb}>
              <Text style={{ fontSize: 28 }}>{c.emoji || '🚗'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.carName}>{c.name}</Text>
              <Text style={styles.carMeta}>{c.meta}</Text>
              <View style={styles.carRow}>
                <Text style={styles.stars}>★ {Number(c.rating || 4.8).toFixed(1)}</Text>
                {c.available !== false ? (
                  <View style={styles.avail}>
                    <Text style={styles.availTxt}>Available</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{fmtShort(Number(c.dailyRate || 0), c.currency || 'NGN')}</Text>
              <Text style={styles.per}>/day</Text>
            </View>
          </Pressable>
        );
      })}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Pressable style={styles.cta} onPress={book} disabled={busy || !selectedCar}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaTxt}>
          {busy
            ? 'Booking…'
            : selectedCar
              ? `Continue with ${selectedCar.name}`
              : 'Select a car'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 6, marginBottom: 16 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toggleOn: {},
  toggleA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6' },
  toggleB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A855F7',
    opacity: 0.85,
    left: '40%',
  },
  toggleTxt: { color: '#fff', fontWeight: '700', zIndex: 1 },
  dates: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  dateCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
  },
  dateLabel: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  dateVal: { color: '#fff', fontWeight: '700', marginTop: 6 },
  section: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  cardPopular: { borderColor: '#A855F7' },
  popular: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderBottomRightRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    zIndex: 2,
  },
  popA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6' },
  popB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A855F7',
    opacity: 0.85,
    left: '30%',
  },
  popularTxt: { color: '#fff', fontSize: 10, fontWeight: '800', zIndex: 1 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  carName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  carMeta: { color: '#A1A1AA', fontSize: 12, marginTop: 3 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stars: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  avail: {
    backgroundColor: '#14532D',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  availTxt: { color: '#86EFAC', fontSize: 11, fontWeight: '700' },
  price: { color: '#fff', fontWeight: '800', fontSize: 18 },
  per: { color: '#71717A', fontSize: 12 },
  msg: { color: '#A1A1AA', textAlign: 'center', marginVertical: 8 },
  cta: {
    marginTop: 12,
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A855F7',
    opacity: 0.8,
    left: '40%',
  },
  ctaTxt: { color: '#fff', fontWeight: '800', zIndex: 1 },
});
