/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        void: '#030812',
        ink: '#F7F8F8',
        muted: '#8A8F98',
        panel: '#0D1420',
        panel2: '#111827',
        line: 'rgba(255,255,255,0.095)',
        spacex: '#F0F0FA',
        violet: '#7170ff',
        cyan: '#74e3d4',
        amber: '#F3BE63',
        green: '#10B981',
        red: '#EF7D7D',
      },
      borderRadius: {
        control: '0.78rem',
        card: '1rem',
        surface: '1.25rem',
      },
      boxShadow: {
        mission: '0 24px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)',
        glow: '0 0 48px rgba(113,112,255,.22)',
        card: '0 18px 70px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.055)',
        elevated: '0 30px 120px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.07)',
      },
      backgroundImage: {
        'mission-grid': 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)',
        'radial-stage': 'radial-gradient(circle at 20% -10%, rgba(113,112,255,.32), transparent 28rem), radial-gradient(circle at 80% 10%, rgba(116,227,212,.14), transparent 28rem), linear-gradient(180deg,#030812,#071426 42%,#02050a)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.22, 1, .36, 1)',
      },
      keyframes: {
        orbit: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        orbit: 'orbit 28s linear infinite',
        float: 'float 7s ease-in-out infinite',
        scan: 'scan 4s ease-in-out infinite',
      },
    },
  },
}
