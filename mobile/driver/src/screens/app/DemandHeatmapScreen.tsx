import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Demand heatmap — surge nearby for drivers. */
export default function DemandHeatmapScreen() {
  const [surge, setSurge] = useState(1.4);
  const [zone, setZone] = useState('Osu & East Legon');
  const [level, setLevel] = useState('High demand');

  useEffect(() => {
    fetch(`${API}/driver/demand-nearby`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.surge != null) setSurge(Number(j.data.surge));
        if (j?.data?.zone) setZone(j.data.zone);
        if (j?.data?.level) setLevel(j.data.level);
      })
      .catch(() => undefined);
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Demand near you</Text>

      <View style={styles.map}>
        <View style={[styles.glow, styles.glowA]} />
        <View style={[styles.glow, styles.glowB]} />
        <View style={[styles.glow, styles.glowC]} />
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
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: {
    color: colors.pureWhite,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing[5],
  },
  map: {
    height: 280,
    borderRadius: radius.lg,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  glowA: {
    width: 140,
    height: 140,
    backgroundColor: '#E9968B',
    top: 40,
    left: 30,
  },
  glowB: {
    width: 110,
    height: 110,
    backgroundColor: '#E9968B',
    bottom: 50,
    right: 40,
  },
  glowC: {
    width: 70,
    height: 70,
    backgroundColor: '#C9B458',
    top: 100,
    right: 90,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 12 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: spacing[4],
  },
  zone: { color: colors.textSecondary, fontSize: 15 },
  level: { color: '#E9968B', fontWeight: '700' },
});
