import React from 'react';

export type FilterOption = { value: string; label: string };

/**
 * Compact filter bar for admin dense layouts (Phase 0B).
 */
export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  actions,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-admin-3 mb-admin-4">
      {onSearchChange ? (
        <input
          value={search || ''}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="rounded-md bg-surface-elevated border border-border px-admin-3 py-admin-2 text-admin-sm text-text-primary placeholder:text-text-secondary min-w-[200px]"
        />
      ) : null}
      {filters.map((f) => (
        <label key={f.key} className="flex items-center gap-admin-2 text-admin-xs text-text-secondary">
          <span>{f.label}</span>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="rounded-md bg-surface-elevated border border-border px-admin-2 py-admin-2 text-admin-sm text-text-primary"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {actions ? <div className="ml-auto flex items-center gap-admin-2">{actions}</div> : null}
    </div>
  );
}
