import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Linking } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Create account — name, phone, password (mockup). */
export default function SignupScreen({
  onSuccess,
  onSignIn,
}: {
  onSuccess?: (phone: string, token?: string) => void;
  onSignIn?: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!fullName.trim()) {
      setError('Enter your full name');
      return;
    }
    if (!phone.trim()) {
      setError('Enter your phone number');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    const parts = fullName.trim().split(/\s+/);
    const cleanPhone = phone.trim();
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: parts[0] || fullName,
          lastName: parts.slice(1).join(' ') || '',
          name: fullName.trim(),
          phone: cleanPhone,
          password,
          email: `${cleanPhone.replace(/\D/g, '')}@phone.movr`,
          userType: 'customer',
          country: 'GH',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Signup failed');
      const token = json.data?.token;
      if (token) {
        (globalThis as any).__MOVR_TOKEN__ = token;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('movr_token', token);
        }
      }
      onSuccess?.(cleanPhone, token);
    } catch (e: any) {
      setError(e.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.sub}>Ride, shop, and deliver in one app</Text>

      {(
        [
          ['Full name', fullName, setFullName, 'Ama Konadu', 'default' as const],
          ['Phone number', phone, setPhone, '+233 24 000 0000', 'phone-pad' as const],
          ['Password', password, setPassword, 'Create a password', 'default' as const],
        ] as const
      ).map(([label, value, setter, placeholder, kb]) => (
        <View key={label}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#71717A"
            value={value}
            onChangeText={setter}
            secureTextEntry={label === 'Password'}
            keyboardType={kb}
          />
        </View>
      ))}

      <Text style={styles.legal}>
        By continuing, you agree to Movr's{' '}
        <Text style={styles.legalLink} onPress={() => Linking.openURL('https://movr.io/terms')}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.legalLink} onPress={() => Linking.openURL('https://movr.io/privacy')}>
          Privacy Policy
        </Text>
        .
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaLeft} />
        <View style={styles.ctaRight} />
        <Text style={styles.ctaText}>{loading ? 'Creating…' : 'Create account'}</Text>
      </Pressable>

      <Text style={styles.footer}>
        Already have an account?{' '}
        <Text style={styles.link} onPress={onSignIn}>
          Sign in
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
    paddingTop: 64,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  sub: { color: '#A1A1AA', marginTop: 8, marginBottom: 28, fontSize: 15 },
  label: { color: '#A1A1AA', fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[4],
    fontSize: 15,
  },
  legal: { color: '#71717A', fontSize: 12, lineHeight: 18, marginBottom: spacing[5] },
  legalLink: { color: '#71717A', textDecorationLine: 'underline' },
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
    backgroundColor: '#6345ED',
    opacity: 0.75,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  footer: { color: '#A1A1AA', textAlign: 'center', marginTop: spacing[5] },
});
