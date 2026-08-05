/** @type {import('tailwindcss').Config} */
// Admin density variant: same brand tokens, tighter spacing for data-heavy ops.
const movrPreset = require('../../design-system/tailwind.preset.js');
const tokens = require('../../design-system/tokens.json');

const factor = tokens.adminDensity?.spacingFactor || 0.75;

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [movrPreset],
  theme: {
    extend: {
      spacing: {
        'admin-1': `${Math.round(4 * factor)}px`,
        'admin-2': `${Math.round(8 * factor)}px`,
        'admin-3': `${Math.round(12 * factor)}px`,
        'admin-4': `${Math.round(16 * factor)}px`,
        'admin-5': `${Math.round(24 * factor)}px`,
      },
      fontSize: {
        'admin-xs': ['11px', { lineHeight: '14px' }],
        'admin-sm': ['12px', { lineHeight: '16px' }],
        'admin-base': ['13px', { lineHeight: '18px' }],
      },
    },
  },
  plugins: [],
};
