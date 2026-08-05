import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Reset password — send code to phone. */
export default function ForgotPasswordScreen({
  onSent,
}: {
  onSent?: (phone: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    setLoading(true);
    setMsg('');
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      }).catch(() => undefined);
      setMsg('Reset code sent');
      onSent?.(phone);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.sub}>Enter your phone number and we'll send a reset code</Text>

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        style={styles.input}
        placeholder="+233 24 000 0000"
        placeholderTextColor={colors.textSecondary}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      {msg ? <Text style={styles.ok}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={send} disabled={loading}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>{loading ? 'Sending…' : 'Send reset code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[5], paddingTop: 80 },
  lock: { fontSize: 36, textAlign: 'center', marginBottom: 16, color: colors.motionBlue },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 32,
    lineHeight: 20,
  },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[5],
    fontSize: 15,
  },
  ok: { color: colors.success, marginBottom: 12 },
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
