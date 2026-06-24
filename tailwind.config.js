/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#000000',
          raised: '#0a0a0a',
          border: '#262626',
          hover: '#171717'
        },
        accent: {
          DEFAULT: '#ededed',
          muted: '#a3a3a3',
          glow: 'rgba(255, 255, 255, 0.1)'
        },
        critical: {
          DEFAULT: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.1)'
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.1)'
        },
        success: {
          DEFAULT: '#10b981',
          bg: 'rgba(16, 185, 129, 0.1)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.3)',
        'glass-sm': '0 2px 10px rgba(0, 0, 0, 0.2)',
      }
    }
  },
  plugins: []
}
