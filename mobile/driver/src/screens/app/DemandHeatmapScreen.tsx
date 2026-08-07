import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Hotspot = { lat?: number; lng?: number; intensity?: number; x?: number; y?: number };

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Demand near you — live surge / zone from driver_demand_zones. */
export default function DemandHeatmapScreen() {
  const [surge, setSurge] = useState(1.4);
  const [zone, setZone] = useState('Osu & East Legon');
  const [level, setLevel] = useState('High demand');
  const [hotspots, setHotspots] = useState<Hotspot[]>([
    { intensity: 0.9 },
    { intensity: 0.75 },
    { intensity: 0.4 },
  ]);

  useEffect(() => {
    fetch(`${API}/driver/demand-nearby`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.surge != null) setSurge(Number(j.data.surge));
        if (j?.data?.zone) setZone(j.data.zone);
        if (j?.data?.level) setLevel(j.data.level);
        if (Array.isArray(j?.data?.hotspots) && j.data.hotspots.length) {
          setHotspots(j.data.hotspots);
        }
      })
      .catch(() => undefined);
  }, []);

  const glowLayout = [
    { top: 36, right: 28, size: 150 },
    { top: 48, left: '38%' as const, size: 110 },
    { bottom: 40, left: 36, size: 72 },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Demand near you</Text>

      <View style={styles.map}>
        {glowLayout.map((pos, i) => {
          const hs = hotspots[i] || hotspots[0];
          const intensity = Number(hs?.intensity ?? 0.6);
          const size = pos.size * (0.75 + intensity * 0.35);
          const isWarm = intensity < 0.55;
          return (
            <View
              key={i}
              style={[
                styles.glow,
                {
                  width: size,
                  height: size,
                  backgroundColor: isWarm ? '#E8B84A' : '#E85A7A',
                  opacity: 0.45 + intensity * 0.25,
                  top: 'top' in pos ? pos.top : undefined,
                  bottom: 'bottom' in pos ? pos.bottom : undefined,
                  left: 'left' in pos ? (pos.left as any) : undefined,
                  right: 'right' in pos ? pos.right : undefined,
                },
              ]}
            />
          );
        })}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{surge}x surge nearby</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.zone}>{zone}</Text>
        <Text style={styles.level}>{level}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[5],
  },
  map: {
    height: 300,
    borderRadius: 24,
    backgroundColor: '#141414',
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  zone: { color: 'rgba(255,255,255,0.55)', fontSize: 15 },
  level: { color: '#F0A0A8', fontWeight: '700' },
});
