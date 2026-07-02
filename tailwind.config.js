/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Tajawal', 'Cairo', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        secondary: {
          DEFAULT: '#0EA5E9',
          50: '#F0F9FF',
          100: '#E0F2FE',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
        },
        accent: {
          DEFAULT: '#10B981',
          50: '#ECFDF5',
          500: '#10B981',
          600: '#059669',
        },
        background: '#F8FAFC',
        surface: '#FFFFFF',
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        border: '#E2E8F0',
        success: {
          DEFAULT: '#22C55E',
          50: '#F0FDF4',
          500: '#22C55E',
          600: '#16A34A',
        },
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
        },
        danger: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
        },
        info: {
          DEFAULT: '#3B82F6',
          50: '#EFF6FF',
          500: '#3B82F6',
          600: '#2563EB',
        },
        shift: {
          morning: '#22C55E',
          evening: '#F59E0B',
          night: '#8B5CF6',
          oncall: '#2563EB',
          overtime: '#F97316',
          vacation: '#94A3B8',
          sick: '#EF4444',
          training: '#06B6D4',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        'card': '8px',
        'btn': '8px',
        'pill': '9999px',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(15,23,42,.05)',
        'card': '0 1px 2px rgba(15,23,42,.04)',
        'dropdown': '0 12px 24px -18px rgba(15,23,42,.28), 0 4px 10px -8px rgba(15,23,42,.18)',
      },
    },
  },
  plugins: [],
}
