/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'jet-black': '#000000',
        'pure-white': '#FFFFFF',
        'electric-violet': '#6A00FF',
        'motion-blue': '#0055FF',
        'movr-green': '#3F7048',
        surface: '#0A0A0A',
        'surface-elevated': '#1A1A1A',
        success: '#00D97A',
        error: '#FF3B5C',
        warning: '#FFB800',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
        border: '#2A2A2A',
      },
      fontFamily: {
        sans: ['Poppins', 'Montserrat', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
        secondary: ['Montserrat', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '20px',
        pill: '999px',
      },
      backgroundImage: {
        'movr-gradient':
          'linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)',
      },
    },
  },
  plugins: [],
};
