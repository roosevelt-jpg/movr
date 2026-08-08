import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Share } from 'react-native';
import { spacing } from '@movr/design-system/theme';

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

/** Parcel tracking — map ETA, courier, timeline, share link (mockup). */
export default function ParcelTrackingScreen({
  parcelRef,
  onBack,
}: {
  parcelRef?: string;
  onBack?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parcelRef) {
      setLoading(false);
      setMsg('Parcel not found');
      return;
    }
    fetch(`${API}/deliveries/track/${encodeURIComponent(parcelRef)}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData(j.data);
        else throw new Error('Parcel not found');
      })
      .catch((e) => setMsg(e?.message || 'Could not load parcel'))
      .finally(() => setLoading(false));
  }, [parcelRef]);

  const share = async () => {
    if (!data?.id) return;
    try {
      const res = await fetch(`${API}/deliveries/${data.id}/share-link`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const j = await res.json();
      const url = j?.data?.shareUrl || data.shareUrl;
      setMsg('Link ready');
      if (typeof Share !== 'undefined' && Share.share) {
        await Share.share({ message: `Track my Movr parcel: ${url}`, url });
      } else if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(url);
        setMsg('Tracking link copied');
      }
    } catch (e: any) {
      setMsg(e?.message || 'Could not create tracking link');
    }
  };

  const c = data?.courier || {};
  const progress = Math.min(0.85, Math.max(0, Number(data?.progress || 0)));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {loading ? <Text style={styles.msg}>Loading parcel…</Text> : null}
        {!data ? <Text style={styles.msg}>{msg || 'No parcel data.'}</Text> : null}
        {data ? <>
        <View style={styles.map}>
          <View style={styles.grid} />
          <Text style={styles.bike}>🛵</Text>
          <View style={styles.tooltip}>
            <Text style={styles.tooltipTxt}>{data.etaLabel}</Text>
          </View>
          <View style={styles.progressTrack}>
            <Text style={styles.boxIcon}>📦</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.pinIcon}>📍</Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{data.label}</Text>
            <Text style={styles.sub}>{data.scheduledLabel}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{data.statusLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.courierRow}>
            <View style={styles.avatar}>
              <Text>🛵</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.courierName}>{c.name}</Text>
              <Text style={styles.courierTitle}>
                {c.title || ''} · ★ {Number(c.rating || 0).toFixed(1)}
              </Text>
            </View>
            <Pressable
              style={styles.comm}
              onPress={() => Linking.openURL(`tel:${c.phone || ''}`).catch(() => undefined)}
            >
              <Text>📞</Text>
            </Pressable>
            <Pressable style={styles.comm}>
              <Text>💬</Text>
            </Pressable>
          </View>
          <View style={styles.route}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: '#A78BFA' }]} />
              <Text style={styles.routeTxt}>{data.pickup}</Text>
            </View>
            <View style={styles.line} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.routeTxt}>{data.dropoff}</Text>
            </View>
          </View>
        </View>

        <View style={styles.timeline}>
          {(data.timeline || []).map((t: any) => (
            <View key={t.id} style={styles.step}>
              <View
                style={[
                  styles.stepDot,
                  t.state === 'done' && styles.stepDone,
                  t.state === 'active' && styles.stepActive,
                ]}
              />
              <Text
                style={[
                  styles.stepLab,
                  t.state === 'active' && styles.stepLabActive,
                  t.state === 'pending' && styles.stepLabPending,
                ]}
              >
                {t.label}
              </Text>
            </View>
          ))}
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </> : null}
      </ScrollView>

      {data ? <Pressable style={styles.shareBar} onPress={share}>
        <Text style={styles.shareLeft}>Share tracking link</Text>
        <Text style={styles.shareRight}>share ↗</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  map: {
    height: 160,
    borderRadius: 18,
    backgroundColor: '#0A0A0F',
    marginTop: spacing[3],
    marginBottom: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  grid: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: '#27272A', opacity: 0.4 },
  bike: { fontSize: 28, marginBottom: 20 },
  tooltip: {
    position: 'absolute',
    top: 16,
    backgroundColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tooltipTxt: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  progressTrack: {
    position: 'absolute',
    bottom: 18,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boxIcon: { fontSize: 16 },
  pinIcon: { fontSize: 16 },
  barBg: { flex: 1, height: 4, backgroundColor: '#3F3F46', borderRadius: 2 },
  barFill: { height: 4, backgroundColor: '#8E2DE2', borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3] },
  title: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 4 },
  badge: {
    backgroundColor: '#4C1D95',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeTxt: { color: '#E9D5FF', fontWeight: '800', fontSize: 12 },
  card: { backgroundColor: '#141414', borderRadius: 16, padding: 14, marginBottom: spacing[4] },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierName: { color: '#FFF', fontWeight: '800' },
  courierTitle: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
  comm: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  route: { paddingLeft: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 2, height: 12, backgroundColor: '#3F3F46', marginLeft: 3, marginVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeTxt: { color: '#E4E4E7', fontWeight: '600', flex: 1 },
  timeline: { paddingLeft: 8, gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3F3F46',
  },
  stepDone: { backgroundColor: '#22C55E' },
  stepActive: { backgroundColor: '#A78BFA' },
  stepLab: { color: '#E4E4E7', fontWeight: '600' },
  stepLabActive: { color: '#C4B5FD', fontWeight: '800' },
  stepLabPending: { color: '#71717A' },
  msg: { color: '#A78BFA', textAlign: 'center', marginTop: 12 },
  shareBar: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  shareLeft: { color: '#A1A1AA', fontWeight: '600' },
  shareRight: { color: '#A78BFA', fontWeight: '800' },
});
