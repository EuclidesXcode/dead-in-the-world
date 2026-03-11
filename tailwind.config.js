/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        blood: '#8B0000',
        zombie: '#4a7c59',
        rust: '#b7410e',
        neon: '#39ff14',
        acid: '#b5e853',
        dark: {
          900: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          600: '#222222',
          500: '#2d2d2d',
        },
      },
      animation: {
        'flicker': 'flicker 0.15s infinite',
        'pulse-red': 'pulse-red 1s ease-in-out infinite',
        'shake': 'shake 0.3s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'scan': 'scan 3s linear infinite',
        'glitch': 'glitch 1s steps(1) infinite',
        'zombie-walk': 'zombie-walk 0.5s steps(2) infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 5px #ff0000' },
          '50%': { boxShadow: '0 0 20px #ff0000, 0 0 40px #ff0000' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-3px)' },
          '75%': { transform: 'translateX(3px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glitch: {
          '0%': { transform: 'translate(0)' },
          '10%': { transform: 'translate(-2px, 2px)' },
          '20%': { transform: 'translate(2px, -2px)' },
          '30%': { transform: 'translate(0)' },
          '100%': { transform: 'translate(0)' },
        },
        'zombie-walk': {
          '0%': { transform: 'translateX(0) rotate(-3deg)' },
          '100%': { transform: 'translateX(2px) rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
};
