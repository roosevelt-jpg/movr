import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
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

/** Driver navigation to pickup — turn-by-turn, passenger, Arrived (mockup). */
export default function ActiveRideScreen({
  rideId,
  onArrived,
}: {
  rideId?: string;
  onArrived?: () => void;
}) {
  const [nav, setNav] = useState<any>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rideId) {
      setLoading(false);
      setMsg('Ride not found');
      return;
    }
    fetch(`${API}/driver/rides/${rideId}/nav`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setNav(j.data);
        else throw new Error('Ride not found');
      })
      .catch((e) => setMsg(e?.message || 'Could not load ride'))
      .finally(() => setLoading(false));

    fetch(`${API}/rides/${rideId}/masked-session`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.driverProxyNumber) setProxy(j.data.driverProxyNumber);
      })
      .catch(() => undefined);
  }, [rideId]);

  const arrived = async () => {
    setBusy(true);
    try {
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
      if (!res.ok) throw new Error('Could not update ride');
      setMsg('Arrived at pickup');
      onArrived?.();
    } catch (e: any) {
      setMsg(e?.message || 'Could not update ride');
    } finally {
      setBusy(false);
    }
  };

  const p = nav?.passenger || {};

  return (
    <View style={styles.root}>
      {loading ? <Text style={styles.msg}>Loading ride…</Text> : null}
      {!nav ? <Text style={styles.msg}>{msg || 'No active ride.'}</Text> : null}
      {nav ? <>
      <View style={styles.navBox}>
        <View style={styles.turnIcon}>
          <Text style={styles.turnArrow}>↱</Text>
        </View>
        <Text style={styles.navText} numberOfLines={2}>
          {nav.instruction}
        </Text>
        <Text style={styles.left}>{Number(nav.distanceLeftKm)} km left</Text>
      </View>

      <View style={styles.map}>
        <View style={styles.path} />
        <Text style={styles.car}>🚗</Text>
        <View style={styles.dest} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{nav.etaMinutes} min</Text>
          <Text style={styles.metricLab}>ETA</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricVal, { color: '#A78BFA' }]}>
            {formatCurrency(Number(nav.earnings || 0), nav.currency || 'NGN')}
          </Text>
          <Text style={styles.metricLab}>Earnings</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricVal, { color: '#A78BFA' }]}>+{nav.dvtReward || 0}</Text>
          <Text style={[styles.metricLab, { color: '#A78BFA' }]}>DVT</Text>
        </View>
      </View>

      <View style={styles.passenger}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{p.initials || ''}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{p.name || ''}</Text>
          <Text style={styles.rating}>★★★★★ {Number(p.rating || 0).toFixed(1)} passenger</Text>
        </View>
        <Pressable
          style={styles.comm}
          onPress={() => Linking.openURL(`tel:${proxy || ''}`).catch(() => undefined)}
        >
          <Text>📞</Text>
        </Pressable>
        <Pressable
          style={styles.comm}
          onPress={() =>
            Linking.openURL(`${API.replace('/api/v1', '')}/ride/${rideId}/chat`).catch(
              () => undefined
            )
          }
        >
          <Text>💬</Text>
        </Pressable>
      </View>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: '#A78BFA' }]} />
          <Text style={styles.routeText}>{nav.pickup}</Text>
        </View>
        <View style={styles.line} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.routeText}>{nav.dropoff}</Text>
        </View>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.arrived} onPress={arrived} disabled={busy}>
        <Text style={styles.arrivedText}>{busy ? '…' : 'Arrived at Pickup'}</Text>
      </Pressable>
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  navBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: spacing[3],
  },
  turnIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnArrow: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  navText: { flex: 1, color: '#FFF', fontWeight: '600', fontSize: 13 },
  left: { color: '#A1A1AA', fontWeight: '700', fontSize: 12 },
  map: {
    height: 200,
    borderRadius: 18,
    backgroundColor: '#0A0A0F',
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  path: {
    position: 'absolute',
    width: 4,
    height: '70%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    transform: [{ rotate: '25deg' }],
  },
  car: { fontSize: 32, zIndex: 2 },
  dest: {
    position: 'absolute',
    bottom: 40,
    right: 80,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F97316',
  },
  metrics: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: spacing[3],
  },
  metric: { flex: 1, alignItems: 'center' },
  metricVal: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  metricLab: { color: '#71717A', fontSize: 11, marginTop: 4 },
  passenger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing[3],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800' },
  name: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  rating: { color: '#EAB308', fontSize: 12, marginTop: 3 },
  comm: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  route: {
    backgroundColor: '#0A0A0A',
    borderRadius: 14,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 2, height: 12, backgroundColor: '#3F3F46', marginLeft: 4, marginVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeText: { color: '#E4E4E7', fontWeight: '600' },
  msg: { color: '#A1A1AA', textAlign: 'center', marginBottom: 8 },
  arrived: {
    marginTop: 'auto',
    marginBottom: spacing[5],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    backgroundColor: '#052E16',
    paddingVertical: 16,
    alignItems: 'center',
  },
  arrivedText: { color: '#4ADE80', fontWeight: '800', fontSize: 16 },
});
