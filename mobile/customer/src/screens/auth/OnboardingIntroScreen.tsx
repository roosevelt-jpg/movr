import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const SLIDES = [
  {
    title: 'Ride, shop, and deliver — all in one app',
    body: 'Book a ride, order from local stores, or send a parcel, all from the same place.',
  },
  {
    title: 'Pay with wallet, MoMo, or card',
    body: 'Top up once and use Movr across rides, orders, and deliveries.',
  },
  {
    title: 'Earn points on every trip',
    body: 'Redeem rewards or convert points when DVT launches.',
  },
];

/** First-run onboarding carousel after splash. */
export default function OnboardingIntroScreen({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];

  const next = () => {
    if (step < SLIDES.length - 1) setStep(step + 1);
    else onDone?.();
  };

  return (
    <View style={styles.root}>
      <View style={styles.mid}>
        <View style={styles.illust}>
          <Text style={styles.illustIcon}>🚐</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.btn} onPress={next}>
          <Text style={styles.btnText}>{step < SLIDES.length - 1 ? 'Next' : 'Get started'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.jetBlack,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    justifyContent: 'space-between',
  },
  mid: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  illust: {
    width: 160,
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[8],
  },
  illustIcon: { fontSize: 48, color: colors.motionBlue },
  title: {
    color: colors.pureWhite,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  body: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  footer: { gap: spacing[5] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: {
    width: 28,
    backgroundColor: colors.motionBlue,
  },
  btn: {
    backgroundColor: colors.motionBlue,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
});
