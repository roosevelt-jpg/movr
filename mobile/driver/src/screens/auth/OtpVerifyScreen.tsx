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

export default function OtpVerifyScreen({
  phone,
  identifier,
  purpose = 'reset',
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
          /* fall through */
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

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Enter reset code</Text>
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
            style={styles.box}
            keyboardType="number-pad"
            maxLength={i === 0 ? 6 : 1}
            value={d}
            onChangeText={(t) => setDigit(i, t)}
          />
        ))}
      </View>
      <Pressable onPress={resend}>
        <Text style={styles.resend}>
          {seconds > 0 ? `Resend (0:${String(seconds).padStart(2, '0')})` : 'Resend'}
        </Text>
      </Pressable>
      {hint ? <Text style={styles.ok}>{hint}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.cta} onPress={verify} disabled={loading}>
        <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify Code'}</Text>
      </Pressable>
      {onBack ? (
        <Pressable onPress={onBack} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={styles.resend}>Use a different email or phone</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[5], paddingTop: 72 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  sub: { color: '#A1A1AA', textAlign: 'center', marginTop: 12, marginBottom: 36 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  box: {
    width: 46,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    color: '#FFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  resend: { color: '#A855F7', textAlign: 'center', marginBottom: 20, fontWeight: '700' },
  ok: { color: '#4ADE80', textAlign: 'center', marginBottom: 12 },
  err: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
  cta: {
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
