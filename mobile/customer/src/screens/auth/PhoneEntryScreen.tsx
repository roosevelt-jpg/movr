import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Linking } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { countryFlagEmoji } from '@movr/design-system/format';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const DIAL_FLAG: Record<string, string> = {
  '+234': countryFlagEmoji('NG'),
  '+233': countryFlagEmoji('GH'),
};

/** Phone entry — country picker + Send Code OTP (mockup). */
export default function PhoneEntryScreen({
  onCodeSent,
  onTerms,
}: {
  onCodeSent?: (payload: { phone: string; countryCode: string; devCode?: string }) => void;
  onTerms?: () => void;
}) {
  const [countryCode, setCountryCode] = useState('+234');
  const [phone, setPhone] = useState('801 234 5678');
  const [autoFill, setAutoFill] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          countryCode,
          autoFillFromSim: autoFill,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not send code');
      onCodeSent?.({
        phone: json.data?.phone || `${countryCode}${digits.replace(/^0/, '')}`,
        countryCode,
        devCode: json.data?.devCode,
      });
    } catch (e: any) {
      setError(e.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.glow} />
      <Text style={styles.brand}>Movr</Text>
      <Text style={styles.tagline}>MOVE · SHOP · DELIVER</Text>

      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.sub}>We'll send you a verification code</Text>

      <View style={styles.phoneRow}>
        <Pressable
          style={styles.country}
          onPress={() => setCountryCode(countryCode === '+234' ? '+233' : '+234')}
        >
          <Text style={styles.flag}>{DIAL_FLAG[countryCode] || countryFlagEmoji('NG')}</Text>
          <Text style={styles.cc}>{countryCode}</Text>
          <Text style={styles.chev}>▾</Text>
        </Pressable>
        <TextInput
          style={[styles.input, focused && styles.inputFocus]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="801 234 5678"
          placeholderTextColor="#52525B"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      <View style={styles.simBar}>
        <Text style={styles.simLabel}>📱  Auto-fill from SIM</Text>
        <Pressable onPress={() => setAutoFill((v) => !v)}>
          <Text style={styles.enable}>{autoFill ? 'Enabled' : 'Enable'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={send} disabled={loading}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{loading ? 'Sending…' : 'Send Code'}</Text>
      </Pressable>

      <Text style={styles.legal}>
        By continuing you agree to our{' '}
        <Text
          style={styles.legalLink}
          onPress={() => {
            if (onTerms) onTerms();
            else Linking.openURL('https://movr.app/terms').catch(() => undefined);
          }}
        >
          Terms & Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: spacing[5],
    paddingTop: 64,
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: 40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(168,85,247,0.22)',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    zIndex: 1,
  },
  tagline: {
    color: '#71717A',
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 48,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
    fontSize: 15,
  },
  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  flag: { fontSize: 16 },
  cc: { color: '#FFFFFF', fontWeight: '600' },
  chev: { color: '#71717A', fontSize: 12 },
  input: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 16,
  },
  inputFocus: { borderColor: '#A855F7' },
  simBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 28,
  },
  simLabel: { color: '#A1A1AA', fontSize: 14 },
  enable: { color: '#A855F7', fontWeight: '700' },
  error: { color: '#F87171', textAlign: 'center', marginBottom: 12 },
  cta: {
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 'auto',
    marginBottom: 16,
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.85,
    left: '40%',
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
  legal: {
    color: '#52525B',
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 24,
    lineHeight: 18,
  },
  legalLink: { color: '#A1A1AA' },
});
