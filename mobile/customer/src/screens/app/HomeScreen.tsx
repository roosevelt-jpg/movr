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
  base?: number;
  distance?: number;
};

type FareModeOption = {
  code: string;
  name: string;
  riderFare: number;
  driverPayout?: number;
  savingsPercent?: number;
  etaMinutes?: number;
  walkMeters?: number;
  description?: string;
  isCheapest?: boolean;
};

/** Prefer affordable African-first tiers; fall back to whatever the API returns. */
const PREFERRED_ORDER = [
  'okada',
  'motorcycle',
  'shared',
  'economy',
  'standard',
  'express',
  'xl',
  'suv',
  'premium',
  'luxury',
];

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function iconFor(code: string) {
  if (/okada|motor|bike/i.test(code)) return '🏍️';
  if (/keke|tricycle/i.test(code)) return '🛺';
  if (/shared|pool/i.test(code)) return '👥';
  if (/xl|suv|van/i.test(code)) return '🚐';
  if (/prem|lux/i.test(code)) return '⭐';
  return '🚗';
}

function sortTier(list: VehicleOption[]) {
  return [...list].sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a.code);
    const ib = PREFERRED_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/** Book a Ride — affordable African tiers, fare breakdown, driver keeps 100%. */
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
  const [fareModes, setFareModes] = useState<FareModeOption[]>([]);
  const [fareMode, setFareMode] = useState('now');
  const [payWithCredit, setPayWithCredit] = useState(false);
  const [mobilityCredit, setMobilityCredit] = useState(0);
  const [selected, setSelected] = useState<string>('economy');
  const [currency, setCurrency] = useState('NGN');
  const [pickup, setPickup] = useState(pickupLabel);
  const [destination, setDestination] = useState(destProp || '');
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');
  const [promise, setPromise] = useState<any>(null);
  const [driverReason, setDriverReason] = useState('');

  useEffect(() => {
    fetch(`${API}/trust/promise`)
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
    fetch(`${API}/rails/credit`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setMobilityCredit(Number(j?.data?.mobilityCredit || 0)))
      .catch(() => undefined);
  }, []);

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
          list = estimates.options.map((o: any) => ({
            code: o.code,
            name: o.name,
            price: Number(o.price || o.total || 0),
            etaMinutes: o.etaMinutes,
            capacity: o.capacity,
            base: Number(o.base ?? o.baseFare ?? 0) || undefined,
            distance: Number(o.distance ?? o.distanceFare ?? 0) || undefined,
          }));
          setCurrency(estimates.currency || 'NGN');
          if (estimates.fareModes?.length) {
            setFareModes(
              estimates.fareModes.map((m: any) => ({
                code: m.code,
                name: m.name,
                riderFare: Number(m.riderFare || 0),
                driverPayout: Number(m.driverPayout || 0),
                savingsPercent: Number(m.savingsPercent || 0),
                etaMinutes: m.etaMinutes,
                walkMeters: m.walkMeters,
                description: m.description,
                isCheapest: Boolean(m.isCheapest),
              }))
            );
            setFareMode('now');
          } else {
            setFareModes([]);
          }
          setDriverReason(estimates.driverReason || '');
        } else {
          list = (json.data?.vehicleTypes || []).map((t: any) => ({
            code: t.code,
            name: t.name,
            capacity: t.passenger_capacity,
            price: Number(t.pricing?.base_fare || 0),
            base: Number(t.pricing?.base_fare || 0),
          }));
        }
        // Deduplicate economy/standard, okada/motorcycle — prefer named African codes
        const byFamily = new Map<string, VehicleOption>();
        for (const o of sortTier(list)) {
          const family = /okada|motorcycle/.test(o.code)
            ? 'okada'
            : /economy|standard/.test(o.code)
              ? 'economy'
              : /xl|suv/.test(o.code)
                ? 'xl'
                : o.code;
          if (!byFamily.has(family)) {
            byFamily.set(family, {
              ...o,
              code: family === 'okada' ? (o.code === 'motorcycle' ? 'okada' : o.code) : o.code,
              name:
                family === 'okada'
                  ? 'Okada'
                  : family === 'economy'
                    ? o.name === 'Standard'
                      ? 'Economy'
                      : o.name
                    : o.name,
            });
          }
        }
        const preferred = Array.from(byFamily.values());
        const use = preferred.length
          ? preferred
          : [
              { code: 'okada', name: 'Okada', price: 650 },
              { code: 'shared', name: 'Shared', price: 900 },
              { code: 'economy', name: 'Economy', price: 1200 },
              { code: 'xl', name: 'XL', price: 2100 },
            ];
        setOptions(use);
        const defaultCode =
          use.find((o) => o.code === 'economy' || o.code === 'standard')?.code ||
          use.find((o) => o.code === 'shared')?.code ||
          use[0]?.code ||
          'economy';
        setSelected(defaultCode);
      } catch {
        setOptions([
          { code: 'okada', name: 'Okada', price: 650 },
          { code: 'shared', name: 'Shared', price: 900 },
          { code: 'economy', name: 'Economy', price: 1200 },
          { code: 'xl', name: 'XL', price: 2100 },
        ]);
        setSelected('economy');
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
  const activeMode = fareModes.find((m) => m.code === fareMode);
  const fare = Number(activeMode?.riderFare || active?.price || 1200);
  const driverPayout = Number(activeMode?.driverPayout || fare);
  const base = Number(active?.base || Math.round(fare * 0.7));
  const distancePart = Number(active?.distance || Math.max(0, fare - base));
  const dvt = useMemo(() => Math.round(Math.max(fare, driverPayout) * 0.1), [fare, driverPayout]);

  const confirm = async () => {
    setConfirming(true);
    setMsg('');
    try {
      onSelectType?.(selected);
      onConfirm?.({ code: selected, price: fare, dvt });
      const rideType =
        selected === 'okada'
          ? 'motorcycle'
          : selected === 'economy'
            ? 'standard'
            : selected;
      const isShare = fareMode === 'share' || selected === 'shared';
      let url = `${API}/rides/request`;
      let body: any = {
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        pickupAddress: pickup,
        dropoffAddress: destination,
        vehicleTypeCode: selected,
        rideType,
        fareMode,
        countryCode: region,
      };
      if (isShare) {
        url = `${API}/rails/share/join`;
        body = {
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          pickupAddress: pickup,
          dropoffAddress: destination,
          countryCode: region,
          payWithMobilityCredit: payWithCredit,
        };
      } else {
        // All bookings go through rails (corridor caps + optional credit)
        url = `${API}/rails/book`;
        body = {
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          pickupAddress: pickup,
          dropoffAddress: destination,
          vehicleTypeCode: selected,
          fareMode,
          countryCode: region,
          payWithMobilityCredit: payWithCredit,
          sourceChannel: 'app',
        };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const rideId = json.data?.booking?.rideId || json.data?.booking?.id || json.data?.rideId || json.data?.id;
        if (isShare) {
          const waiting = json.data?.waitingForRiders;
          const split = json.data?.fareSplit?.perRider;
          setMsg(
            waiting
              ? 'Joined share pool — waiting for riders (one vehicle)'
              : split
                ? `Shared vehicle · ${split} each`
                : 'Shared vehicle matched'
          );
        } else {
          setMsg(payWithCredit ? 'Booked with ride credit' : 'Ride requested');
        }
        if (rideId) {
          try {
            (globalThis as any).__MOVR_NAVIGATE_RIDE__?.(rideId);
          } catch {
            /* optional host nav */
          }
        }
      } else setMsg(json.message || 'Ride queued');
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

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {promise?.keep100Note || 'Driver keeps 100% of this fare · no commission'}
        </Text>
        {promise?.matchSlaText ? (
          <Text style={[styles.bannerText, { color: '#a7f3d0', marginTop: 4, fontWeight: '600' }]}>
            {promise.matchSlaText} · {promise.noShowText}
          </Text>
        ) : null}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}
        >
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
        </ScrollView>
      )}

      {fareModes.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.fareLabel}>Save with smart timing</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {fareModes.map((m) => {
              const on = fareMode === m.code;
              return (
                <Pressable
                  key={m.code}
                  style={[styles.card, on && styles.cardOn, { minWidth: 110 }]}
                  onPress={() => setFareMode(m.code)}
                >
                  <Text style={styles.cardName}>{m.name}</Text>
                  <Text style={styles.cardPrice}>{formatCurrency(m.riderFare, currency)}</Text>
                  {m.savingsPercent ? (
                    <Text style={{ color: '#4ade80', fontSize: 11, marginTop: 4 }}>
                      −{m.savingsPercent}%
                    </Text>
                  ) : null}
                  {m.walkMeters ? (
                    <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                      Walk {m.walkMeters}m
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.breakdown}>
        <Text style={styles.fareLabel}>Fare breakdown</Text>
        <View style={styles.brRow}>
          <Text style={styles.brK}>Base</Text>
          <Text style={styles.brV}>{formatCurrency(base, currency)}</Text>
        </View>
        <View style={styles.brRow}>
          <Text style={styles.brK}>Distance</Text>
          <Text style={styles.brV}>{formatCurrency(distancePart, currency)}</Text>
        </View>
        <View style={styles.brRow}>
          <Text style={styles.brK}>You pay</Text>
          <Text style={styles.brV}>{formatCurrency(fare, currency)}</Text>
        </View>
        <View style={styles.brRow}>
          <Text style={styles.brK}>Platform fee</Text>
          <Text style={[styles.brV, { color: '#4ade80' }]}>
            {formatCurrency(0, currency)}
          </Text>
        </View>
        <View style={[styles.brRow, { marginTop: 6 }]}>
          <Text style={styles.fareLabel}>Estimated total</Text>
          <Text style={styles.fareValue}>{formatCurrency(fare, currency)}</Text>
        </View>
        <Text style={styles.keep}>
          Driver earns {formatCurrency(driverPayout, currency)}
          {driverPayout > fare ? ' (includes zone / mode boost)' : ' (0% take-rate)'}
        </Text>
        {driverReason ? (
          <Text style={[styles.dvt, { color: '#94a3b8' }]} numberOfLines={2}>
            {driverReason}
          </Text>
        ) : null}
        <Text style={styles.dvt}>+{dvt} DVT tokens earned</Text>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable
        onPress={() => setPayWithCredit((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}
      >
        <Text style={{ color: payWithCredit ? '#A855F7' : '#71717A', fontSize: 18 }}>
          {payWithCredit ? '☑' : '☐'}
        </Text>
        <Text style={{ color: '#A1A1AA', fontSize: 13, flex: 1 }}>
          Pay with ride credit ({formatCurrency(mobilityCredit, currency)})
          {fareMode === 'share' || selected === 'shared'
            ? ' · charged when pool dispatches'
            : ''}
        </Text>
      </Pressable>

      <Pressable style={styles.cta} onPress={confirm} disabled={confirming}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>
          {confirming
            ? 'Confirming…'
            : fareMode === 'share' || selected === 'shared'
              ? 'Join share pool'
              : payWithCredit
                ? 'Book with credit'
                : 'Confirm Ride'}
        </Text>
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
  banner: {
    backgroundColor: '#14532d',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  bannerText: { color: '#86efac', fontWeight: '700', fontSize: 12, textAlign: 'center' },
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
  cards: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 18, paddingRight: 8 },
  card: {
    width: 100,
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
  breakdown: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  fareLabel: { color: '#888', fontSize: 13, fontWeight: '600' },
  brRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  brK: { color: '#a1a1aa', fontSize: 13 },
  brV: { color: '#fff', fontWeight: '600', fontSize: 13 },
  fareValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  keep: { color: '#86efac', fontSize: 12, marginTop: 10, fontWeight: '700' },
  dvt: { color: '#a78bfa', fontSize: 12, marginTop: 4, fontWeight: '600' },
  msg: { color: '#4ade80', marginBottom: 8, textAlign: 'center' },
  cta: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#8E2DE2',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#4A00E0', opacity: 0.5 },
  ctaB: {},
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16, zIndex: 1 },
});
