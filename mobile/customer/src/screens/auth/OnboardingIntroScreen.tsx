import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const FALLBACK = [
  {
    title: 'Ride, shop, and deliver — all in one app',
    body: 'Book a ride, order from local stores, or send a parcel, all from the same place.',
    icon_key: 'van',
  },
  {
    title: 'Pay with wallet, MoMo, or card',
    body: 'Top up once and use Movr across rides, orders, and deliveries.',
    icon_key: 'wallet',
  },
  {
    title: 'Earn points on every trip',
    body: 'Redeem rewards or convert points when DVT launches.',
    icon_key: 'points',
  },
];

/** First-run onboarding carousel — live /public/onboarding. */
export default function OnboardingIntroScreen({ onDone }: { onDone?: () => void }) {
  const [slides, setSlides] = useState(FALLBACK);
  const [step, setStep] = useState(0);

  useEffect(() => {
    fetch(`${API}/public/onboarding`)
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body?.data) && body.data.length) setSlides(body.data);
      })
      .catch(() => undefined);
  }, []);

  const slide = slides[step] || FALLBACK[0];

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else onDone?.();
  };

  const icon =
    slide.icon_key === 'wallet' ? '💳' : slide.icon_key === 'points' ? '✦' : '🚐';

  return (
    <View style={styles.root}>
      <View style={styles.mid}>
        <View style={styles.illust}>
          <Text style={styles.illustIcon}>{icon}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.btn} onPress={next}>
          <View style={styles.btnGradA} />
          <View style={styles.btnGradB} />
          <Text style={styles.btnText}>
            {step < slides.length - 1 ? 'Next' : 'Get started'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    justifyContent: 'space-between',
  },
  mid: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  illust: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[8],
  },
  illustIcon: { fontSize: 48, color: '#3B5CFF' },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  body: {
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  footer: { gap: spacing[5] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2A2A2A' },
  dotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B5CFF',
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#0F766E',
  },
  btnGradA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#6B21A8', opacity: 0.7 },
  btnGradB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.55,
    left: '40%',
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
