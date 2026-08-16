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
        body: JSON.stringify({ ...authIdBody(value), skipDelivery: firebasePhone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not send code');
      if (isEmail && json.data?.delivery !== 'oob_email') {
        try {
          await firebaseSendPasswordReset(value);
        } catch {
          /* backend SendGrid / OTP still applied */
        }
      }
      setMsg(json.message || 'Reset code sent');
      onSent?.(json.data?.identifier || value, json.data?.devCode, firebasePhone);
    } catch (e: any) {
      setError(e.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.sub}>
        Enter your email or phone. We verify through Firebase (email link or SMS OTP).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="you@email.com or +233…"
        placeholderTextColor="#71717A"
        autoCapitalize="none"
        value={identifier}
        onChangeText={setIdentifier}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      <Pressable style={styles.cta} onPress={send} disabled={loading}>
        <Text style={styles.ctaText}>{loading ? 'Sending…' : 'Send reset code'}</Text>
      </Pressable>
      {onBack ? (
        <Pressable onPress={onBack} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: '#5B8AFF', fontWeight: '600' }}>Back to sign in</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[5], paddingTop: 80 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  sub: { color: '#A1A1AA', textAlign: 'center', marginTop: 12, marginBottom: 36, lineHeight: 22 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    color: '#FFF',
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
    backgroundColor: '#0F766E',
  },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
