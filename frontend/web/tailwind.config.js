/** @type {import('tailwindcss').Config} */
const movrPreset = require('../../design-system/tailwind.preset.js');

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [movrPreset],
  theme: {
    extend: {},
  },
  plugins: [],
};
