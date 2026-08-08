import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** 4-digit OTP verify — phone icon, resend timer, Verify Code (mockup). */
export default function OtpVerifyScreen({
  phone = '+234 801 234 5678',
  purpose = 'signup',
  onVerified,
}: {
  phone?: string;
  purpose?: 'signup' | 'reset';
  onVerified?: (payload?: { resetToken?: string }) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
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
    if (d && i < 3) refs.current[i + 1]?.focus();
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < 4) {
      setError('Enter the 4-digit code');
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
    if (seconds > 0) return;
    setSeconds(42);
    setError('');
    setDigits(['', '', '', '']);
    refs.current[0]?.focus();
    await fetch(`${API}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purpose }),
    }).catch(() => undefined);
  };

  const focusIndex = digits.findIndex((d) => !d);
  const active = focusIndex === -1 ? 3 : focusIndex;

  return (
    <View style={styles.root}>
      <View style={styles.topLine} />
      <View style={styles.iconWrap}>
        <View style={styles.iconGlowA} />
        <View style={styles.iconGlowB} />
        <Text style={styles.icon}>📱</Text>
      </View>
      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.sub}>Code sent to {phone}</Text>

      <View style={styles.row}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={[styles.box, (i === active || d) && styles.boxFocus]}
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

      <Pressable onPress={resend}>
        <Text style={styles.resend}>
          Didn't receive it?{' '}
          <Text style={styles.resendLink}>
            {seconds > 0 ? `Resend (0:${String(seconds).padStart(2, '0')})` : 'Resend'}
          </Text>
        </Text>
      </Pressable>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={verify} disabled={loading}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify Code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: spacing[5],
    paddingTop: 56,
  },
  topLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A855F7',
    marginBottom: 36,
    opacity: 0.9,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#3B82F6',
  },
  iconGlowA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7', opacity: 0.85 },
  iconGlowB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.7,
    left: '40%',
  },
  icon: { fontSize: 36, zIndex: 1 },
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
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  box: {
    width: 56,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  boxFocus: { borderColor: '#A855F7' },
  resend: { color: '#A1A1AA', textAlign: 'center', marginBottom: 28, fontSize: 14 },
  resendLink: { color: '#A855F7', fontWeight: '700' },
  err: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
  cta: {
    marginTop: 'auto' as any,
    marginBottom: spacing[6],
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
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
