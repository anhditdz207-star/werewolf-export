/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#0B1220',
          800: '#16213A',
          700: '#1F2D4A',
        },
        moon: {
          400: '#F4D58D',
          300: '#F8E3AE',
        },
        blood: {
          500: '#B3261E',
          600: '#8F1E17',
        },
        parchment: {
          100: '#F1E9D2',
        },
        mist: {
          400: '#7C8DA6',
          600: '#546077',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
