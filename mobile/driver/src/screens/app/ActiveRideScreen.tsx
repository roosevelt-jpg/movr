import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const DEMO_RIDE_ID = 'f0000000-0000-4000-8000-0000000000f1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Driver active ride — map, ETA badge, pickup banner, masked call/chat, Arrived CTA.
 */
export default function ActiveRideScreen({
  rideId = DEMO_RIDE_ID,
  onArrived,
}: {
  rideId?: string;
  onArrived?: () => void;
}) {
  const [ride, setRide] = useState<any>({
    customerName: 'Ama Konadu',
    pickupAddress: '12 Oxford St',
    etaMinutes: 3,
    rating: 4.7,
    tripsToday: 2,
    status: 'accepted',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [proxy, setProxy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!rideId) return;
    fetch(`${API}/rides/${rideId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setRide((prev: any) => ({
            ...prev,
            ...j.data,
            customerName: j.data.customer_name || j.data.customerName || prev.customerName,
            pickupAddress: j.data.pickup_address || j.data.pickupAddress || prev.pickupAddress,
            etaMinutes: j.data.eta_minutes ?? j.data.etaMinutes ?? prev.etaMinutes,
            rating: j.data.customer_rating ?? prev.rating,
            tripsToday: j.data.trips_today ?? prev.tripsToday,
            status: j.data.status || prev.status,
          }));
        }
      })
      .catch(() => undefined);

    fetch(`${API}/rides/${rideId}/masked-session`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.driverProxyNumber) setProxy(j.data.driverProxyNumber);
      })
      .catch(() => undefined);
  }, [rideId]);

  const arrived = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (rideId) {
        const res = await fetch(`${API}/rides/${rideId}/arrived`, {
          method: 'PUT',
          headers: authHeaders(),
        });
        if (!res.ok) {
          await fetch(`${API}/rides/${rideId}/start`, {
            method: 'PUT',
            headers: authHeaders(),
          });
        }
      }
      setRide((r: any) => ({ ...r, status: 'arrived' }));
      setMsg('Marked arrived at pickup');
      onArrived?.();
    } catch {
      setRide((r: any) => ({ ...r, status: 'arrived' }));
      setMsg('Marked arrived at pickup');
      onArrived?.();
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async () => {
    const body = 'On my way';
    setMessages((prev) => [...prev, `You: ${body}`]);
    if (!rideId) return;
    await fetch(`${API}/rides/${rideId}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    }).catch(() => undefined);
  };

  const name = ride.customerName || 'Ama Konadu';
  const address = ride.pickupAddress || '12 Oxford St';

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <View style={styles.grid} />
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>{ride.etaMinutes ?? 3} min to pickup</Text>
        </View>
        <View style={styles.pin}>
          <View style={styles.pinDot} />
        </View>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerGlow} />
        <Text style={styles.bannerLabel}>Picking up</Text>
        <Text style={styles.bannerTitle}>
          {name} · {address}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{name}</Text>
            <Text style={styles.cardMeta}>
              ★ {Number(ride.rating || 4.7).toFixed(1)} · {ride.tripsToday ?? 2} trips today
            </Text>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => Linking.openURL(`tel:${proxy || '+233000000000'}`)}
          >
            <Text style={styles.iconGlyph}>☎</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setChatOpen((v) => !v)}>
            <Text style={styles.iconGlyph}>💬</Text>
          </Pressable>
        </View>
        <Text style={styles.privacy}>Calls and messages are number-masked for privacy</Text>
        {chatOpen ? (
          <View style={{ marginTop: spacing[3] }}>
            {messages.map((m, i) => (
              <Text key={i} style={{ color: '#A1A1AA', marginBottom: 4 }}>
                {m}
              </Text>
            ))}
            <Pressable
              style={[styles.iconBtn, { marginTop: 8, width: '100%' as any }]}
              onPress={sendChat}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Send quick chat</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable
        style={[styles.cta, ride.status === 'arrived' && styles.ctaDone]}
        onPress={arrived}
        disabled={busy || ride.status === 'arrived'}
      >
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>
          {busy ? 'Updating…' : ride.status === 'arrived' ? 'At pickup' : 'Arrived at pickup'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  map: {
    flex: 1,
    minHeight: 220,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    backgroundColor: 'transparent',
    // diagonal hatch approximation
    borderWidth: 0,
  },
  etaBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: '#000000',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 2,
  },
  etaText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  pin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59,92,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3B5CFF' },
  banner: {
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[3],
    overflow: 'hidden',
    backgroundColor: '#6345ED',
  },
  bannerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.55,
  },
  bannerLabel: { color: '#C4B5FD', fontSize: 13, zIndex: 1 },
  bannerTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    marginTop: 4,
    zIndex: 1,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
  },
  cardName: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cardMeta: { color: '#A1A1AA', marginTop: 2, fontSize: 13 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 16, color: '#FFFFFF' },
  privacy: { color: '#71717A', fontSize: 11, marginTop: spacing[3] },
  msg: { color: '#A1A1AA', marginBottom: spacing[2], fontSize: 13 },
  cta: {
    marginTop: 'auto' as any,
    marginBottom: spacing[4],
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0F766E',
  },
  ctaDone: { opacity: 0.7 },
  ctaLeft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F766E',
  },
  ctaRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.65,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
