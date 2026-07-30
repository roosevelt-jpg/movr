import React from 'react';
import { Pressable, StyleSheet, Text, Linking, View } from 'react-native';
import { colors, radius, spacing } from '@movr/design-system/theme';

/** Trust badge — links to block explorer when attestation is Verified (Phase 5A). */
export function VerifiedBadge({
  status,
  explorerUrl,
}: {
  status?: string;
  explorerUrl?: string | null;
}) {
  if (status !== 'Verified') return null;

  return (
    <Pressable
      style={styles.badge}
      onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
    >
      <Text style={styles.text}>Verified</Text>
    </Pressable>
  );
}

/** Compact web-friendly twin for merchant portal */
export function VerifiedBadgeWeb({
  status,
  explorerUrl,
}: {
  status?: string;
  explorerUrl?: string | null;
}) {
  if (status !== 'Verified') return null;
  return (
    <a
      href={explorerUrl || '#'}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid #00D97A',
        color: '#00D97A',
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      Verified on-chain
    </a>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  text: { color: colors.success, fontSize: 12, fontWeight: '700' },
});

export default VerifiedBadge;
