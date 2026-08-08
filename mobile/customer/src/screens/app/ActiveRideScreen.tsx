import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ScrollView,
  Image,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { formatCurrency } from '@movr/design-system/format';
import RecordingNoticeModal from './RecordingNoticeModal';
import RideChatScreen from './RideChatScreen';

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

/** Driver matched — map ETA, driver card, Call/Message/SOS, wallet fare, Cancel (mockup). */
export default function ActiveRideScreen({
  rideId,
  onComplete,
  onCancelled,
}: {
  rideId?: string;
  onComplete?: () => void;
  onCancelled?: () => void;
}) {
  const [ride, setRide] = useState<any>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [sosMsg, setSosMsg] = useState('');
  const [noticeAcked, setNoticeAcked] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadRide = async () => {
    if (!rideId) {
      setLoading(false);
      setLoadError('Ride not found');
      return;
    }
    const res = await fetch(`${API}/rides/${rideId}`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok || !json?.data) throw new Error(json?.message || 'Ride not found');
    setRide(json.data);
  };

  useEffect(() => {
    if (!rideId) return;
    setNoticeAcked(false);
    setLoading(true);
    loadRide()
      .catch((e) => setLoadError(e?.message || 'Could not load ride'))
      .finally(() => setLoading(false));
    const t = setInterval(() => loadRide().catch(() => undefined), 8000);
    fetch(`${API}/rides/${rideId}/masked-session`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.customerProxyNumber) setProxy(j.data.customerProxyNumber);
      })
      .catch(() => undefined);
    return () => clearInterval(t);
  }, [rideId]);

  const triggerSos = async () => {
    if (!rideId) return;
    setSosMsg('');
    try {
      const res = await fetch(`${API}/sos/trigger`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rideId,
          triggeredBy: 'rider',
          lat: ride?.pickup?.lat ?? null,
          lng: ride?.pickup?.lng ?? null,
        }),
      });
      const json = await res.json();
      setSosMsg(json?.data ? 'SOS active — contacts & ops notified' : json.message || 'SOS failed');
    } catch (e: any) {
      setSosMsg(e.message || 'SOS failed');
    }
  };

  const cancelRide = async () => {
    if (!rideId) return;
    setCancelling(true);
    try {
      await fetch(`${API}/rides/${rideId}/cancel`, {
        method: 'PUT',
        headers: authHeaders(),
      });
      onCancelled?.();
    } catch {
      /* ignore */
    } finally {
      setCancelling(false);
    }
  };

  const driver = ride?.driver;
  const eta = Number(ride?.eta_minutes ?? ride?.etaMinutes ?? 0);
  const fare = Number(ride?.estimated_fare ?? ride?.fare ?? 0);
  const currency = ride?.currency || 'NGN';
  const plate = (driver?.vehicle?.plate || '').replace(/-/g, ' ');
  const model = driver?.vehicle?.model || '';
  const color = driver?.vehicle?.color || '';
  const rating = Number(driver?.rating ?? 0).toFixed(1);
  const trips = Number(driver?.tripCount ?? 0);
  const banner = ride?.etaLabel || `Driver is ${eta} min away`;
  const payment = ride?.paymentMethod || '';

  if (chatOpen && rideId) {
    return <RideChatScreen rideId={rideId} onBack={() => setChatOpen(false)} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 28 }}>
      {loading ? <Text style={styles.loadState}>Loading ride…</Text> : null}
      {loadError ? <Text style={styles.sosMsg}>{loadError}</Text> : null}
      {!ride ? null : <>
      {rideId ? (
        <RecordingNoticeModal
          visible={!noticeAcked}
          rideId={rideId}
          onAcknowledged={() => setNoticeAcked(true)}
        />
      ) : null}

      <View style={styles.map}>
        <View style={styles.grid} />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>• {banner}</Text>
        </View>
        <View style={styles.carGlow} />
        <Text style={styles.car}>🚗</Text>
        <Text style={styles.pin}>📍</Text>
      </View>

      <Text style={styles.matched}>{ride?.matchedHeadline || 'Driver matched!'}</Text>
      <Text style={styles.arriving}>
        Arriving in <Text style={styles.arrivingAccent}>{eta} min</Text>
      </Text>

      <View style={styles.card}>
        {driver?.avatarUrl ? (
          <Image source={{ uri: driver.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={{ fontSize: 26 }}>👨</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{driver?.name || ride?.driver_name || ''}</Text>
          <Text style={styles.meta}>
            {model} · {color}
          </Text>
          <Text style={styles.stars}>
            {'★★★★★'} {rating} · {trips} trips
          </Text>
        </View>
        <View style={styles.plate}>
          <Text style={styles.plateText}>{plate}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={() => {
            const phone = proxy || driver?.phone;
            if (phone) Linking.openURL(`tel:${phone}`);
          }}
        >
          <Text style={styles.actionIcon}>📞</Text>
          <Text style={styles.actionLabel}>Call</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => setChatOpen((v) => !v)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Message</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.sos]} onPress={triggerSos}>
          <Text style={styles.sosIcon}>SOS</Text>
          <Text style={styles.sosLabel}>SOS</Text>
        </Pressable>
      </View>

      {sosMsg ? <Text style={styles.sosMsg}>{sosMsg}</Text> : null}

      <View style={styles.payRow}>
        <Text style={styles.payLabel}>Paying with</Text>
        <Text style={styles.payVal}>💳  {payment}</Text>
      </View>
      <View style={styles.payRow}>
        <Text style={styles.payLabel}>Fare estimate</Text>
        <Text style={styles.fare}>{formatCurrency(fare, currency)}</Text>
      </View>


      <Pressable style={styles.cancel} onPress={cancelRide} disabled={cancelling}>
        <Text style={styles.cancelText}>{cancelling ? 'Cancelling…' : 'Cancel Ride'}</Text>
      </Pressable>

      {onComplete ? (
        <Pressable style={styles.doneLink} onPress={onComplete}>
          <Text style={styles.doneText}>Trip complete →</Text>
        </Pressable>
      ) : null}
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', padding: spacing[4] },
  map: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#0c0c12',
    marginBottom: spacing[4],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f1f28',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  banner: {
    alignSelf: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 2,
  },
  bannerText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  carGlow: {
    position: 'absolute',
    left: '30%',
    top: '42%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,85,247,0.35)',
  },
  car: { position: 'absolute', left: '34%', top: '46%', fontSize: 22 },
  pin: { position: 'absolute', right: '24%', bottom: '26%', fontSize: 22 },
  matched: { color: '#A1A1AA', textAlign: 'center', fontSize: 16 },
  arriving: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: spacing[4],
  },
  arrivingAccent: { color: '#A855F7' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 18,
    padding: 14,
    marginBottom: spacing[4],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#fff', fontWeight: '700', fontSize: 16 },
  meta: { color: '#A1A1AA', fontSize: 13, marginTop: 2 },
  stars: { color: '#F59E0B', fontSize: 12, marginTop: 4 },
  plate: {
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#0A0A0A',
  },
  plateText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: spacing[4] },
  action: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: { fontSize: 18 },
  actionLabel: { color: '#fff', fontWeight: '600', fontSize: 12 },
  sos: { backgroundColor: '#7F1D1D' },
  sosIcon: { color: '#fff', fontWeight: '900', fontSize: 14 },
  sosLabel: { color: '#FCA5A5', fontWeight: '700', fontSize: 12 },
  sosMsg: { color: '#F87171', textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  payLabel: { color: '#A1A1AA', fontSize: 14 },
  payVal: { color: '#fff', fontWeight: '700' },
  fare: { color: '#fff', fontWeight: '800', fontSize: 16 },
  chat: {
    backgroundColor: '#141414',
    borderRadius: radius.md,
    padding: spacing[3],
    marginVertical: spacing[3],
  },
  chatMsg: { color: '#A1A1AA', marginBottom: 4 },
  chatMine: { color: '#fff', textAlign: 'right' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: radius.sm,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  send: { color: '#A855F7', fontWeight: '700' },
  cancel: {
    marginTop: spacing[4],
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  cancelText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  doneLink: { marginTop: 12, alignItems: 'center' },
  doneText: { color: '#A855F7', fontWeight: '600' },
  loadState: { color: '#A1A1AA', textAlign: 'center', marginVertical: spacing[4] },
});
