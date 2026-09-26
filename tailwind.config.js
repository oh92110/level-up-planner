/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090c',
          900: '#0d0f14',
          850: '#12151c',
          800: '#171b24',
          700: '#232935',
          600: '#333b4a',
        },
        accent: {
          DEFAULT: '#5b8cff',
          soft: '#8fb0ff',
          dim: '#2b3d6b',
        },
        hi: '#ff5f56',
        med: '#ffa23a',
        lo: '#4ade80',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)',
      },
    },
  },
  plugins: [],
}
