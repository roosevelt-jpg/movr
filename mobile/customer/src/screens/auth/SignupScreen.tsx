import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Linking } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Create account — name, phone, password (mockup). */
export default function SignupScreen({
  onSuccess,
  onSignIn,
}: {
  onSuccess?: (phone: string) => void;
  onSignIn?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    const parts = fullName.trim().split(/\s+/);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: parts[0] || fullName,
          lastName: parts.slice(1).join(' ') || '',
          name: fullName,
          phone,
          password,
          email: `${phone.replace(/\D/g, '')}@phone.movr`,
          userType: 'customer',
          country: 'GH',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Signup failed');
      onSuccess?.(phone);
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
          ['Full name', fullName, setFullName, 'Ama Konadu', 'default'],
          ['Phone number', phone, setPhone, '+233 24 000 0000', 'phone-pad'],
          ['Password', password, setPassword, 'Create a password', 'default'],
        ] as const
      ).map(([label, value, setter, placeholder, kb]) => (
        <View key={label}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={value}
            onChangeText={setter}
            secureTextEntry={label === 'Password'}
            keyboardType={kb as any}
          />
        </View>
      ))}

      <Text style={styles.legal}>
        By continuing, you agree to Movr's{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://movr.io/terms')}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://movr.io/privacy')}>
          Privacy Policy
        </Text>
        .
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaGlow} />
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

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[5], paddingTop: 64 },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: 8, marginBottom: 28 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.pureWhite,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing[4],
    fontSize: 15,
  },
  legal: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: spacing[5] },
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
}
