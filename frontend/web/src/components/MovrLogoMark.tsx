import React from 'react';

/** Shared MOVR mark from design-system — prefer this over redrawing the logo as text. */
export default function MovrLogoMark({
  className = 'w-9 h-9',
  title = 'MOVR',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="movrGradApp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3F7048" />
          <stop offset="50%" stopColor="#6A00FF" />
          <stop offset="100%" stopColor="#0055FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#movrGradApp)" />
      <path
        fill="#FFFFFF"
        d="M14 44V20h7.2l6.4 14.8L34 20H41v24h-6.2V29.2L28.6 44h-5.2L17.2 29.2V44H14zm30.5 0V20h6.2v24h-6.2z"
      />
    </svg>
  );
}
