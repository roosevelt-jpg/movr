import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const CLAIM_DAPP = process.env.EXPO_PUBLIC_CLAIM_DAPP_URL || 'http://localhost:5174/claim';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Phase 8 — Claim screen */
export default function ClaimScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [eligibility, setEligibility] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/token/claim/eligibility`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setEligibility(j.data))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async () => {
    if (eligibility?.claimMode === 'custodial') {
      setBusy(true);
      try {
        const res = await fetch(`${API}/token/claim/custodial`, {
          method: 'POST',
          headers: authHeaders(),
          body: '{}',
        });
        const json = await res.json();
        setMsg(json.message || (res.ok ? 'Claimed' : 'Failed'));
        load();
      } finally {
        setBusy(false);
      }
    } else {
      Linking.openURL(CLAIM_DAPP);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Claim DVT</Text>
      {!eligibility?.eligible ? (
        <Text style={styles.sub}>Nothing to claim</Text>
      ) : (
        <>
          <Text style={styles.balance}>{Number(eligibility.amount).toFixed(2)}</Text>
          <Pressable style={styles.btn} onPress={claim} disabled={busy}>
            <Text style={styles.btnText}>
              {busy
                ? 'Claiming…'
                : eligibility.claimMode === 'custodial'
                  ? 'Claim'
                  : 'Open claim DApp'}
            </Text>
          </Pressable>
        </>
      )}
      {!!msg && <Text style={styles.msg}>{msg}</Text>}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
    title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
    sub: { color: colors.textSecondary, marginTop: spacing[4] },
    balance: { color: colors.pureWhite, fontSize: 40, fontWeight: '700', marginVertical: spacing[4] },
    btn: {
      backgroundColor: colors.electricViolet,
      borderRadius: radius.md,
      padding: spacing[4],
      alignItems: 'center',
    },
    btnText: { color: colors.pureWhite, fontWeight: '700' },
    msg: { color: colors.textSecondary, marginTop: spacing[3] },
  });
}
