import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Doc = { key: string; label: string; status: 'verified' | 'in_review' | 'rejected'; reason?: string };

/** KYC verification status — Verified / In review / Rejected + re-upload. */
export default function VerificationStatusScreen({
  onReupload,
}: {
  onReupload?: (docKey: string) => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([
    { key: 'ghana_card', label: 'Ghana Card', status: 'verified' },
    { key: 'driving_license', label: 'Driving license', status: 'in_review' },
    {
      key: 'vehicle_registration',
      label: 'Vehicle registration',
      status: 'rejected',
      reason: 'Vehicle registration photo was blurry. Please re-upload a clear photo.',
    },
  ]);

  useEffect(() => {
    fetch(`${API}/identity/my-documents`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data) && j.data.length) {
          setDocs(
            j.data.map((d: any) => ({
              key: d.key || d.document_type,
              label: d.label || d.document_type,
              status: (d.status === 'verified'
                ? 'verified'
                : d.status === 'rejected'
                  ? 'rejected'
                  : 'in_review') as Doc['status'],
              reason: d.rejection_reason || d.reason,
            }))
          );
        }
      })
      .catch(() => undefined);
  }, []);

  const rejected = docs.find((d) => d.status === 'rejected');

  const badge = (s: Doc['status']) => {
    if (s === 'verified') return { bg: 'rgba(63,112,72,0.35)', color: colors.success, label: 'Verified' };
    if (s === 'rejected') return { bg: 'rgba(255,59,92,0.2)', color: colors.error, label: 'Rejected' };
    return { bg: 'rgba(255,184,0,0.2)', color: colors.warning, label: 'In review' };
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.clock}>
          <Text style={{ fontSize: 28 }}>⏱</Text>
        </View>
        <Text style={styles.title}>Verification in progress</Text>
        <Text style={styles.sub}>
          We're reviewing your documents. This usually takes less than 24 hours.
        </Text>
      </View>

      {docs.map((d) => {
        const b = badge(d.status);
        return (
          <View key={d.key} style={styles.row}>
            <Text style={styles.docLabel}>{d.label}</Text>
            <View style={[styles.pill, { backgroundColor: b.bg }]}>
              <Text style={[styles.pillText, { color: b.color }]}>{b.label}</Text>
            </View>
          </View>
        );
      })}

      {rejected?.reason ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{rejected.reason}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.cta}
        onPress={() => onReupload?.(rejected?.key || 'vehicle_registration')}
      >
        <View style={styles.ctaGlow} />
        <Text style={styles.ctaText}>Re-upload document</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  header: { alignItems: 'center', marginTop: spacing[6], marginBottom: spacing[5] },
  clock: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,184,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  docLabel: { color: colors.pureWhite, fontWeight: '600', fontSize: 15 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  errorBox: {
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(255,59,92,0.08)',
    borderRadius: radius.md,
    padding: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[5],
  },
  errorText: { color: colors.error, lineHeight: 20 },
  cta: {
    marginTop: 'auto' as any,
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
});
