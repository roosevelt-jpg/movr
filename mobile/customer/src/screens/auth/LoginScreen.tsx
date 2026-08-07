import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Customer login — phone + password (mockup). */
export default function LoginScreen({
  onSuccess,
  onForgot,
  onCreate,
}: {
  onSuccess?: (token: string) => void;
  onForgot?: () => void;
  onCreate?: () => void;
}) {
  const [phone, setPhone] = useState('+233 24 000 0000');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const cleanPhone = phone.trim();
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          identifier: cleanPhone,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');
      const token = json.data?.token || '';
      if (token) {
        (globalThis as any).__MOVR_TOKEN__ = token;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('movr_token', token);
        }
      }
      onSuccess?.(token);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Movr</Text>
      <Text style={styles.sub}>Welcome back</Text>

      <Text style={styles.label}>Phone number</Text>
      <View style={styles.field}>
        <Text style={styles.fieldIcon}>✉</Text>
        <TextInput
          style={styles.input}
          placeholder="+233 24 000 0000"
          placeholderTextColor="#71717A"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.field}>
        <Text style={styles.fieldIcon}>🔒</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#71717A"
          secureTextEntry={!show}
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
        <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
          <Text style={styles.eye}>{show ? '○' : '◉'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onForgot} style={styles.forgotWrap}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>

      <Text style={styles.footer}>
        New to Movr?{' '}
        <Text style={styles.link} onPress={onCreate}>
          Create an account
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: spacing[5],
    paddingTop: 72,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
    fontSize: 15,
  },
  label: { color: '#A1A1AA', fontSize: 13, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2A2A2A',
    paddingHorizontal: 14,
    marginBottom: spacing[4],
  },
  fieldIcon: { marginRight: 10, fontSize: 14, color: '#A1A1AA' },
  input: { flex: 1, color: '#FFFFFF', paddingVertical: 14, fontSize: 15 },
  eye: { fontSize: 14, padding: 4, color: '#A1A1AA' },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: spacing[5] },
  link: { color: '#5B8AFF', fontWeight: '600' },
  error: { color: '#F87171', marginBottom: 12 },
  cta: {
    borderRadius: radius.pill,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0F766E',
  },
  ctaLeft: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F766E',
  },
  ctaRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.72,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  footer: { color: '#A1A1AA', textAlign: 'center', marginTop: spacing[5] },
});
