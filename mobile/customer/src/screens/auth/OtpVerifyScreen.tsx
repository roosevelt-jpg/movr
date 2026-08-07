import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** 5-digit OTP verify screen (mockup). */
export default function OtpVerifyScreen({
  phone = '+233 24 000 0000',
  purpose = 'signup',
  onVerified,
}: {
  phone?: string;
  purpose?: 'signup' | 'reset';
  onVerified?: (payload?: { resetToken?: string }) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '', '']);
  const [seconds, setSeconds] = useState(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    const code = digits.join('');
    if (code.length < 5) {
      setError('Enter the 5-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Invalid code');
      onVerified?.({ resetToken: json.data?.resetToken });
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setSeconds(42);
    setError('');
    await fetch(`${API}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purpose }),
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
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
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

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={verify} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: spacing[5],
    paddingTop: 80,
  },
  icon: { fontSize: 40, textAlign: 'center', marginBottom: 20, color: '#5B8AFF' },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 36,
    fontSize: 15,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  box: {
    width: 52,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: 'transparent',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  boxFocus: { borderColor: '#3B5CFF' },
  resend: { color: '#A1A1AA', textAlign: 'center', marginBottom: 28 },
  err: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
  cta: {
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0F766E',
  },
  ctaLeft: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F766E' },
  ctaRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.7,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
