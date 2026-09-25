import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // AetherShare design system — "Biophilic Metropolitan"
        primary:    '#286749',
        'primary-dim':       '#2b6a4b',
        'primary-container': '#438060',
        'primary-fixed':     '#aff1ca',
        secondary:  '#5845cb',
        'secondary-container': '#7160e6',

        surface:    '#fcf9f8',
        'surface-low':    '#f6f3f2',
        'surface-mid':    '#f0eded',
        'surface-high':   '#eae7e7',
        'surface-white':  '#ffffff',

        'on-surface':         '#1b1b1c',
        'on-surface-variant': '#404943',
        outline:              '#707972',
        'outline-variant':    '#bfc9c0',

        background: '#faf8f4',
        error:      '#ba1a1a',
      },
      fontFamily: {
        display: ['var(--font-hanken)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-inter)',  'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card:  '2rem',   // 32px — device/drop-zone cards
        modal: '1.5rem', // 24px — modals & large containers
        btn:   '9999px', // fully rounded buttons
      },
      boxShadow: {
        l1:             '0px 4px 20px rgba(0,0,0,0.03)',
        l2:             '0px 10px 40px rgba(0,0,0,0.08)',
        'primary-glow': '0px 4px 20px rgba(40,103,73,0.15)',
        'primary-hover':'0px 8px 32px rgba(40,103,73,0.25)',
      },
      animation: {
        'fade-in':    'fadeIn 0.35s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.215,0.61,0.355,1) infinite',
        'progress':   'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                                '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseRing: { '0%': { transform: 'scale(0.8)', opacity: '0.5' },     '100%': { transform: 'scale(1.5)', opacity: '0' } },
        shimmer:   { '0%': { transform: 'translateX(-100%)' },              '100%': { transform: 'translateX(400%)' } },
      },
    },
  },
  plugins: [],
};

export default config;
