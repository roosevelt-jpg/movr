import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { apiBase, authIdBody } from '../../lib/api-base';
import {
  confirmFirebasePhoneCode,
  hasFirebasePhoneSession,
  startFirebasePhoneAuth,
} from '../../lib/firebase';

const API = () => apiBase();
const EMPTY = ['', '', '', '', '', ''];

function toE164(value: string) {
  const trimmed = value.replace(/[\s\-()]/g, '');
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/^\+/, '')}`;
}

/** 6-digit Firebase OTP (4-digit legacy codes still accepted). */
export default function OtpVerifyScreen({
  phone,
  identifier,
  purpose = 'signup',
  firebasePhone,
  onVerified,
  onBack,
}: {
  phone?: string;
  identifier?: string;
  purpose?: 'signup' | 'reset';
  firebasePhone?: boolean;
  onVerified?: (payload?: { resetToken?: string }) => void;
  onBack?: () => void;
}) {
  const id = String(identifier || phone || '').trim();
  const [digits, setDigits] = useState(EMPTY);
  const [seconds, setSeconds] = useState(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setDigit = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const next = [...EMPTY];
      cleaned.slice(0, 6).split('').forEach((c, idx) => {
        next[idx] = c;
      });
      setDigits(next);
      refs.current[Math.min(cleaned.length, 5)]?.focus();
      return;
    }
    const d = cleaned.slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < 4) {
      setError('Enter the verification code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (firebasePhone || hasFirebasePhoneSession()) {
        try {
          const idToken = await confirmFirebasePhoneCode(code);
          if (idToken) {
            const res = await fetch(`${API()}/auth/verify-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(authIdBody(id, { purpose, firebaseIdToken: idToken })),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Invalid code');
            onVerified?.({ resetToken: json.data?.resetToken });
            return;
          }
        } catch {
          /* fall through to backend OTP */
        }
      }
      const res = await fetch(`${API()}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authIdBody(id, { code, purpose })),
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
    setDigits([...EMPTY]);
    refs.current[0]?.focus();
    try {
      let firebaseResent = false;
      if (!id.includes('@')) {
        try {
          firebaseResent = await startFirebasePhoneAuth(toE164(id));
        } catch {
          firebaseResent = false;
        }
      }
      const res = await fetch(`${API()}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authIdBody(id, { purpose }), skipDelivery: firebaseResent }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.data?.devCode) setHint(`Dev code: ${json.data.devCode}`);
    } catch {
      /* ignore */
    }
  };

  const focusIndex = digits.findIndex((d) => !d);
  const active = focusIndex === -1 ? 5 : focusIndex;

  return (
    <View style={styles.root}>
      <View style={styles.topLine} />
      <View style={styles.iconWrap}>
        <View style={styles.iconGlowA} />
        <View style={styles.iconGlowB} />
        <Text style={styles.icon}>📱</Text>
      </View>
      <Text style={styles.title}>{purpose === 'reset' ? 'Enter reset code' : 'Verify your number'}</Text>
      <Text style={styles.sub}>
        {id.includes('@')
          ? `Firebase emailed ${id}. Follow the link, or enter a code if you received one.`
          : `Code sent to ${id || 'your account'}${firebasePhone ? ' via Firebase' : ''}`}
      </Text>

      <View style={styles.row}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={[styles.box, (i === active || d) && styles.boxFocus]}
            keyboardType="number-pad"
            maxLength={i === 0 ? 6 : 1}
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

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={verify} disabled={loading}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify Code'}</Text>
      </Pressable>

      {onBack ? (
        <Pressable onPress={onBack} style={{ marginBottom: 24 }}>
          <Text style={styles.resendLink}>Use a different email or phone</Text>
        </Pressable>
      ) : null}
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
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  box: {
    width: 46,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  boxFocus: { borderColor: '#A855F7' },
  resend: { color: '#A1A1AA', textAlign: 'center', marginBottom: 28, fontSize: 14 },
  resendLink: { color: '#A855F7', fontWeight: '700', textAlign: 'center' },
  hint: { color: '#4ADE80', textAlign: 'center', marginBottom: 12 },
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
