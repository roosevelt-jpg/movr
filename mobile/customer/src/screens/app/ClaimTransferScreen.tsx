import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Claim-link landing for unregistered recipients. */
export default function ClaimTransferScreen({
  claimCode = '',
  onClaim,
}: {
  claimCode?: string;
  onClaim?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [preview, setPreview] = useState<{
    senderName: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!claimCode) {
      setError('Invalid claim link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API}/wallet/transfer/claim-preview/${encodeURIComponent(claimCode)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.status === 404 || !j?.data) {
          setPreview(null);
          setError('Transfer not found');
          return;
        }
        setPreview({
          senderName: j.data.senderName || 'Someone',
          amount: Number(j.data.amount ?? 0),
          currency: j.data.currency || 'GHS',
        });
      })
      .catch(() => {
        setPreview(null);
        setError('Unable to load transfer');
      })
      .finally(() => setLoading(false));
  }, [claimCode]);

  const fmt = preview
    ? preview.currency === 'GHS'
      ? `GH₵${preview.amount.toLocaleString()}`
      : preview.currency === 'NGN' || preview.currency === '₦'
        ? `₦${preview.amount.toLocaleString()}`
        : `${preview.currency} ${preview.amount.toLocaleString()}`
    : '';

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Movr</Text>
      {loading ? (
        <Text style={styles.body}>Loading transfer…</Text>
      ) : error || !preview ? (
        <>
          <Text style={styles.errorTitle}>{error || 'Transfer not found'}</Text>
          <Text style={styles.body}>This claim link is invalid or has expired.</Text>
        </>
      ) : (
        <>
          <View style={styles.icon}>
            <Text style={styles.iconText}>✈</Text>
          </View>
          <Text style={styles.from}>{preview.senderName} sent you</Text>
          <Text style={styles.amount}>{fmt}</Text>
          <Text style={styles.body}>
            Create a free Movr account to claim this transfer. Takes less than a minute.
          </Text>
          <Pressable style={styles.btn} onPress={onClaim}>
            <Text style={styles.btnText}>Claim with your phone number</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.jetBlack,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  brand: { color: colors.pureWhite, fontSize: 24, fontWeight: '800', marginBottom: spacing[8] },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.movrGreen,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  iconText: { fontSize: 28, color: colors.pureWhite },
  from: { color: colors.textSecondary, marginBottom: 8 },
  amount: { color: colors.pureWhite, fontSize: 42, fontWeight: '700', marginBottom: spacing[4] },
  errorTitle: { color: colors.pureWhite, fontSize: 20, fontWeight: '600', marginBottom: 8 },
  body: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[8],
  },
  btn: {
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.motionBlue,
  },
  btnText: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
});
}
