import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const COUNTRIES = [
  { code: 'GH', label: 'Ghana (Ghana Card)' },
  { code: 'NG', label: 'Nigeria (NIN)' },
  { code: 'CI', label: "Côte d'Ivoire (ONECI)" },
  { code: 'SN', label: 'Senegal (CNI)' },
];

/**
 * Phase 26 — country-of-ID first, then document fields for that market.
 */
export default function IdentityOnboardingScreen() {
  const [country, setCountry] = useState('GH');
  const [fields, setFields] = useState<any>(null);
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch(`${API}/identity/id-fields/${country}`)
      .then((r) => r.json())
      .then((j) => setFields(j.data))
      .catch(() => undefined);
  }, [country]);

  const submit = async () => {
    const res = await fetch(`${API}/identity/verify-national-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: country, idNumber, fullName }),
    });
    const json = await res.json();
    if (json.data?.pendingManualReview) {
      setResult('Submitted for OCR + manual review (gov API not configured).');
    } else {
      setResult(json.data?.matched ? 'Matched' : json.message || 'Check failed');
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Country of ID</Text>
      <Text style={styles.sub}>Choose where your national ID was issued.</Text>
      {COUNTRIES.map((c) => (
        <Pressable
          key={c.code}
          style={[styles.chip, country === c.code && styles.chipOn]}
          onPress={() => setCountry(c.code)}
        >
          <Text style={styles.chipText}>{c.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.label}>{fields?.label || 'ID number'}</Text>
      <TextInput
        style={styles.input}
        value={idNumber}
        onChangeText={setIdNumber}
        placeholderTextColor="#666"
        placeholder={fields?.regex || ''}
      />
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name as on ID"
        placeholderTextColor="#666"
      />
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Continue</Text>
      </Pressable>
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: '#A0A0A0', marginBottom: spacing[3] },
  chip: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  chipOn: { borderColor: colors.electricViolet, backgroundColor: '#120024' },
  chipText: { color: colors.pureWhite },
  label: { color: colors.pureWhite, marginTop: spacing[3], marginBottom: spacing[1] },
  input: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.pureWhite,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  btn: {
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: colors.pureWhite, fontWeight: '600' },
  result: { color: colors.movrGreen, marginTop: spacing[3] },
});
