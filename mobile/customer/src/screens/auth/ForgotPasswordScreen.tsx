import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { apiBase, authIdBody, identifierLooksValid } from '../../lib/api-base';
import { firebaseSendPasswordReset, startFirebasePhoneAuth } from '../../lib/firebase';

const API = () => apiBase();

function toE164(value: string) {
  const trimmed = value.replace(/[\s\-()]/g, '');
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/^\+/, '')}`;
}

/** Request a password reset via Firebase email or phone OTP. */
export default function ForgotPasswordScreen({
  onSent,
  onBack,
}: {
  onSent?: (identifier: string, devCode?: string, firebasePhone?: boolean) => void;
  onBack?: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const send = async () => {
    const value = identifier.trim();
    if (!identifierLooksValid(value)) {
      setError('Enter your email or phone number');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const isEmail = value.includes('@');
      let firebasePhone = false;
      if (!isEmail) {
        try {
          firebasePhone = await startFirebasePhoneAuth(toE164(value));
        } catch {
          firebasePhone = false;
        }
      }

      const res = await fetch(`${API()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authIdBody(value),
          skipDelivery: firebasePhone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not send code');
      const id = json.data?.identifier || value;

      if (isEmail && json.data?.delivery !== 'oob_email') {
        try {
          await firebaseSendPasswordReset(value);
        } catch {
          /* backend SendGrid / OTP still applied */
        }
      }

      setMsg(json.message || 'Reset code sent');
      onSent?.(id, json.data?.devCode, firebasePhone);
    } catch (e: any) {
      setError(e.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.sub}>
        Enter your email or phone. We verify through Firebase (email link or SMS OTP).
      </Text>

      <Text style={styles.label}>Email or phone</Text>
      <TextInput
        style={styles.input}
        placeholder="you@email.com or +233…"
        placeholderTextColor="#71717A"
        autoCapitalize="none"
        keyboardType="default"
        value={identifier}
        onChangeText={setIdentifier}
      />

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={send} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Sending…' : 'Send reset code'}</Text>
      </Pressable>

      {onBack ? (
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>Back to sign in</Text>
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
    paddingTop: 80,
  },
  lock: { fontSize: 40, textAlign: 'center', marginBottom: 20, color: '#5B8AFF' },
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
    lineHeight: 22,
    fontSize: 15,
    paddingHorizontal: 8,
  },
  label: { color: '#A1A1AA', fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[5],
    fontSize: 15,
  },
  ok: { color: '#4ADE80', marginBottom: 12 },
  err: { color: '#F87171', marginBottom: 12 },
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
  back: { marginTop: 20, alignItems: 'center' },
  backText: { color: '#5B8AFF', fontWeight: '600' },
});
