import React from 'react';
import markUrl from '@movr/design-system/assets/logo/movr-mark.svg?url';

/** Brand wordmark — image asset only (never styled text approximating the logo). */
export default function MovrWordmark({
  height = 28,
  className = '',
  title = 'MOVR',
}: {
  height?: number;
  className?: string;
  title?: string;
}) {
  const h = Math.max(24, height);
  return (
    <img
      src={markUrl}
      alt={title}
      height={h}
      width={h}
      className={`inline-block ${className}`}
      style={{ height: h, width: h, minHeight: 24 }}
    />
  );
}
