/**
 * Shared Tailwind preset — loads design-system/tokens.json so web + admin
 * never hardcode brand hex in their own configs.
 */
const path = require('path');
const tokens = require('./tokens.json');

const colors = {
  'jet-black': tokens.colors.jetBlack,
  'pure-white': tokens.colors.pureWhite,
  'electric-violet': tokens.colors.electricViolet,
  'motion-blue': tokens.colors.motionBlue,
  'movr-green': tokens.colors.movrGreen,
  surface: tokens.colors.surface,
  'surface-elevated': tokens.colors.surfaceElevated,
  success: tokens.colors.success,
  error: tokens.colors.error,
  warning: tokens.colors.warning,
  'text-primary': tokens.colors.textPrimary,
  'text-secondary': tokens.colors.textSecondary,
  border: tokens.colors.border,
};

const spacing = Object.fromEntries(
  Object.entries(tokens.spacing).map(([k, v]) => [k, `${v}px`])
);

const borderRadius = Object.fromEntries(
  Object.entries(tokens.radius).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v])
);

module.exports = {
  theme: {
    extend: {
      colors,
      spacing,
      borderRadius,
      fontFamily: {
        sans: [tokens.typography.fontFamily.primary, tokens.typography.fontFamily.secondary, 'system-ui', 'sans-serif'],
        display: [tokens.typography.fontFamily.primary, 'sans-serif'],
        secondary: [tokens.typography.fontFamily.secondary, 'sans-serif'],
      },
      fontSize: {
        display: [`${tokens.typography.scale.display.size}px`, { lineHeight: `${tokens.typography.scale.display.lineHeight}px`, fontWeight: `${tokens.typography.scale.display.weight}` }],
        h1: [`${tokens.typography.scale.h1.size}px`, { lineHeight: `${tokens.typography.scale.h1.lineHeight}px`, fontWeight: `${tokens.typography.scale.h1.weight}` }],
        h2: [`${tokens.typography.scale.h2.size}px`, { lineHeight: `${tokens.typography.scale.h2.lineHeight}px`, fontWeight: `${tokens.typography.scale.h2.weight}` }],
        body: [`${tokens.typography.scale.body.size}px`, { lineHeight: `${tokens.typography.scale.body.lineHeight}px`, fontWeight: `${tokens.typography.scale.body.weight}` }],
        caption: [`${tokens.typography.scale.caption.size}px`, { lineHeight: `${tokens.typography.scale.caption.lineHeight}px`, fontWeight: `${tokens.typography.scale.caption.weight}` }],
      },
      backgroundImage: {
        'movr-gradient': tokens.gradient.primaryCss,
        'movr-gradient-shimmer':
          'linear-gradient(90deg, #3F7048 0%, #6A00FF 40%, #0055FF 60%, #6A00FF 100%)',
      },
      boxShadow: {
        'focus-glow': tokens.elevation.focusGlow,
        'active-glow': tokens.elevation.activeGlow,
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
