import React, { useEffect, useState } from 'react';
import { FormField, fieldClassName } from './FormField';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  '/api/v1';

export type CountryOption = {
  code: string;
  name: string;
  currencyCode?: string;
  dialCode?: string;
};

type Props = {
  label?: string;
  value: string;
  onChange: (code: string, option?: CountryOption) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** When true, also sync locale store via callback only (parent decides). */
  placeholder?: string;
};

/** Country selector — live from GET /public/countries (no manual typing). */
export default function CountrySelect({
  label = 'Country',
  value,
  onChange,
  required,
  disabled,
  error,
  className,
  placeholder = 'Select country',
}: Props) {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/public/countries`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const rows: CountryOption[] = Array.isArray(j?.data)
          ? j.data.map((c: any) => ({
              code: String(c.code || '').toUpperCase(),
              name: c.name || c.code,
              currencyCode: c.currencyCode || c.currency_code,
              dialCode: c.dialCode || c.dial_code,
            }))
          : [];
        setCountries(
          rows.length
            ? rows
            : [
                { code: 'GH', name: 'Ghana', currencyCode: 'GHS', dialCode: '+233' },
                { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', dialCode: '+234' },
                { code: 'KE', name: 'Kenya', currencyCode: 'KES', dialCode: '+254' },
                { code: 'ZA', name: 'South Africa', currencyCode: 'ZAR', dialCode: '+27' },
              ]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCountries([
            { code: 'GH', name: 'Ghana', currencyCode: 'GHS', dialCode: '+233' },
            { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', dialCode: '+234' },
            { code: 'KE', name: 'Kenya', currencyCode: 'KES', dialCode: '+254' },
            { code: 'ZA', name: 'South Africa', currencyCode: 'ZAR', dialCode: '+27' },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FormField label={label} error={error} className={className}>
      <select
        className={fieldClassName}
        value={value || ''}
        required={required}
        disabled={disabled || loading}
        onChange={(e) => {
          const code = e.target.value.toUpperCase();
          const opt = countries.find((c) => c.code === code);
          onChange(code, opt);
        }}
        aria-label={label}
      >
        <option value="" disabled>
          {loading ? 'Loading countries…' : placeholder}
        </option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
            {c.currencyCode ? ` · ${c.currencyCode}` : ''}
          </option>
        ))}
      </select>
    </FormField>
  );
}
