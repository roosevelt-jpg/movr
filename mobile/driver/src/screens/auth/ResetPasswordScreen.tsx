import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { apiBase } from '../../lib/api-base';

const API = () => apiBase();

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
      <Text style={styles.title}>Create a new password</Text>
      <Text style={styles.sub}>For {identifier || 'your account'}</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor="#71717A"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#71717A"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <Text style={styles.ctaText}>{loading ? 'Saving…' : 'Update password'}</Text>
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
  sub: { color: '#A1A1AA', textAlign: 'center', marginTop: 12, marginBottom: 36 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[4],
    fontSize: 15,
  },
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
