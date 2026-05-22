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
        void: '#071426',
        ink: '#F7F8F8',
        muted: '#8A8F98',
        panel: '#0D0E10',
        panel2: '#14161A',
        line: 'rgba(255,255,255,0.08)',
        spacex: '#F0F0FA',
        violet: '#7170ff',
        cyan: '#74e3d4',
        amber: '#F3BE63',
        green: '#10B981',
        red: '#EF7D7D',
      },
      boxShadow: {
        mission: '0 24px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)',
        glow: '0 0 48px rgba(113,112,255,.22)',
      },
      backgroundImage: {
        'mission-grid': 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)',
        'radial-stage': 'radial-gradient(circle at 20% -10%, rgba(113,112,255,.32), transparent 28rem), radial-gradient(circle at 80% 10%, rgba(116,227,212,.14), transparent 28rem), linear-gradient(180deg,#050506,#08090A 42%,#050506)',
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
