import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const COUNTRIES = [
  { code: 'GH', label: 'Ghana (Ghana Card)' },
  { code: 'NG', label: 'Nigeria (NIN)' },
  { code: 'CI', label: "Côte d'Ivoire (ONECI)" },
  { code: 'SN', label: 'Senegal (CNI)' },
];

type DocStatus = 'uploaded' | 'required' | 'pending';

/**
 * Driver identity onboarding — country of ID + document checklist + upload.
 * Keeps verify-national-id API; adds mockup document upload UX.
 */
export default function IdentityOnboardingScreen() {
  const [country, setCountry] = useState('GH');
  const [fields, setFields] = useState<any>(null);
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [result, setResult] = useState('');
  const [docs, setDocs] = useState<{ key: string; label: string; status: DocStatus }[]>([
    { key: 'ghana_card', label: 'Ghana Card', status: 'uploaded' },
    { key: 'driving_license', label: 'Driving license', status: 'uploaded' },
    { key: 'vehicle_registration', label: 'Vehicle registration', status: 'required' },
  ]);
  const [activeUpload, setActiveUpload] = useState('vehicle_registration');

  useEffect(() => {
    fetch(`${API}/identity/id-fields/${country}`)
      .then((r) => r.json())
      .then((j) => setFields(j.data))
      .catch(() => undefined);

    if (country === 'GH') {
      setDocs([
        { key: 'ghana_card', label: 'Ghana Card', status: 'uploaded' },
        { key: 'driving_license', label: 'Driving license', status: 'uploaded' },
        { key: 'vehicle_registration', label: 'Vehicle registration', status: 'required' },
      ]);
    } else {
      setDocs([
        { key: 'national_id', label: fields?.label || 'National ID', status: 'required' },
        { key: 'driving_license', label: 'Driving license', status: 'required' },
      ]);
      setActiveUpload('national_id');
    }
  }, [country]);

  const markUploaded = (key: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.key === key ? { ...d, status: 'uploaded' as DocStatus } : d))
    );
    const nextRequired = docs.find((d) => d.key !== key && d.status === 'required');
    if (nextRequired) setActiveUpload(nextRequired.key);
  };

  const submit = async () => {
    const res = await fetch(`${API}/identity/verify-national-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: country, idNumber, fullName }),
    });
    const json = await res.json();
    if (json.data?.pendingManualReview) {
      setResult('Submitted for OCR + manual review (gov API not configured).');
    } else if (json.status === 'error') {
      setResult(json.message || 'Verification failed');
    } else {
      setResult(json.data?.matched ? 'Matched — submitted for verification' : 'Submitted for verification');
    }

    // Also attempt document link endpoint when available
    await fetch(`${API}/identity/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode: country,
        documents: docs.map((d) => ({ type: d.key, status: d.status })),
      }),
    }).catch(() => undefined);
  };

  const activeDoc = docs.find((d) => d.key === activeUpload) || docs.find((d) => d.status === 'required');

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.sub}>
        Country of ID: {COUNTRIES.find((c) => c.code === country)?.label || country}
      </Text>

      <View style={styles.countryRow}>
        {COUNTRIES.map((c) => (
          <Pressable
            key={c.code}
            style={[styles.countryChip, country === c.code && styles.countryOn]}
            onPress={() => setCountry(c.code)}
          >
            <Text style={styles.countryText}>{c.code}</Text>
          </Pressable>
        ))}
      </View>

      {docs.map((d) => {
        const uploaded = d.status === 'uploaded';
        return (
          <Pressable
            key={d.key}
            style={styles.docRow}
            onPress={() => setActiveUpload(d.key)}
          >
            <Text style={{ marginRight: 10 }}>{uploaded ? '📄✓' : '📄'}</Text>
            <Text style={styles.docLabel}>{d.label}</Text>
            <View
              style={[
                styles.badge,
                uploaded ? styles.badgeOk : styles.badgeReq,
              ]}
            >
              <Text style={[styles.badgeText, uploaded ? styles.badgeOkText : styles.badgeReqText]}>
                {uploaded ? 'Uploaded' : 'Required'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {activeDoc && activeDoc.status !== 'uploaded' ? (
        <Pressable
          style={styles.upload}
          onPress={() => markUploaded(activeDoc.key)}
        >
          <Text style={styles.uploadIcon}>⬆</Text>
          <Text style={styles.uploadTitle}>Upload {activeDoc.label.toLowerCase()}</Text>
          <Text style={styles.uploadMeta}>JPG, PNG or PDF · max 10 MB</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>{fields?.label || 'ID number'}</Text>
      <TextInput
        style={styles.input}
        value={idNumber}
        onChangeText={setIdNumber}
        placeholderTextColor={colors.textSecondary}
        placeholder={fields?.regex || 'Enter ID number'}
      />
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name as on ID"
        placeholderTextColor={colors.textSecondary}
      />

      <Pressable style={styles.cta} onPress={submit}>
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Submit for verification</Text>
      </Pressable>
      {!!result && <Text style={styles.result}>{result}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 28, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: 6, marginBottom: spacing[4] },
  countryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  countryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  countryOn: { borderColor: colors.electricViolet, backgroundColor: colors.surface },
  countryText: { color: colors.pureWhite, fontWeight: '600' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  docLabel: { color: colors.pureWhite, fontWeight: '600', flex: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOk: { backgroundColor: 'rgba(63,112,72,0.35)' },
  badgeReq: { backgroundColor: 'rgba(255,184,0,0.2)' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeOkText: { color: colors.success },
  badgeReqText: { color: colors.warning },
  upload: {
    marginTop: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  uploadIcon: { color: colors.pureWhite, fontSize: 22, marginBottom: spacing[2] },
  uploadTitle: { color: colors.pureWhite, fontWeight: '700' },
  uploadMeta: { color: colors.textSecondary, marginTop: 6, fontSize: 12 },
  label: { color: colors.pureWhite, marginBottom: spacing[1] },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.pureWhite,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  cta: {
    marginTop: spacing[4],
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
    overflow: 'hidden',
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', zIndex: 1 },
  result: { color: colors.movrGreen, marginTop: spacing[3] },
});
