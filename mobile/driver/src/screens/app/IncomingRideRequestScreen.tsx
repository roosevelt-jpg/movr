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

/** Incoming ride request — countdown, route, surge, Decline / Accept (mockup). */
export default function IncomingRideRequestScreen({
  offerId,
  onAccepted,
  onDeclined,
}: {
  offerId?: string;
  onAccepted?: (rideId: string) => void;
  onDeclined?: () => void;
}) {
  const [offer, setOffer] = useState<any>({
    id: offerId || 'demo',
    secondsLeft: 12,
    pickupKm: 0.8,
    pickup: 'Victoria Island, Lagos',
    dropoff: 'Lekki Phase 1, Lagos',
    distanceKm: 8.4,
    etaMinutes: 22,
    earnings: 1400,
    surgeMultiplier: 1.8,
    surgeBonus: 630,
    currency: 'NGN',
  });
  const [seconds, setSeconds] = useState(12);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/driver/offers/pending`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setOffer(j.data);
          setSeconds(Number(j.data.secondsLeft || 12));
        }
      })
      .catch(() => undefined);
  }, [offerId]);

  useEffect(() => {
    if (seconds <= 0) {
      onDeclined?.();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const progress = Math.max(0.05, seconds / 12);

  const accept = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/driver/offers/${offer.id}/accept`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const json = await res.json();
      onAccepted?.(json?.data?.rideId || offer.rideId || offer.id);
    } catch {
      onAccepted?.(offer.id);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    await fetch(`${API}/driver/offers/${offer.id}/decline`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    }).catch(() => undefined);
    setBusy(false);
    onDeclined?.();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.progress, { width: `${progress * 100}%` }]} />

      <View style={styles.timer}>
        <Text style={styles.timerText}>⏱ {seconds} seconds to respond</Text>
      </View>

      <View style={styles.map}>
        <View style={styles.ring} />
        <View style={styles.ring2} />
        <Text style={styles.car}>🚗</Text>
      </View>

      <Text style={styles.heading}>New ride request</Text>
      <Text style={styles.away}>{Number(offer.pickupKm || 0.8)} km away</Text>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: '#A78BFA' }]} />
          <Text style={styles.routeText}>{offer.pickup}</Text>
        </View>
        <View style={styles.line} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.routeText}>{offer.dropoff}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{Number(offer.distanceKm)} km</Text>
          <Text style={styles.metricLab}>Distance</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>~{offer.etaMinutes} min</Text>
          <Text style={styles.metricLab}>Est. time</Text>
        </View>
        <View style={[styles.metric, styles.metricEarn]}>
          <Text style={styles.metricVal}>
            {formatCurrency(Number(offer.earnings || 0), offer.currency || 'NGN')}
          </Text>
          <Text style={[styles.metricLab, { color: '#A78BFA' }]}>Earnings</Text>
        </View>
      </View>

      <View style={styles.surge}>
        <Text style={styles.surgeText}>
          ⚡ {offer.surgeMultiplier}x surge applied · +
          {formatCurrency(Number(offer.surgeBonus || 0), offer.currency || 'NGN')} bonus
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.decline} onPress={decline} disabled={busy}>
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>
        <Pressable style={styles.accept} onPress={accept} disabled={busy}>
          <Text style={styles.acceptText}>{busy ? '…' : 'Accept Ride'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  progress: { height: 3, backgroundColor: '#8E2DE2', borderRadius: 2, marginBottom: spacing[3] },
  timer: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1C1917',
    marginBottom: spacing[3],
  },
  timerText: { color: '#FB923C', fontWeight: '700' },
  map: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#8E2DE244',
  },
  ring2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4C1D9555',
  },
  car: { fontSize: 36, zIndex: 2 },
  heading: { color: '#A1A1AA', textAlign: 'center' },
  away: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  route: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[3],
    marginVertical: spacing[4],
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 2, height: 14, backgroundColor: '#3F3F46', marginLeft: 4, marginVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { color: '#E4E4E7', fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: spacing[3] },
  metric: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  metricEarn: { borderWidth: 1, borderColor: '#8E2DE2' },
  metricVal: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  metricLab: { color: '#71717A', fontSize: 11, marginTop: 4 },
  surge: {
    backgroundColor: '#431407',
    borderRadius: 14,
    padding: 12,
    marginBottom: spacing[4],
  },
  surgeText: { color: '#FB923C', fontWeight: '700', textAlign: 'center', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 'auto', marginBottom: spacing[5] },
  decline: {
    flex: 1,
    backgroundColor: '#450A0A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  declineText: { color: '#FCA5A5', fontWeight: '800' },
  accept: {
    flex: 1.4,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  acceptText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
