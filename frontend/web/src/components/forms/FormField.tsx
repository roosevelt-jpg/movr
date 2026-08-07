import React from 'react';

export const fieldClassName =
  'input-base rounded-xl min-h-[48px] text-base sm:text-sm touch-manipulation';

export const labelClassName = 'block text-sm text-text-secondary mb-2';

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/** Shared labeled field wrapper for auth + settings forms. */
export function FormField({ label, hint, error, className = '', children }: FieldProps) {
  return (
    <div className={`w-full ${className}`}>
      {label ? <label className={labelClassName}>{label}</label> : null}
      {children}
      {error ? <p className="mt-1.5 text-sm text-error">{error}</p> : null}
      {!error && hint ? <p className="mt-1.5 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export function TextField({
  label,
  hint,
  error,
  leading,
  trailing,
  className = '',
  ...props
}: TextFieldProps) {
  const padCls = [
    leading ? 'input-has-leading' : '',
    trailing ? 'input-has-trailing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <FormField label={label} hint={hint} error={error}>
      <div className="relative">
        {leading ? (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none flex items-center justify-center w-5 h-5"
            aria-hidden
          >
            {leading}
          </span>
        ) : null}
        <input
          {...props}
          className={`${fieldClassName} ${padCls} ${className}`.trim()}
        />
        {trailing ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary flex items-center justify-center">
            {trailing}
          </span>
        ) : null}
      </div>
    </FormField>
  );
}
