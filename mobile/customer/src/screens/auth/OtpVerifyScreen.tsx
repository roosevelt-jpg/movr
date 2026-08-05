import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** 5-digit OTP verify screen. */
export default function OtpVerifyScreen({
  phone = '+233 24 000 0000',
  onVerified,
}: {
  phone?: string;
  onVerified?: () => void;
}) {
  const [digits, setDigits] = useState(['4', '8', '2', '', '']);
  const [seconds, setSeconds] = useState(42);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 4) refs.current[i + 1]?.focus();
  };

  const verify = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: digits.join('') }),
      }).catch(() => undefined);
      onVerified?.();
    } finally {
      setLoading(false);
    }
  };

  const resend = () => {
    setSeconds(42);
    fetch(`${API}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).catch(() => undefined);
  };

  const focusIndex = digits.findIndex((d) => !d);
  const active = focusIndex === -1 ? 4 : focusIndex;

  return (
    <View style={styles.root}>
      <Text style={styles.icon}>✉</Text>
      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.sub}>Code sent to {phone}</Text>

      <View style={styles.row}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={[styles.box, i === active && styles.boxFocus]}
            keyboardType="number-pad"
            maxLength={1}
            value={d}
            onChangeText={(t) => setDigit(i, t)}
          />
        ))}
      </View>

      <Pressable onPress={seconds === 0 ? resend : undefined}>
        <Text style={styles.resend}>
          {seconds > 0
            ? `Resend code in 0:${String(seconds).padStart(2, '0')}`
            : 'Resend code'}
        </Text>
      </Pressable>

      <Pressable style={styles.cta} onPress={verify} disabled={loading}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[5], paddingTop: 80 },
  icon: { fontSize: 36, textAlign: 'center', marginBottom: 16, color: colors.motionBlue },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sub: { color: colors.textSecondary, textAlign: 'center', marginTop: 10, marginBottom: 32 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  box: {
    width: 52,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: 'transparent',
    color: colors.pureWhite,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  boxFocus: { borderColor: colors.motionBlue },
  resend: { color: colors.textSecondary, textAlign: 'center', marginBottom: 28 },
  cta: {
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.movrGreen,
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.55,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
});
