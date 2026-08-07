/**
 * Shared Tailwind preset — colors bind to CSS variables so light/dark
 * (`data-theme` on <html>) remaps every utility without per-page rewrites.
 * Opacity modifiers (e.g. bg-success/20) use color-mix against the CSS var.
 */
const tokens = require('./tokens.json');

/**
 * Tailwind may pass:
 * - undefined → solid color
 * - a number / numeric string (slash opacity like /80) → color-mix percent
 * - `var(--tw-*-opacity)` for base utilities → must not Number() (that becomes NaN%)
 */
const withAlpha = (cssVar) => {
  return ({ opacityValue }) => {
    if (opacityValue === undefined) {
      return `var(${cssVar})`;
    }
    const numeric =
      typeof opacityValue === 'number'
        ? opacityValue
        : typeof opacityValue === 'string' &&
            opacityValue.trim() !== '' &&
            !Number.isNaN(Number(opacityValue))
          ? Number(opacityValue)
          : null;
    if (numeric !== null) {
      const pct = Math.round(numeric * 1000) / 10;
      return `color-mix(in srgb, var(${cssVar}) ${pct}%, transparent)`;
    }
    return `color-mix(in srgb, var(${cssVar}) calc(${opacityValue} * 100%), transparent)`;
  };
};

const colors = {
  'jet-black': withAlpha('--jet-black'),
  'pure-white': withAlpha('--pure-white'),
  'electric-violet': withAlpha('--electric-violet'),
  'motion-blue': withAlpha('--motion-blue'),
  'movr-green': withAlpha('--movr-green'),
  surface: withAlpha('--surface'),
  'surface-elevated': withAlpha('--surface-elevated'),
  success: withAlpha('--success'),
  error: withAlpha('--error'),
  warning: withAlpha('--warning'),
  'text-primary': withAlpha('--text-primary'),
  'text-secondary': withAlpha('--text-secondary'),
  border: withAlpha('--border'),
  'brand-jet': withAlpha('--brand-jet'),
  'brand-white': withAlpha('--brand-white'),
};

const spacing = Object.fromEntries(
  Object.entries(tokens.spacing).map(([k, v]) => [k, `${v}px`])
);

const borderRadius = Object.fromEntries(
  Object.entries(tokens.radius).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v])
);

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors,
      spacing,
      borderRadius,
      fontFamily: {
        sans: [
          tokens.typography.fontFamily.primary,
          tokens.typography.fontFamily.secondary,
          'system-ui',
          'sans-serif',
        ],
        display: [tokens.typography.fontFamily.primary, 'sans-serif'],
        secondary: [tokens.typography.fontFamily.secondary, 'sans-serif'],
      },
      fontSize: {
        display: [
          `${tokens.typography.scale.display.size}px`,
          {
            lineHeight: `${tokens.typography.scale.display.lineHeight}px`,
            fontWeight: `${tokens.typography.scale.display.weight}`,
          },
        ],
        h1: [
          `${tokens.typography.scale.h1.size}px`,
          {
            lineHeight: `${tokens.typography.scale.h1.lineHeight}px`,
            fontWeight: `${tokens.typography.scale.h1.weight}`,
          },
        ],
        h2: [
          `${tokens.typography.scale.h2.size}px`,
          {
            lineHeight: `${tokens.typography.scale.h2.lineHeight}px`,
            fontWeight: `${tokens.typography.scale.h2.weight}`,
          },
        ],
        body: [
          `${tokens.typography.scale.body.size}px`,
          {
            lineHeight: `${tokens.typography.scale.body.lineHeight}px`,
            fontWeight: `${tokens.typography.scale.body.weight}`,
          },
        ],
        caption: [
          `${tokens.typography.scale.caption.size}px`,
          {
            lineHeight: `${tokens.typography.scale.caption.lineHeight}px`,
            fontWeight: `${tokens.typography.scale.caption.weight}`,
          },
        ],
      },
      backgroundImage: {
        'movr-gradient': 'var(--movr-gradient)',
        'movr-gradient-shimmer':
          'linear-gradient(90deg, #3F7048 0%, #6A00FF 40%, #0055FF 60%, #6A00FF 100%)',
      },
      boxShadow: {
        'focus-glow': 'var(--focus-glow)',
        'active-glow': 'var(--active-glow)',
      },
      keyframes: {
        'movr-shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'movr-glow-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.08)' },
        },
      },
      animation: {
        'movr-shimmer': 'movr-shimmer 3s linear infinite',
        'movr-glow-a': 'movr-glow-pulse 5.5s ease-in-out infinite',
        'movr-glow-b': 'movr-glow-pulse 6.2s ease-in-out 0.8s infinite',
      },
    },
  },
};
