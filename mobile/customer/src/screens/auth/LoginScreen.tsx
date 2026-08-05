import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: phone.includes('@') ? phone : `${phone.replace(/\s/g, '')}@phone.movr`,
          phone,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');
      onSuccess?.(json.data?.token || '');
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
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.field}>
        <Text style={styles.fieldIcon}>🔒</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={!show}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable onPress={() => setShow((s) => !s)}>
          <Text style={styles.eye}>{show ? '🙈' : '👁'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onForgot} style={styles.forgotWrap}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaGlow} />
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
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[5], paddingTop: 72 },
  brand: { color: colors.pureWhite, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 36 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: spacing[4],
  },
  fieldIcon: { marginRight: 10, fontSize: 14 },
  input: { flex: 1, color: colors.pureWhite, paddingVertical: 14, fontSize: 15 },
  eye: { fontSize: 16, padding: 4 },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: spacing[5] },
  link: { color: colors.motionBlue, fontWeight: '600' },
  error: { color: colors.error, marginBottom: 12 },
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
  footer: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing[5] },
});
