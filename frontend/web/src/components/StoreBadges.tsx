import React from 'react';

export type StoreKind = 'ios' | 'android';

function detectStore(label?: string, store?: string, href?: string): StoreKind {
  const s = `${store || ''} ${label || ''} ${href || ''}`.toLowerCase();
  if (
    s.includes('android') ||
    s.includes('google') ||
    s.includes('play') ||
    s.includes('play.google')
  ) {
    return 'android';
  }
  return 'ios';
}

/** Official-style App Store badge. */
export function AppStoreBadge({ className = 'h-12 w-auto' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Download on the App Store"
    >
      <rect width="120" height="40" rx="6" fill="#000" stroke="#A6A6A6" strokeWidth="0.6" />
      <path
        fill="#fff"
        d="M24.77 20.35c-.03-2.35 1.91-3.48 2-3.54-1.09-1.59-2.78-1.81-3.38-1.83-1.44-.15-2.81.85-3.54.85-.73 0-1.86-.83-3.06-.8-1.57.02-3.02.91-3.83 2.32-1.64 2.84-.42 7.04 1.17 9.35.78 1.13 1.71 2.39 2.93 2.35 1.19-.05 1.64-.76 3.07-.76 1.43 0 1.83.76 3.08.74 1.28-.02 2.09-1.15 2.86-2.29.9-1.31 1.27-2.58 1.29-2.65-.03-.01-2.47-.95-2.5-3.76zm-2.34-6.89c.64-.78 1.08-1.86.96-2.94-0.93.04-2.05.62-2.72 1.4-.6.69-1.12 1.8-.98 2.86 1.03.08 2.09-.52 2.74-1.32z"
      />
      <g fill="#fff" fontFamily="SF Pro Text, Helvetica Neue, Helvetica, Arial, sans-serif">
        <text x="40" y="15.2" fontSize="5.4">
          Download on the
        </text>
        <text x="40" y="28.2" fontSize="12" fontWeight="600">
          App Store
        </text>
      </g>
    </svg>
  );
}

/** Official-style Google Play badge with multicolor triangle logo. */
export function GooglePlayBadge({ className = 'h-12 w-auto' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 135 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Get it on Google Play"
    >
      <rect width="135" height="40" rx="6" fill="#000" stroke="#A6A6A6" strokeWidth="0.6" />
      <g transform="translate(9.5,7.5)">
        <path
          fill="#00D4FF"
          d="M.85.55C.3 1.05 0 1.9 0 2.95v18.1c0 1.05.3 1.9.85 2.4l.05.05 10.2-10.2V10.7L.85.55z"
        />
        <path
          fill="#FFD400"
          d="m15.95 14.85-3.05-3.05L1.1 23.6c.55.5 1.4.4 2.3-.1l12.55-7.2v-1.45z"
        />
        <path
          fill="#F44336"
          d="M15.95 9.15 3.4 1.95C2.5 1.45 1.65 1.55 1.1 2.05l11.8 11.8 3.05-3.05V9.15z"
        />
        <path
          fill="#00E676"
          d="m12.9 11.8 3.05 3.05 3.7-2.15c1.05-.6 1.05-1.55 0-2.15l-3.7-2.15-3.05 3.05v.35z"
        />
      </g>
      <g fill="#fff" fontFamily="Roboto, Helvetica, Arial, sans-serif">
        <text x="36" y="15" fontSize="5.2" letterSpacing="0.4">
          GET IT ON
        </text>
        <text x="36" y="28.5" fontSize="12" fontWeight="600">
          Google Play
        </text>
      </g>
    </svg>
  );
}

export function AppStoreMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-2 1.09-3.15-1.05.04-2.32.7-3.07 1.58-.67.76-1.26 2-1.11 3.17 1.17.09 2.36-.6 3.09-1.6z" />
    </svg>
  );
}

export function GooglePlayMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M3.6 2.3c-.4.3-.6.8-.6 1.5v16.4c0 .7.2 1.2.6 1.5l.1.1 9.1-9.1v-.3L3.7 2.3z" />
      <path fill="#FBBC04" d="M16.3 14.9 13.7 12.3 4.6 21.4l.1.1c.5.3 1.2.2 2-.3l9.6-5.5v-.8z" />
      <path fill="#4285F4" d="M16.3 9.1 6.7 3.6C5.9 3.1 5.2 3.2 4.7 3.6l9 9 2.6-2.6V9.1z" />
      <path fill="#34A853" d="m13.7 12.3 2.6 2.6 2.7-1.5c.9-.5.9-1.4 0-1.9l-2.7-1.5-2.6 1.5v.8z" />
    </svg>
  );
}

type BadgeProps = {
  label?: string;
  store?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** full = official badge; mark = logo + text in a button */
  variant?: 'full' | 'mark';
};

/** Renders App Store or Google Play badge from label/store/href. */
export function StoreBadgeButton({
  label,
  store,
  href,
  onClick,
  className = '',
  variant = 'full',
}: BadgeProps) {
  const kind = detectStore(label, store, href);
  const Badge = kind === 'android' ? GooglePlayBadge : AppStoreBadge;
  const Mark = kind === 'android' ? GooglePlayMark : AppStoreMark;
  const text = kind === 'android' ? 'Google Play' : 'App Store';

  const inner =
    variant === 'full' ? (
      <Badge className="h-12 w-auto max-w-full pointer-events-none" />
    ) : (
      <span className="inline-flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-black text-white">
        <Mark className="h-6 w-6 shrink-0" />
        <span className="font-semibold text-sm">{label || text}</span>
      </span>
    );

  if (href && !onClick) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={`inline-block transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-lg ${className}`}
        aria-label={label || text}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-block transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-lg ${className}`}
      aria-label={label || text}
    >
      {inner}
    </button>
  );
}

export { detectStore };
