import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const COUNTRIES = [
  { code: 'GH', label: 'Ghana' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'CI', label: "Côte d'Ivoire" },
  { code: 'SN', label: 'Senegal' },
];

/** Merchant identity onboarding — Country of ID + national ID + business docs (Phase 26). */
export default function MerchantIdentityOnboardingScreen() {
  const [country, setCountry] = useState('GH');
  const [fields, setFields] = useState<any>(null);
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [bizReg, setBizReg] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch(`${API}/identity/id-fields/${country}`)
      .then((r) => r.json())
      .then((j) => setFields(j.data))
      .catch(() => undefined);
  }, [country]);

  const submit = async () => {
    const res = await fetch(`${API}/merchant/kyc`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: country,
        documentType: 'national_id',
        documentNumber: idNumber,
        fullName,
        businessRegistrationNumber: bizReg,
        ocrConfirmed: true,
      }),
    });
    const json = await res.json();
    if (json.status === 'error') setResult(json.message);
    else {
      setResult(
        json.data?.pendingAutomatedVerification
          ? 'Submitted — pending automated verification'
          : 'KYC submitted'
      );
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Merchant identity</Text>
      <Text style={styles.sub}>Select country of ID, then enter national ID + business registration.</Text>
      <View style={styles.row}>
        {COUNTRIES.map((c) => (
          <Pressable
            key={c.code}
            style={[styles.chip, country === c.code && styles.chipOn]}
            onPress={() => setCountry(c.code)}
          >
            <Text style={styles.chipText}>{c.code}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{fields?.label || 'National ID'}</Text>
      <TextInput
        style={styles.input}
        value={idNumber}
        onChangeText={setIdNumber}
        placeholder={fields?.example || 'ID number'}
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full legal name"
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        value={bizReg}
        onChangeText={setBizReg}
        placeholder="Business registration number"
        placeholderTextColor={colors.textSecondary}
      />
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Submit KYC</Text>
      </Pressable>
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginVertical: spacing[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.movrGreen, borderColor: colors.movrGreen },
  chipText: { color: colors.pureWhite, fontWeight: '600' },
  label: { color: colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.pureWhite,
    marginBottom: spacing[2],
  },
  btn: {
    marginTop: spacing[4],
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
  },
  btnText: { color: colors.pureWhite, fontWeight: '700' },
  result: { color: colors.warning, marginTop: spacing[3] },
});
