import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import IdentityOnboardingScreen from './IdentityOnboardingScreen';
import { authHeaders } from '../../lib/token';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type Doc = {
  key: string;
  label: string;
  status: 'verified' | 'in_review' | 'rejected';
  reason?: string;
};

/** KYC verification status — Polygon KYCRegistry + local documents. */
export default function VerificationStatusScreen({
  onReupload,
}: {
  onReupload?: (docKey: string) => void;
  userId?: string;
}) {
  const [showIdentity, setShowIdentity] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([
    { key: 'ghana_card', label: 'Ghana Card', status: 'in_review' },
    { key: 'driving_license', label: 'Driving license', status: 'in_review' },
    { key: 'vehicle_registration', label: 'Vehicle registration', status: 'in_review' },
  ]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [chain, setChain] = useState<any>(null);

  const load = () => {
    const headers = authHeaders();
    fetch(`${API}/identity/my-documents`, { headers })
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
    fetch(`${API}/kyc/me`, { headers })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setChain(j.data);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  const rejected = docs.find((d) => d.status === 'rejected');
  const onchain = chain?.onchain;
  const onchainVerified =
    Boolean(onchain && !onchain.empty) && String(onchain.statusLabel) === 'Verified';
  const explorerUrl = chain?.explorerUrl as string | undefined;

  const reupload = async () => {
    if (!rejected) return;
    onReupload?.(rejected.key);
    setShowIdentity(true);
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/identity/my-documents/${rejected.key}/reupload`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setMsg('Document re-submitted for review');
        load();
      }
    } catch {
      /* identity UI still available */
    } finally {
      setBusy(false);
    }
  };

  if (showIdentity) {
    return (
      <IdentityOnboardingScreen
        onDone={() => {
          setShowIdentity(false);
          setMsg('Identity verification submitted for review');
          load();
        }}
      />
    );
  }

  const badge = (s: Doc['status']) => {
    if (s === 'verified') {
      return { bg: 'rgba(34,197,94,0.2)', color: '#4ADE80', label: 'Verified' };
    }
    if (s === 'rejected') {
      return { bg: 'rgba(239,68,68,0.2)', color: '#F87171', label: 'Rejected' };
    }
    return { bg: 'rgba(234,179,8,0.2)', color: '#FBBF24', label: 'In review' };
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.clock}>
          <Text style={{ fontSize: 28, color: onchainVerified ? '#4ADE80' : '#FBBF24' }}>
            {onchainVerified ? '✓' : '⏱'}
          </Text>
        </View>
        <Text style={styles.title}>
          {onchainVerified ? 'Verified on-chain' : 'Verification in progress'}
        </Text>
        <Text style={styles.sub}>
          {onchainVerified
            ? 'Your KYC status is confirmed on Movr Polygon KYCRegistry.'
            : "We're reviewing your documents, then attesting them on Polygon. This usually takes less than 24 hours."}
        </Text>
      </View>

      {chain ? (
        <Pressable
          style={styles.chainRow}
          onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
          disabled={!explorerUrl}
        >
          <Text style={styles.chainLabel}>
            {chain.live ? 'Polygon live' : 'Chain offline'}
            {onchain && !onchain.empty ? ` · ${onchain.statusLabel}` : ' · not attested yet'}
            {chain.matches === false ? ' · mismatch' : ''}
          </Text>
          {explorerUrl ? <Text style={styles.chainLink}>Explorer</Text> : null}
        </Pressable>
      ) : null}

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
        <View style={styles.reasonBox}>
          <Text style={styles.reason}>{rejected.reason}</Text>
        </View>
      ) : null}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable
        style={[styles.cta, { marginBottom: spacing[3], backgroundColor: '#1A1A1A' }]}
        onPress={() => setShowIdentity(true)}
      >
        <Text style={styles.ctaText}>Continue identity verification</Text>
      </Pressable>

      {rejected ? (
        <Pressable style={styles.cta} onPress={reupload} disabled={busy}>
          <View style={styles.ctaLeft} />
          <View style={styles.ctaRight} />
          <Text style={styles.ctaText}>{busy ? 'Uploading…' : 'Re-upload document'}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: spacing[4] },
  header: { alignItems: 'center', marginBottom: spacing[6], marginTop: spacing[4] },
  clock: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sub: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  chainLabel: { color: '#A1A1AA', fontSize: 13, flex: 1, paddingRight: 8 },
  chainLink: { color: '#60A5FA', fontWeight: '700', fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  docLabel: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, flex: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  reasonBox: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 14,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  reason: { color: '#F87171', textAlign: 'center', lineHeight: 20 },
  msg: { color: '#A1A1AA', textAlign: 'center', marginBottom: spacing[3] },
  cta: {
    marginTop: spacing[2],
    borderRadius: radius.pill,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6345ED',
  },
  ctaLeft: { ...StyleSheet.absoluteFillObject, backgroundColor: '#6345ED' },
  ctaRight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.7,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
