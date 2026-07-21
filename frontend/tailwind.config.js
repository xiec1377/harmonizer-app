/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#0D0F14',
        fog: '#1A1D24',
        mist: '#252830',
        slate: '#3A3E4A',
        silver: '#8892A4',
        pearl: '#C8D0DC',
        resonance: '#A78BFA',   // violet — the "harmony glow" color
        melody: '#38BDF8',      // sky blue — melody line
        gold: '#FBBF24',        // amber — in-tune indicator
        ember: '#F472B6',       // pink — sharp/flat warning
      },
      animation: {
        'glow-pulse': 'glowPulse 1.5s ease-in-out infinite',
        'pitch-bounce': 'pitchBounce 0.2s ease-out',
        'fade-up': 'fadeUp 0.4s ease-out',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(167,139,250,0.3)' },
          '50%': { boxShadow: '0 0 24px 8px rgba(167,139,250,0.7)' },
        },
        pitchBounce: {
          '0%': { transform: 'scaleY(1.2)' },
          '100%': { transform: 'scaleY(1)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
