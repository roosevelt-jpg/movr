import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { apiBase } from '../../lib/api-base';

const API = () => apiBase();

/** Set a new password after reset OTP. */
export default function ResetPasswordScreen({
  resetToken,
  identifier,
  onDone,
  onBack,
}: {
  resetToken: string;
  identifier?: string;
  onDone?: () => void;
  onBack?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not reset password');
      onDone?.();
    } catch (e: any) {
      setError(e.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={styles.title}>Create a new password</Text>
      <Text style={styles.sub}>Choose a strong password for {identifier || 'your account'}</Text>

      <Text style={styles.label}>New password</Text>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          placeholder="At least 8 characters"
          placeholderTextColor="#71717A"
          secureTextEntry={!show}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable onPress={() => setShow((s) => !s)}>
          <Text style={styles.eye}>{show ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Confirm password</Text>
      <TextInput
        style={styles.solo}
        placeholder="Re-enter password"
        placeholderTextColor="#71717A"
        secureTextEntry={!show}
        value={confirm}
        onChangeText={setConfirm}
      />

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Saving…' : 'Update password'}</Text>
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
  lock: { fontSize: 40, textAlign: 'center', marginBottom: 20 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  sub: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 36,
    lineHeight: 22,
  },
  label: { color: '#A1A1AA', fontSize: 13, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: spacing[4],
  },
  input: { flex: 1, color: '#FFFFFF', paddingVertical: 14, fontSize: 15 },
  solo: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[5],
    fontSize: 15,
  },
  eye: { color: '#A1A1AA', fontSize: 13, padding: 6 },
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
  ctaRight: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B5CFF', opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  back: { marginTop: 20, alignItems: 'center' },
  backText: { color: '#5B8AFF', fontWeight: '600' },
});
