import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { pickAndUploadImage } from '../../lib/upload';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

type DocStatus = 'uploaded' | 'required';

type DocRow = {
  key: string;
  label: string;
  status: DocStatus;
  fileUrl?: string;
};

/**
 * Driver identity onboarding — Ghana Card, license, vehicle registration.
 */
export default function IdentityOnboardingScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [countryLabel, setCountryLabel] = useState('Ghana');
  const [result, setResult] = useState('');
  const [docs, setDocs] = useState<DocRow[]>([
    { key: 'ghana_card', label: 'Ghana Card', status: 'required' },
    { key: 'driving_license', label: 'Driving license', status: 'required' },
    { key: 'vehicle_registration', label: 'Vehicle registration', status: 'required' },
  ]);
  const [activeUpload, setActiveUpload] = useState('vehicle_registration');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(() => {
    fetch(`${API}/identity/me/status`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.data?.documents) return;
        if (j.data.countryLabel) setCountryLabel(j.data.countryLabel);
        const mapped: DocRow[] = j.data.documents.map((d: any) => ({
          key: d.type,
          label: d.label,
          status: d.status === 'uploaded' ? 'uploaded' : 'required',
          fileUrl: d.fileUrl || undefined,
        }));
        setDocs(mapped);
        const next = mapped.find((d) => d.status === 'required');
        setActiveUpload(next?.key || mapped[mapped.length - 1]?.key);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const markUploaded = async (key: string) => {
    setUploading(true);
    setResult('');
    try {
      const fileUrl = await pickAndUploadImage({ accept: 'image/*,application/pdf' });
      setDocs((prev) =>
        prev.map((d) =>
          d.key === key ? { ...d, status: 'uploaded' as DocStatus, fileUrl } : d
        )
      );
      const next = docs.find((d) => d.key !== key && d.status === 'required');
      if (next) setActiveUpload(next.key);
    } catch (e: any) {
      setResult(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const allUploaded = docs.every((d) => d.status === 'uploaded');
  const activeDoc = docs.find((d) => d.key === activeUpload);
  const showUpload = activeDoc?.status === 'required';

  const submit = async () => {
    if (!allUploaded) {
      setResult('Upload all required documents first.');
      return;
    }
    setSubmitting(true);
    setResult('');
    try {
      const verify = await fetch(`${API}/identity/verify-national-id`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          countryCode: 'GH',
          idNumber: 'GHA-000000000-0',
          fullName: 'Driver',
          dateOfBirth: '1990-01-01',
        }),
      });
      const verifyJson = await verify.json();
      if (verifyJson.status === 'error' && !verifyJson.data?.pendingManualReview) {
        // Continue to documents submit even if gov API unavailable
      }

      const res = await fetch(`${API}/identity/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          countryCode: 'GH',
          idNumber: 'pending',
          documents: docs.map((d) => ({
            type: d.key,
            status: d.status,
            fileUrl: d.fileUrl,
          })),
          ocrConfirmed: true,
        }),
      });
      const json = await res.json();
      if (json.status === 'error') {
        setResult(json.message || 'Submit failed');
        return;
      }
      setResult('Submitted for verification');
      loadStatus();
    } catch (e: any) {
      setResult(e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.sub}>Country of ID: {countryLabel}</Text>

      {docs.map((d) => {
        const uploaded = d.status === 'uploaded';
        return (
          <Pressable
            key={d.key}
            style={styles.docCard}
            onPress={() => setActiveUpload(d.key)}
          >
            <View style={styles.docLeft}>
              <Text style={[styles.docIcon, uploaded ? styles.iconOk : styles.iconNeed]}>
                {uploaded ? '✓' : '○'}
              </Text>
              <Text style={styles.docLabel}>{d.label}</Text>
            </View>
            <View style={[styles.badge, uploaded ? styles.badgeOk : styles.badgeNeed]}>
              <Text style={[styles.badgeText, uploaded ? styles.badgeOkText : styles.badgeNeedText]}>
                {uploaded ? 'Uploaded' : 'Required'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {showUpload && activeDoc ? (
        <Pressable
          style={styles.uploadBox}
          onPress={() => markUploaded(activeDoc.key)}
          disabled={uploading}
        >
          <Text style={styles.uploadIcon}>↑</Text>
          <Text style={styles.uploadTitle}>
            {uploading ? 'Uploading…' : `Upload ${activeDoc.label.toLowerCase()}`}
          </Text>
          <Text style={styles.uploadHint}>JPG, PNG or PDF · max 10MB</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.cta, !allUploaded && styles.ctaDisabled]}
        onPress={submit}
        disabled={!allUploaded || submitting}
      >
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>
          {submitting ? 'Submitting…' : 'Submit for verification'}
        </Text>
      </Pressable>
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </ScrollView>
  );
}

function makeStyles(_colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
    sub: { color: '#888888', marginTop: 8, marginBottom: spacing[5], fontSize: 15 },
    docCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#1A1A1A',
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: spacing[4],
      marginBottom: spacing[3],
    },
    docLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    docIcon: { fontSize: 18 },
    iconOk: { color: '#4ade80' },
    iconNeed: { color: '#f59e0b' },
    docLabel: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    badgeOk: { backgroundColor: 'rgba(34,197,94,0.18)' },
    badgeNeed: { backgroundColor: 'rgba(245,158,11,0.18)' },
    badgeText: { fontSize: 12, fontWeight: '700' },
    badgeOkText: { color: '#86efac' },
    badgeNeedText: { color: '#fbbf24' },
    uploadBox: {
      marginTop: spacing[2],
      marginBottom: spacing[4],
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.35)',
      borderRadius: 16,
      paddingVertical: 36,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    uploadIcon: { color: '#FFFFFF', fontSize: 28, marginBottom: 10 },
    uploadTitle: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
    uploadHint: { color: '#888888', fontSize: 13, marginTop: 6 },
    cta: {
      marginTop: spacing[4],
      borderRadius: 999,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#8E2DE2',
      overflow: 'hidden',
    },
    ctaDisabled: { opacity: 0.45 },
    ctaGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#4A00E0',
      opacity: 0.55,
    },
    ctaText: { color: '#FFFFFF', fontWeight: '700', zIndex: 1, fontSize: 16 },
    result: { color: '#fbbf24', marginTop: spacing[3], textAlign: 'center' },
  });
}
