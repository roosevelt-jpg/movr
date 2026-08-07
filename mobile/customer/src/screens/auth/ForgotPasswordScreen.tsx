import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Reset password — send code to phone (mockup). */
export default function ForgotPasswordScreen({
  onSent,
}: {
  onSent?: (phone: string, devCode?: string) => void;
}) {
  const [phone, setPhone] = useState('+233 24 000 0000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const send = async () => {
    if (!phone.trim()) {
      setError('Enter your phone number');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), purpose: 'reset' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not send code');
      setMsg(json.message || 'Reset code sent');
      onSent?.(phone.trim(), json.data?.devCode);
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
      <Text style={styles.sub}>Enter your phone number and we’ll send a reset code</Text>

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        style={styles.input}
        placeholder="+233 24 000 0000"
        placeholderTextColor="#71717A"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={send} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Sending…' : 'Send reset code'}</Text>
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
});
