import React from 'react';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  width?: string | number;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
};

/**
 * Dense admin table — Phase 0B admin density variant.
 * Prefer this over spacious consumer Card grids for ops/finance/identity review.
 */
export default function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  onRowClick,
  emptyMessage = 'No rows',
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="w-full overflow-auto rounded-md border border-border bg-surface">
      <table className="w-full text-admin-sm border-collapse">
        <thead>
          <tr className="bg-surface-elevated border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left font-semibold text-text-secondary px-admin-3 py-admin-2 whitespace-nowrap tracking-wide uppercase text-admin-xs"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-admin-3 py-admin-5 text-text-secondary text-center">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={String(row.id ?? i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border/80 ${
                  onRowClick ? 'cursor-pointer hover:bg-surface-elevated/80' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-admin-3 py-admin-2 text-text-primary align-middle">
                    {col.render
                      ? col.render(row)
                      : col.accessor
                        ? col.accessor(row)
                        : String((row as any)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
