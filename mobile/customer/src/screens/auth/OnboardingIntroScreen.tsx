import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Landing = {
  brand: string;
  tagline: string;
  headline: string;
  body: string;
  ctaPrimary: string;
  ctaSecondary: string;
  chips: { label: string; icon: string }[];
};

const FALLBACK: Landing = {
  brand: 'Movr',
  tagline: 'MOVE · SHOP · DELIVER',
  headline: "Africa's Super-App Is Here",
  body: 'One platform for rides, shopping, deliveries, and rentals — powered by blockchain rewards.',
  ctaPrimary: 'Get Started',
  ctaSecondary: 'Already have an account? Sign in',
  chips: [
    { label: 'Ride', icon: '🚗' },
    { label: 'Shop', icon: '🛍️' },
    { label: 'Deliver', icon: '📦' },
  ],
};

/** Landing / onboarding — brand hero, service chips, Get Started + Sign in. */
export default function OnboardingIntroScreen({
  onDone,
  onSignIn,
}: {
  onDone?: () => void;
  onSignIn?: () => void;
}) {
  const [landing, setLanding] = useState<Landing>(FALLBACK);

  useEffect(() => {
    fetch(`${API}/public/onboarding`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.landing) {
          const L = body.landing;
          setLanding({
            brand: L.brand || FALLBACK.brand,
            tagline: L.tagline || FALLBACK.tagline,
            headline: L.headline || FALLBACK.headline,
            body: L.body || FALLBACK.body,
            ctaPrimary: L.ctaPrimary || FALLBACK.ctaPrimary,
            ctaSecondary: L.ctaSecondary || FALLBACK.ctaSecondary,
            chips: (L.chips || FALLBACK.chips).map((c: any, i: number) => ({
              label: c.label,
              icon: FALLBACK.chips[i]?.icon || '✨',
            })),
          });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.topGlow} />
      <View style={styles.mid}>
        <Text style={styles.brand}>{landing.brand}</Text>
        <Text style={styles.tagline}>{landing.tagline}</Text>

        <View style={styles.chips}>
          {landing.chips.map((c) => (
            <View key={c.label} style={styles.chip}>
              <Text style={styles.chipIcon}>{c.icon}</Text>
              <Text style={styles.chipText}>{c.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.headline}>{landing.headline}</Text>
        <Text style={styles.body}>{landing.body}</Text>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.btn} onPress={onDone}>
          <View style={styles.btnGradA} />
          <View style={styles.btnGradB} />
          <Text style={styles.btnText}>{landing.ctaPrimary}</Text>
        </Pressable>
        <Pressable onPress={onSignIn || onDone}>
          <Text style={styles.signIn}>
            Already have an account? <Text style={styles.signInBold}>Sign in</Text>
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
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#8E2DE2',
  },
  mid: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  brand: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
    textShadowColor: 'rgba(142,45,226,0.55)',
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  tagline: {
    color: '#A1A1AA',
    fontSize: 13,
    letterSpacing: 3,
    marginTop: 12,
    marginBottom: 28,
    fontWeight: '500',
  },
  chips: { flexDirection: 'row', gap: 10, marginBottom: 36, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipIcon: { fontSize: 14 },
  chipText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  headline: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  body: {
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  footer: { gap: spacing[4], paddingBottom: 8 },
  btn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#3B5CFF',
  },
  btnGradA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#8E2DE2', opacity: 0.85 },
  btnGradB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.75,
    left: '35%',
  },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, zIndex: 1 },
  signIn: { color: '#A1A1AA', textAlign: 'center', fontSize: 14 },
  signInBold: { color: '#FFFFFF', fontWeight: '700' },
});
