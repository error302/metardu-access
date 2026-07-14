/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './packages/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand colors derived from the Metardu logo
        metardu: {
          orange: '#F97316',
          'orange-light': '#FB923C',
          'orange-dark': '#EA580C',
          navy: '#0B1F3A',
          'navy-light': '#1E3A5F',
          'navy-dark': '#061122',
          white: '#FFFFFF',
          cream: '#FAF7F2',
          // Field-specific semantic colors
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        heading: ['InterDisplay', 'Inter', 'System'],
        mono: ['JetBrainsMono', 'Courier', 'monospace'],
      },
      fontSize: {
        // Touch-friendly sizing for field use (gloves)
        'field-sm': ['14px', { lineHeight: '20px' }],
        field: ['16px', { lineHeight: '24px' }],
        'field-lg': ['18px', { lineHeight: '28px' }],
        'field-xl': ['22px', { lineHeight: '32px' }],
      },
      spacing: {
        // Minimum 48px touch targets
        touch: '48px',
        'touch-sm': '40px',
      },
      borderRadius: {
        card: '12px',
        sheet: '20px',
      },
      boxShadow: {
        'field-card': '0px 2px 8px rgba(11, 31, 58, 0.08)',
        'field-elevated': '0px 8px 24px rgba(11, 31, 58, 0.16)',
      },
    },
  },
  plugins: [],
};
