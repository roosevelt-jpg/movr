import React from 'react';
import { FormField, fieldClassName } from './FormField';

type Props = {
  label?: string;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  min?: string;
  max?: string;
  hint?: string;
};

/** Date selector — native date input storing ISO YYYY-MM-DD (global format). */
export default function DateSelect({
  label = 'Date of birth',
  value,
  onChange,
  required,
  disabled,
  error,
  className,
  min = '1900-01-01',
  max,
  hint = 'Uses your device calendar · stored as YYYY-MM-DD',
}: Props) {
  const maxDate =
    max ||
    (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 13);
      return d.toISOString().slice(0, 10);
    })();

  return (
    <FormField label={label} error={error} hint={hint} className={className}>
      <input
        type="date"
        className={`${fieldClassName} [color-scheme:inherit]`}
        value={value || ''}
        required={required}
        disabled={disabled}
        min={min}
        max={maxDate}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
    </FormField>
  );
}

/** Format an ISO date for display in the user's locale. */
export function formatDisplayDate(iso?: string | null, locale?: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
