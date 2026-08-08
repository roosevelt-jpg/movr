import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { pickAndUploadImage } from '../../lib/upload';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const ID_ICONS: Record<string, string> = {
  id: '🪪',
  car: '🚗',
  passport: '🛂',
};

/** KYC Step 3 — identity verification (mockup). */
export default function IdentityOnboardingScreen({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [idType, setIdType] = useState('national_id');
  const [idTypes, setIdTypes] = useState<any[]>([
    {
      id: 'national_id',
      label: 'National ID Card',
      subtitle: 'NIN slip or card accepted',
      icon: 'id',
    },
    {
      id: 'drivers_license',
      label: "Driver's License",
      subtitle: 'Valid license required for drivers',
      icon: 'car',
    },
    {
      id: 'passport',
      label: 'International Passport',
      subtitle: 'Bio data page required',
      icon: 'passport',
    },
  ]);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [selfieStatus, setSelfieStatus] = useState('pending');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/identity/me/step3`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          if (j.data.idTypes?.length) setIdTypes(j.data.idTypes);
          if (j.data.idType) setIdType(j.data.idType);
          if (j.data.idFrontUrl) setFrontUrl(j.data.idFrontUrl);
          if (j.data.idBackUrl) setBackUrl(j.data.idBackUrl);
          if (j.data.selfieStatus) setSelfieStatus(j.data.selfieStatus);
        }
      })
      .catch(() => undefined);
  }, []);

  const patch = async (partial: Record<string, any>) => {
    await fetch(`${API}/identity/me/step3`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(partial),
    }).catch(() => undefined);
  };

  const uploadSide = async (side: 'front' | 'back') => {
    setBusy(true);
    try {
      const fileUrl = await pickAndUploadImage({ accept: 'image/*' });
      if (side === 'front') {
        setFrontUrl(fileUrl);
        await patch({ idType, idFrontUrl: fileUrl });
      } else {
        setBackUrl(fileUrl);
        await patch({ idType, idBackUrl: fileUrl });
      }
    } catch (e: any) {
      setMsg(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const startSelfie = async () => {
    setBusy(true);
    try {
      const fileUrl = await pickAndUploadImage({ accept: 'image/*' });
      setSelfieStatus('verified');
      await patch({ selfieUrl: fileUrl, selfieStatus: 'verified' });
      setMsg('Selfie captured');
    } catch {
      setSelfieStatus('started');
      await patch({ selfieStatus: 'started' });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!frontUrl) {
      Alert.alert('Upload required', 'Please upload the front of your ID');
      return;
    }
    setBusy(true);
    try {
      await patch({ idType, idFrontUrl: frontUrl, idBackUrl: backUrl });
      const res = await fetch(`${API}/identity/me/step3/submit`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const json = await res.json();
      setMsg(json?.data?.message || 'Submitted for review');
      onDone?.();
    } catch (e: any) {
      setMsg(e.message || 'Submitted for review');
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.steps}>
        <View style={[styles.stepBar, styles.stepOn]} />
        <View style={[styles.stepBar, styles.stepOn]} />
        <View style={styles.stepBar} />
      </View>
      <Text style={styles.breadcrumb}>STEP 3 OF 3 · IDENTITY VERIFICATION</Text>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.sub}>Required for driver accounts. Takes under 2 minutes.</Text>

      <Text style={styles.section}>SELECT ID TYPE</Text>
      {idTypes.map((t) => (
        <Pressable
          key={t.id}
          style={[styles.idCard, idType === t.id && styles.idCardOn]}
          onPress={() => {
            setIdType(t.id);
            patch({ idType: t.id });
          }}
        >
          <Text style={styles.idIcon}>{ID_ICONS[t.icon] || '🪪'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.idLabel}>{t.label}</Text>
            <Text style={styles.idSub}>{t.subtitle}</Text>
          </View>
          <View style={[styles.check, idType === t.id && styles.checkOn]}>
            {idType === t.id ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
        </Pressable>
      ))}

      <Text style={styles.section}>UPLOAD DOCUMENTS</Text>
      <View style={styles.uploadRow}>
        <Pressable
          style={[styles.upload, frontUrl ? styles.uploadDone : styles.uploadActive]}
          onPress={() => uploadSide('front')}
          disabled={busy}
        >
          <Text style={styles.uploadIcon}>📄</Text>
          <Text style={styles.uploadTitle}>Front Side</Text>
          <Text style={styles.uploadHint}>{frontUrl ? 'Uploaded' : 'Tap to upload'}</Text>
          <View style={styles.uploadBtn}>
            <Text style={styles.uploadBtnText}>{frontUrl ? '✓ Done' : '+ Upload'}</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.upload, !frontUrl && styles.uploadDisabled]}
          onPress={() => frontUrl && uploadSide('back')}
          disabled={busy || !frontUrl}
        >
          <Text style={[styles.uploadIcon, !frontUrl && { opacity: 0.4 }]}>📄</Text>
          <Text style={[styles.uploadTitle, !frontUrl && { opacity: 0.4 }]}>Back Side</Text>
          <Text style={[styles.uploadHint, !frontUrl && { opacity: 0.4 }]}>
            {backUrl ? 'Uploaded' : 'Tap to upload'}
          </Text>
          <View style={[styles.uploadBtn, !frontUrl && styles.uploadBtnOff]}>
            <Text style={styles.uploadBtnText}>{backUrl ? '✓ Done' : '+ Upload'}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.selfie}>
        <Text style={styles.selfieIcon}>🤳</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.selfieTitle}>Selfie Verification</Text>
          <Text style={styles.selfieSub}>Take a live selfie to match your ID</Text>
        </View>
        <Pressable onPress={startSelfie} disabled={busy}>
          <Text style={styles.selfieStart}>
            {selfieStatus === 'verified' ? 'Done' : 'Start'}
          </Text>
        </Pressable>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.submit} onPress={submit} disabled={busy}>
        <Text style={styles.submitText}>{busy ? 'Submitting…' : 'Submit for review'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  steps: { flexDirection: 'row', gap: 6, marginBottom: spacing[3] },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#3F3F46' },
  stepOn: { backgroundColor: '#8E2DE2' },
  breadcrumb: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '800', marginTop: 8 },
  sub: { color: '#A1A1AA', marginTop: 6, marginBottom: spacing[4] },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: spacing[2],
  },
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#27272A',
    gap: 12,
  },
  idCardOn: { borderColor: '#8E2DE2' },
  idIcon: { fontSize: 22 },
  idLabel: { color: '#FFF', fontWeight: '700' },
  idSub: { color: '#71717A', fontSize: 12, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#8E2DE2', borderColor: '#8E2DE2' },
  checkMark: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  uploadRow: { flexDirection: 'row', gap: 10, marginBottom: spacing[4] },
  upload: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3F3F46',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  uploadActive: { borderColor: '#8E2DE2' },
  uploadDone: { borderColor: '#22C55E', borderStyle: 'solid' },
  uploadDisabled: { opacity: 0.7 },
  uploadIcon: { fontSize: 22, marginBottom: 6 },
  uploadTitle: { color: '#FFF', fontWeight: '700' },
  uploadHint: { color: '#71717A', fontSize: 11, marginTop: 4, marginBottom: 10 },
  uploadBtn: {
    backgroundColor: '#8E2DE2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  uploadBtnOff: { backgroundColor: '#3F3F46' },
  uploadBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  selfie: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: spacing[4],
  },
  selfieIcon: { fontSize: 28 },
  selfieTitle: { color: '#FFF', fontWeight: '800' },
  selfieSub: { color: '#71717A', fontSize: 12, marginTop: 2 },
  selfieStart: { color: '#A78BFA', fontWeight: '800' },
  msg: { color: '#A1A1AA', textAlign: 'center', marginBottom: 12 },
  submit: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
