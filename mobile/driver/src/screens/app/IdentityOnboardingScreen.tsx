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

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const COUNTRIES = [
  { code: 'GH', label: 'Ghana (Ghana Card)' },
  { code: 'NG', label: 'Nigeria (NIN)' },
  { code: 'CI', label: "Côte d'Ivoire (ONECI)" },
  { code: 'SN', label: 'Senegal (CNI)' },
];

type DocStatus = 'uploaded' | 'required' | 'pending' | 'confirmed';

/**
 * Driver identity onboarding — Country of ID → capture → OCR confirm → submit (Phase 26).
 */
export default function IdentityOnboardingScreen() {
  const [country, setCountry] = useState('GH');
  const [fields, setFields] = useState<any>(null);
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [result, setResult] = useState('');
  const [step, setStep] = useState<'docs' | 'ocr' | 'done'>('docs');
  const [docs, setDocs] = useState<{ key: string; label: string; status: DocStatus }[]>([
    { key: 'ghana_card', label: 'Ghana Card', status: 'required' },
    { key: 'driving_license', label: 'Driving license', status: 'required' },
    { key: 'vehicle_registration', label: 'Vehicle registration', status: 'required' },
  ]);
  const [activeUpload, setActiveUpload] = useState('ghana_card');
  const [recordingConsent, setRecordingConsent] = useState(false);

  useEffect(() => {
    fetch(`${API}/identity/id-fields/${country}`)
      .then((r) => r.json())
      .then((j) => setFields(j.data))
      .catch(() => undefined);

    if (country === 'GH') {
      setDocs([
        { key: 'ghana_card', label: 'Ghana Card', status: 'required' },
        { key: 'driving_license', label: 'Driving license', status: 'required' },
        { key: 'vehicle_registration', label: 'Vehicle registration', status: 'required' },
      ]);
      setActiveUpload('ghana_card');
    } else {
      setDocs([
        { key: 'national_id', label: fields?.label || 'National ID', status: 'required' },
        { key: 'driving_license', label: 'Driving license', status: 'required' },
      ]);
      setActiveUpload('national_id');
    }
  }, [country]);

  const markUploaded = async (key: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.key === key ? { ...d, status: 'uploaded' as DocStatus } : d))
    );
    // OCR preview for confirm/correct
    const res = await fetch(`${API}/identity/ocr-preview`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: country,
        documentType: key,
        idNumber,
        fullName,
        dateOfBirth,
        licenseNumber,
        vehicleRegistration: vehicleReg,
      }),
    }).catch(() => null);
    const json = res ? await res.json() : null;
    if (json?.data?.extracted) {
      const e = json.data.extracted;
      if (e.idNumber) setIdNumber(e.idNumber);
      if (e.fullName) setFullName(e.fullName);
      if (e.dateOfBirth) setDateOfBirth(e.dateOfBirth);
      if (e.licenseNumber) setLicenseNumber(e.licenseNumber);
      if (e.vehicleRegistration) setVehicleReg(e.vehicleRegistration);
    }
    setStep('ocr');
  };

  const confirmOcr = () => {
    setDocs((prev) =>
      prev.map((d) =>
        d.key === activeUpload ? { ...d, status: 'confirmed' as DocStatus } : d
      )
    );
    const next = docs.find((d) => d.key !== activeUpload && d.status === 'required');
    if (next) {
      setActiveUpload(next.key);
      setStep('docs');
    } else {
      setStep('docs');
    }
  };

  const submit = async () => {
    if (!recordingConsent) {
      setResult('You must accept in-trip safety recording to continue onboarding.');
      return;
    }
    const res = await fetch(`${API}/identity/verify-national-id`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: country,
        idNumber,
        fullName,
        dateOfBirth,
      }),
    });
    const json = await res.json();
    if (json.status === 'error') {
      setResult(json.message || 'Verification failed');
      return;
    }
    if (json.data?.pendingManualReview) {
      setResult('Submitted — pending automated verification (gov API not configured).');
    } else {
      setResult(json.data?.matched ? 'Matched — identity checks queued' : 'Submitted for verification');
    }

    await fetch(`${API}/identity/documents`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: country,
        idNumber,
        licenseNumber,
        vehicleRegistration: vehicleReg,
        documents: docs.map((d) => ({ type: d.key, status: d.status, number: idNumber })),
        ocrConfirmed: true,
      }),
    }).catch(() => undefined);

    await fetch(`${API}/drivers/recording-consent`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ consented: true }),
    }).catch(() => undefined);

    setStep('done');
  };

  const activeDoc = docs.find((d) => d.key === activeUpload);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.sub}>Country of ID first, then capture each document and confirm OCR fields.</Text>

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

      {docs.map((d) => (
        <Pressable key={d.key} style={styles.docRow} onPress={() => setActiveUpload(d.key)}>
          <Text style={styles.docLabel}>{d.label}</Text>
          <Text style={styles.badgeText}>{d.status}</Text>
        </Pressable>
      ))}

      {step === 'docs' && activeDoc && activeDoc.status === 'required' ? (
        <Pressable style={styles.upload} onPress={() => markUploaded(activeDoc.key)}>
          <Text style={styles.uploadText}>Capture / upload {activeDoc.label}</Text>
        </Pressable>
      ) : null}

      {step === 'ocr' ? (
        <View style={styles.ocrCard}>
          <Text style={styles.ocrTitle}>Confirm OCR fields</Text>
          <Text style={styles.hint}>{fields?.label || 'ID number'}</Text>
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
            placeholder="Full name"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="Date of birth"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholder="Driving license number"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={vehicleReg}
            onChangeText={setVehicleReg}
            placeholder="Vehicle registration (or fleet auth letter ref)"
            placeholderTextColor={colors.textSecondary}
          />
          <Pressable style={styles.upload} onPress={confirmOcr}>
            <Text style={styles.uploadText}>Confirm fields</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={styles.consentRow}
        onPress={() => setRecordingConsent((v) => !v)}
      >
        <View style={[styles.checkbox, recordingConsent && styles.checkboxOn]} />
        <Text style={styles.consentText}>
          I consent to in-cabin trip recording for safety and dispute resolution. Footage is stored
          locally then uploaded securely — not live-streamed — and reviewed only if there is a
          dispute or safety report.
        </Text>
      </Pressable>

      <Pressable style={styles.submit} onPress={submit}>
        <Text style={styles.uploadText}>Submit for verification</Text>
      </Pressable>
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textSecondary, marginTop: spacing[2], marginBottom: spacing[4] },
  countryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  countryChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryOn: { backgroundColor: colors.electricViolet, borderColor: colors.electricViolet },
  countryText: { color: colors.pureWhite, fontWeight: '600' },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  docLabel: { color: colors.pureWhite, fontWeight: '600' },
  badgeText: { color: colors.textSecondary, textTransform: 'capitalize' },
  upload: {
    marginTop: spacing[4],
    backgroundColor: colors.motionBlue,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
  },
  submit: {
    marginTop: spacing[5],
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
  },
  consentRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[5],
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: colors.movrGreen,
    borderColor: colors.movrGreen,
  },
  consentText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  uploadText: { color: colors.pureWhite, fontWeight: '700' },
  ocrCard: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  ocrTitle: { color: colors.pureWhite, fontWeight: '700', marginBottom: spacing[2] },
  hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    color: colors.pureWhite,
    marginBottom: spacing[2],
  },
  result: { color: colors.warning, marginTop: spacing[3] },
});
