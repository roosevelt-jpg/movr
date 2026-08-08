import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { formatCurrency } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type VehicleOption = {
  code: string;
  name: string;
  price?: number;
  etaMinutes?: number;
  capacity?: number;
};

const MOCKUP_CODES = ['standard', 'xl', 'premium'];

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function iconFor(code: string) {
  if (/xl|suv|van/i.test(code)) return '🚐';
  if (/prem|lux/i.test(code)) return '⭐';
  return '🚗';
}

/** Book a Ride — map route, pickup/dest, Standard/XL/Premium, Confirm Ride. */
export default function HomeScreen({
  destination: destProp,
  pickupLabel = 'Victoria Island, Lagos',
  region = 'NG',
  pickupLat = 6.4281,
  pickupLng = 3.4219,
  dropoffLat = 6.4474,
  dropoffLng = 3.4721,
  onSelectType,
  onConfirm,
  onClearPickup,
}: {
  destination?: string;
  pickupLabel?: string;
  region?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  onSelectType?: (code: string) => void;
  onConfirm?: (payload: { code: string; price: number; dvt: number }) => void;
  onClearPickup?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<VehicleOption[]>([]);
  const [selected, setSelected] = useState<string>('standard');
  const [currency, setCurrency] = useState('NGN');
  const [pickup, setPickup] = useState(pickupLabel);
  const [destination, setDestination] = useState(destProp || 'Lekki Phase 1...');
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          region,
          pickupLat: String(pickupLat),
          pickupLng: String(pickupLng),
          dropoffLat: String(dropoffLat),
          dropoffLng: String(dropoffLng),
        });
        const res = await fetch(`${API}/vehicle-types?${q}`);
        const json = await res.json();
        if (cancelled) return;
        const estimates = json.data?.estimates;
        let list: VehicleOption[] = [];
        if (estimates?.options?.length) {
          list = estimates.options;
          setCurrency(estimates.currency || 'NGN');
        } else {
          list = (json.data?.vehicleTypes || []).map((t: any) => ({
            code: t.code,
            name: t.name,
            capacity: t.passenger_capacity,
            price: Number(t.pricing?.base_fare || 0),
          }));
        }
        const preferred = MOCKUP_CODES.map((code) => {
          const found = list.find((o) => o.code === code || o.name?.toLowerCase() === code);
          if (found) return found;
          const fallbackPrice = code === 'standard' ? 1200 : code === 'xl' ? 2100 : 3400;
          return {
            code,
            name: code === 'xl' ? 'XL' : code.charAt(0).toUpperCase() + code.slice(1),
            price: fallbackPrice,
          };
        });
        setOptions(preferred);
        setSelected(preferred[0]?.code || 'standard');
      } catch {
        setOptions([
          { code: 'standard', name: 'Standard', price: 1200 },
          { code: 'xl', name: 'XL', price: 2100 },
          { code: 'premium', name: 'Premium', price: 3400 },
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [region, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const active = options.find((o) => o.code === selected) || options[0];
  const fare = Number(active?.price || 1200);
  const dvt = useMemo(() => Math.round(fare * 0.1), [fare]);

  const confirm = async () => {
    setConfirming(true);
    setMsg('');
    try {
      onSelectType?.(selected);
      onConfirm?.({ code: selected, price: fare, dvt });
      const res = await fetch(`${API}/rides/request`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          rideType: selected,
          pickupAddress: pickup,
          dropoffAddress: destination,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setMsg('Ride requested');
      else setMsg(json.message || 'Ride queued');
    } catch (e: any) {
      setMsg(e.message || 'Could not confirm');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.map}>
        <View style={styles.routeLine} />
        <View style={[styles.dot, styles.dotPickup]} />
        <Text style={styles.carOnRoute}>🚗</Text>
        <View style={[styles.dot, styles.dotDrop]} />
      </View>

      <View style={styles.field}>
        <View style={[styles.pin, { backgroundColor: '#8E2DE2' }]} />
        <Text style={styles.fieldText} numberOfLines={1}>
          {pickup}
        </Text>
        <Pressable onPress={onClearPickup || (() => setPickup(''))}>
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.field}>
        <View style={[styles.pin, { backgroundColor: '#3B5CFF' }]} />
        <Text style={styles.fieldText} numberOfLines={1}>
          {destination}
        </Text>
        <Text style={styles.mapPin}>📍</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#8E2DE2" style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.cards}>
          {options.map((o) => {
            const on = selected === o.code;
            return (
              <Pressable
                key={o.code}
                style={[styles.card, on && styles.cardOn]}
                onPress={() => {
                  setSelected(o.code);
                  onSelectType?.(o.code);
                }}
              >
                <Text style={styles.cardIcon}>{iconFor(o.code)}</Text>
                <Text style={styles.cardName}>{o.name}</Text>
                <Text style={styles.cardPrice}>
                  {formatCurrency(Number(o.price || 0), currency)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.fareRow}>
        <View>
          <Text style={styles.fareLabel}>Estimated fare</Text>
          <Text style={styles.dvt}>+{dvt} DVT tokens earned</Text>
        </View>
        <Text style={styles.fareValue}>{formatCurrency(fare, currency)}</Text>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={confirm} disabled={confirming}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{confirming ? 'Confirming…' : 'Confirm Ride'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16 },
  map: {
    height: 160,
    borderRadius: 16,
    backgroundColor: '#0c0c12',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#1f1f28',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  routeLine: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 3,
    backgroundColor: '#3B5CFF',
    borderRadius: 2,
  },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dotPickup: { left: 24, backgroundColor: '#8E2DE2' },
  dotDrop: { right: 24, backgroundColor: '#3B5CFF' },
  carOnRoute: { alignSelf: 'center', fontSize: 22 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 10,
  },
  pin: { width: 10, height: 10, borderRadius: 5 },
  fieldText: { flex: 1, color: '#fff', fontWeight: '600' },
  clear: { color: '#888', fontSize: 16, paddingHorizontal: 4 },
  mapPin: { fontSize: 16 },
  cards: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 18 },
  card: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 6,
  },
  cardOn: { borderColor: '#8E2DE2' },
  cardIcon: { fontSize: 22 },
  cardName: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardPrice: { color: '#c4b5fd', fontWeight: '700', fontSize: 13 },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  fareLabel: { color: '#888', fontSize: 13 },
  dvt: { color: '#a78bfa', fontSize: 12, marginTop: 4, fontWeight: '600' },
  fareValue: { color: '#fff', fontSize: 28, fontWeight: '800' },
  msg: { color: '#4ade80', marginBottom: 8, textAlign: 'center' },
  cta: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#3B5CFF',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B5CFF', opacity: 0.9 },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#8E2DE2',
    opacity: 0.7,
    left: '40%',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 17, zIndex: 1 },
});
