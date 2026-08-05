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
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed ${
        on ? 'bg-success' : 'bg-error'
      } ${className}`}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}
