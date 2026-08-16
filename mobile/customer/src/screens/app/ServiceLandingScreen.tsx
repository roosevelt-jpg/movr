import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';

export type HomeService = 'ride' | 'shop' | 'parcel' | 'rental';

const COPY: Record<
  HomeService,
  { icon: string; title: string; kicker: string; body: string; points: string[]; cta: string }
> = {
  ride: {
    icon: '🚗',
    title: 'Ride',
    kicker: 'Fair fares · driver keeps 100%',
    body: 'Compare travel options, share a vehicle, or book a verified chauffeur — then start when you are ready.',
    points: [
      'See fares and ETAs before you confirm',
      'Share pool when you want to save',
      'Okada, cars, and verified fleet when you need them',
    ],
    cta: 'Start a ride',
  },
  shop: {
    icon: '🛍️',
    title: 'Shop',
    kicker: 'Neighbourhood stores, delivered',
    body: 'Browse local merchants, add to cart, and pay with the same Movr wallet you use for rides.',
    points: [
      'Food, grocery, pharmacy, and more',
      'Track the order to your door',
      'One account for rides and shopping',
    ],
    cta: 'Browse shops',
  },
  parcel: {
    icon: '📦',
    title: 'Parcel',
    kicker: 'Same-day across town',
    body: 'Send a document, bag, or crate. Set pickup and drop-off, then schedule a courier.',
    points: [
      'Choose package type and speed',
      'Live tracking after pickup',
      'Pay in-app with wallet or mobile money',
    ],
    cta: 'Send a parcel',
  },
  rental: {
    icon: '🔑',
    title: 'Rentals',
    kicker: 'Self-drive or chauffeur',
    body: 'Need a car for the day or a week? Pick a vehicle, dates, and how you want to drive.',
    points: [
      'Self-drive or with a chauffeur',
      'Hourly and daily options',
      'List your own car when you are ready',
    ],
    cta: 'Find a car',
  },
};

/** Intro landing for a home service — users start here, then continue into booking or browse. */
export default function ServiceLandingScreen({
  service,
  onBack,
  onStart,
}: {
  service: HomeService;
  onBack?: () => void;
  onStart?: () => void;
}) {
  const copy = COPY[service];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.body}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
      ) : null}
      <Text style={styles.icon}>{copy.icon}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.kicker}>{copy.kicker}</Text>
      <Text style={styles.bodyText}>{copy.body}</Text>
      <View style={styles.points}>
        {copy.points.map((p) => (
          <View key={p} style={styles.pointRow}>
            <Text style={styles.bullet}>✓</Text>
            <Text style={styles.point}>{p}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.cta} onPress={onStart}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{copy.cta}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  body: { paddingHorizontal: spacing[5], paddingTop: 20, paddingBottom: 48 },
  back: { color: '#A78BFA', fontWeight: '700', marginBottom: 28 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  kicker: { color: '#A78BFA', fontWeight: '700', marginTop: 8, fontSize: 14 },
  bodyText: { color: '#A1A1AA', marginTop: 14, fontSize: 16, lineHeight: 24 },
  points: { marginTop: 28, gap: 12 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { color: '#4ADE80', fontWeight: '800', marginTop: 1 },
  point: { color: '#E4E4E7', flex: 1, fontSize: 15, lineHeight: 22 },
  cta: {
    marginTop: 36,
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.85,
    left: '35%',
  },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 16, zIndex: 1 },
});
