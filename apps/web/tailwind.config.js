/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'var(--canvas-bg)',
          bg: 'var(--canvas-bg)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-bg)',
          bg: 'var(--sidebar-bg)',
        },
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          modal: 'var(--surface-modal)',
        },
        app: {
          border: {
            subtle: 'var(--border-subtle)',
            DEFAULT: 'var(--border-default)',
            focus: 'var(--border-focus)',
            hover: 'var(--border-hover)',
          },
          text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
          },
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger: 'var(--status-danger)',
          info: 'var(--status-info)',
        },
        slate: {
          800: '#1e2438',
          850: '#161a29',
          900: '#111420',
          925: '#0b0d14',
          950: '#07080d',
        },
        brand: {
          DEFAULT: 'var(--primary-brand)',
          primary: 'var(--primary-brand)',
          hover: 'var(--primary-brand-hover)',
          active: 'var(--primary-brand-active)',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '"Outfit"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Inter"',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        display: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.025em', fontWeight: '700' }],
        h1: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        h3: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0em', fontWeight: '400' }],
        caption: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
        micro: ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.05em', fontWeight: '700' }],
      },
      borderRadius: {
        badge: '9999px',
        input: '8px',
        button: '8px',
        card: '12px',
        modal: '16px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.25), 0 1px 2px -1px rgba(0, 0, 0, 0.25)',
        popover: '0 10px 25px -5px rgba(0, 0, 0, 0.40), 0 8px 10px -6px rgba(0, 0, 0, 0.40)',
        modal: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-up': 'slideInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
