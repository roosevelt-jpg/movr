import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing } from '@movr/design-system/theme';

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

/** DVT Token Claim — breakdown, MetaMask, Merkle, gasless claim (mockup). */
export default function ClaimScreen({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<any>({
    amount: 2400,
    usdValue: 48,
    breakdown: { fromRides: 1200, fromOrders: 800, fromReferral: 400 },
    wallet: { provider: 'MetaMask', address: '0x3a4F...9d2c', connected: true },
    merkle: { verified: true, valid: true, network: 'Polygon', gasCovered: true },
    claimMode: 'custodial',
    eligible: true,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/token/claim/eligibility`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData((d: any) => ({ ...d, ...j.data }));
      })
      .catch(() => undefined);
  }, []);

  const amount = Number(data.amount || 2400);
  const usd = Number(data.usdValue ?? amount * 0.02);
  const b = data.breakdown || {};

  const claim = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/token/claim/custodial`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const json = await res.json();
      setMsg(json.message || (res.ok ? 'Claim submitted' : 'Claim queued'));
    } catch (e: any) {
      setMsg(e.message || 'Claim submitted');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>DVT Token Claim</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroA} />
        <View style={styles.heroB} />
        <Text style={styles.heroAmt}>{amount.toLocaleString()} DVT</Text>
        <Text style={styles.heroUsd}>≈ ${usd.toFixed(2)} USD</Text>
        <View style={styles.breakRow}>
          <View style={styles.breakCol}>
            <Text style={styles.breakLabel}>From Rides</Text>
            <Text style={styles.breakVal}>{Number(b.fromRides || 1200).toLocaleString()}</Text>
          </View>
          <View style={styles.breakCol}>
            <Text style={styles.breakLabel}>From Orders</Text>
            <Text style={styles.breakVal}>{Number(b.fromOrders || 800).toLocaleString()}</Text>
          </View>
          <View style={styles.breakCol}>
            <Text style={styles.breakLabel}>Referral</Text>
            <Text style={styles.breakVal}>{Number(b.fromReferral || 400).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.section}>DESTINATION WALLET</Text>
      <View style={styles.wallet}>
        <Text style={styles.mm}>🦊</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.walletName}>{data.wallet?.provider || 'MetaMask'}</Text>
          <Text style={styles.walletAddr}>{data.wallet?.address || '0x3a4F...9d2c'}</Text>
        </View>
        <View style={styles.connected}>
          <Text style={styles.connectedTxt}>Connected</Text>
        </View>
      </View>

      <View style={styles.merkle}>
        <Text style={styles.lock}>🔐</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.merkleTitle}>Merkle Proof Verified</Text>
            <View style={styles.valid}>
              <Text style={styles.validTxt}>Valid</Text>
            </View>
          </View>
          <Text style={styles.merkleBody}>
            Your eligibility confirmed on-chain. Network: {data.merkle?.network || 'Polygon'}. Gas
            covered by Movr.
          </Text>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Claiming</Text>
          <Text style={styles.sumVal}>{amount.toLocaleString()} DVT</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Network</Text>
          <Text style={styles.sumVal}>{data.merkle?.network || 'Polygon'}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Gas fee</Text>
          <Text style={[styles.sumVal, styles.green]}>Free (Movr pays)</Text>
        </View>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Pressable style={styles.cta} onPress={claim} disabled={busy || !data.eligible}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaTxt}>
          {busy ? 'Claiming…' : `Claim ${amount.toLocaleString()} DVT`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  back: { color: '#fff', fontSize: 22 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  hero: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#4C1D95',
  },
  heroA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7', opacity: 0.85 },
  heroB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.55,
    left: '40%',
  },
  heroAmt: { color: '#fff', fontSize: 36, fontWeight: '800', zIndex: 1 },
  heroUsd: { color: 'rgba(255,255,255,0.8)', marginTop: 4, zIndex: 1 },
  breakRow: { flexDirection: 'row', marginTop: 18, zIndex: 1 },
  breakCol: { flex: 1 },
  breakLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  breakVal: { color: '#fff', fontWeight: '800', marginTop: 4 },
  section: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  mm: { fontSize: 28 },
  walletName: { color: '#fff', fontWeight: '700' },
  walletAddr: { color: '#A1A1AA', fontSize: 12, marginTop: 2 },
  connected: {
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectedTxt: { color: '#22C55E', fontSize: 11, fontWeight: '700' },
  merkle: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3F3F46',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  lock: { fontSize: 22 },
  merkleTitle: { color: '#fff', fontWeight: '700' },
  valid: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  validTxt: { color: '#22C55E', fontSize: 11, fontWeight: '700' },
  merkleBody: { color: '#A1A1AA', fontSize: 12, marginTop: 6, lineHeight: 18 },
  summary: {
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sumLabel: { color: '#A1A1AA' },
  sumVal: { color: '#fff', fontWeight: '700' },
  green: { color: '#22C55E' },
  msg: { color: '#A1A1AA', textAlign: 'center', marginBottom: 8 },
  cta: {
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.85,
    left: '40%',
  },
  ctaTxt: { color: '#fff', fontWeight: '800', zIndex: 1 },
});
