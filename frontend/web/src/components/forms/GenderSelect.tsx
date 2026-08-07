import React from 'react';
import { FormField, fieldClassName } from './FormField';
import { GENDER_OPTIONS, GenderValue } from './gender';

type Props = {
  label?: string;
  value: GenderValue | string;
  onChange: (value: GenderValue) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
};

/** Global gender selector — fixed options only (no manual text). */
export default function GenderSelect({
  label = 'Gender',
  value,
  onChange,
  required,
  disabled,
  error,
  className,
}: Props) {
  return (
    <FormField label={label} error={error} className={className}>
      <select
        className={fieldClassName}
        value={value || ''}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as GenderValue)}
        aria-label={label}
      >
        <option value="" disabled>
          Select gender
        </option>
        {GENDER_OPTIONS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
