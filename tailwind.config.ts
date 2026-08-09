import type { Config } from 'tailwindcss'

const config: Config = {

  darkMode: "class",

  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#C9A227',
        navy: '#1B2A5E',
        'navy-dark': '#0f1a3a',
        'navy-deep': '#0a1437',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeUp:  { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeOut: { from: { opacity: '1' }, to: { opacity: '0' } },
        popIn:   { from: { transform: 'scale(0.7)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        shake:   { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        livePulse: { '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.6)' }, '70%': { boxShadow: '0 0 0 7px rgba(34,197,94,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' } },
        goldPulse: { '0%,100%': { boxShadow: '0 6px 24px rgba(27,42,94,0.6), 0 0 0 3px rgba(201,162,39,0.6)' }, '50%': { boxShadow: '0 6px 24px rgba(27,42,94,0.6), 0 0 0 9px rgba(201,162,39,0.0)' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        dotPulse: { '0%,100%': { opacity: '0.2' }, '50%': { opacity: '1' } },
        bounce: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(6px)' } },
        shimmer: { from: { left: '-100%' }, to: { left: '160%' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.35s ease',
        fadeUp: 'fadeUp 0.5s ease both',
        fadeOut: 'fadeOut 0.35s ease forwards',
        popIn: 'popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
        shake: 'shake 0.4s ease',
        livePulse: 'livePulse 1.5s ease-in-out infinite',
        goldPulse: 'goldPulse 1.2s ease-in-out infinite',
        spin: 'spin 0.7s linear infinite',
        dotPulse: 'dotPulse 1.2s ease-in-out infinite',
        bounce: 'bounce 1.6s ease-in-out infinite',
        shimmer: 'shimmer 0.5s ease',
      },
    },
  },
  plugins: [],
}
export default config
