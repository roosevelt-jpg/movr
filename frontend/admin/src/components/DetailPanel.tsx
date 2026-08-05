import React from 'react';
import { X } from 'lucide-react';

/**
 * Side detail panel for admin row inspection (Phase 0B density).
 */
export default function DetailPanel({
  title,
  open,
  onClose,
  children,
  widthClass = 'w-full max-w-md',
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;

  return (
    <aside
      className={`${widthClass} shrink-0 border-l border-border bg-surface h-full overflow-auto`}
      aria-label={title}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-admin-3 px-admin-4 py-admin-3 border-b border-border bg-surface-elevated">
        <h2 className="text-admin-base font-semibold text-text-primary truncate">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-admin-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface"
          aria-label="Close detail"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-admin-4 text-admin-sm text-text-primary space-y-admin-3">{children}</div>
    </aside>
  );
}
