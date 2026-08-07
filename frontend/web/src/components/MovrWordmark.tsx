import React from 'react';
import { mediaUrl } from '../lib/media';

const DEFAULT_LOGO = '/brand/movr-logo.png';

/**
 * Brand logo — prefers CMS upload URL, else the Movr wordmark asset.
 * Never approximates the logo with styled text.
 */
export default function MovrWordmark({
  height = 28,
  className = '',
  title = 'Movr',
  src,
}: {
  height?: number;
  className?: string;
  title?: string;
  /** CMS-uploaded logo URL (header / chrome). */
  src?: string | null;
}) {
  const h = Math.max(24, height);
  const raw = (src && String(src).trim()) || DEFAULT_LOGO;
  const url = mediaUrl(raw) || DEFAULT_LOGO;

  return (
    <img
      src={url}
      alt={title}
      height={h}
      width={h}
      className={`inline-block object-contain rounded-md ${className}`}
      style={{ height: h, width: h, minHeight: 24 }}
    />
  );
}
