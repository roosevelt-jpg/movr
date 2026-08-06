import React from 'react';
import { colors } from '@movr/design-system/theme';

/** Compact web-friendly KYC trust badge for merchant portal (Phase 5A). */
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
        border: `1px solid ${colors.success}`,
        color: colors.success,
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      Verified on-chain
    </a>
  );
}

export default VerifiedBadgeWeb;
