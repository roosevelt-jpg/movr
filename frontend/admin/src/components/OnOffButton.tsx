import React from 'react';

type OnOffButtonProps = {
  on: boolean;
  onClick: () => void;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
};

/** Solid green (on) / red (off) status button — never a plain text "Toggle" link. */
export default function OnOffButton({
  on,
  onClick,
  onLabel = 'On',
  offLabel = 'Off',
  disabled,
  title,
  className = '',
}: OnOffButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={className}
      style={{
        border: 'none',
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        color: '#ffffff',
        background: on ? 'var(--success)' : 'var(--error)',
        minWidth: 56,
        lineHeight: 1.2,
      }}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}
