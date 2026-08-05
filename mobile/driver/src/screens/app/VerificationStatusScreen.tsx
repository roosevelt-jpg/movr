import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';
import { VerifiedBadge } from '@movr/design-system/components/VerifiedBadge';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Doc = { key: string; label: string; status: 'verified' | 'in_review' | 'rejected'; reason?: string };

/** KYC verification status — Verified / In review / Rejected + on-chain badge. */
export default function VerificationStatusScreen({
  onReupload,
  userId,
}: {
  onReupload?: (docKey: string) => void;
  userId?: string;
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
  const [attestation, setAttestation] = useState<{ status?: string; explorerUrl?: string | null }>(
    {}
  );

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

    if (userId) {
      fetch(`${API}/kyc/attestation/${userId}`)
        .then((r) => r.json())
        .then((j) => {
          const row = j?.data;
          if (!row) return;
          const chain = String(row.chain || 'polygon-amoy');
          const explorer = row.tx_hash
            ? chain.includes('amoy')
              ? `https://amoy.polygonscan.com/tx/${row.tx_hash}`
              : `https://polygonscan.com/tx/${row.tx_hash}`
            : null;
          setAttestation({ status: row.status, explorerUrl: explorer });
        })
        .catch(() => undefined);
    }
  }, [userId]);

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
        <View style={{ marginTop: spacing[3] }}>
          <VerifiedBadge status={attestation.status} explorerUrl={attestation.explorerUrl} />
        </View>
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

      {rejected?.reason ? <Text style={styles.reason}>{rejected.reason}</Text> : null}

      {rejected ? (
        <Pressable style={styles.cta} onPress={() => onReupload?.(rejected.key)}>
          <View style={styles.ctaGlow} />
          <Text style={styles.ctaText}>Re-upload document</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  header: { alignItems: 'center', marginBottom: spacing[6], marginTop: spacing[4] },
  clock: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: { color: colors.pureWhite, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sub: { color: colors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  docLabel: { color: colors.pureWhite, fontWeight: '600', fontSize: 15, flex: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  reason: { color: colors.error, marginBottom: spacing[4], lineHeight: 20 },
  cta: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.electricViolet,
  },
  ctaGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.motionBlue,
    opacity: 0.45,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, zIndex: 1 },
});
