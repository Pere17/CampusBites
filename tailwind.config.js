/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#FF6B35', hover: '#FF8C42' },
        accent: '#FFB703',
        success: '#22C55E',
        danger: '#EF4444',
        bg: '#F8FAFC',
        bg2: '#F1F5F9',
        card: '#FFFFFF',
        surface: '#F1F5F9',
        line: '#E2E8F0',
        ink: '#0F172A',
        ink2: '#334155',
        ink3: '#64748B'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(0,0,0,0.4)',
        glow: '0 0 0 3px rgba(255,107,53,0.25)'
      }
    }
  },
  plugins: []
};
