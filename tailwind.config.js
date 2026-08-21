/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#e0f2fe',
        sky: '#38bdf8',
        paper: '#0b1020',
        neon: '#7dd3fc',
        neonPink: '#e879f9',
        hard: '#fb7185',
      },
      boxShadow: {
        neon: '0 0 12px rgba(56, 189, 248, 0.55), 0 0 28px rgba(56, 189, 248, 0.25)',
        'neon-hard': '0 0 12px rgba(251, 113, 133, 0.55), 0 0 28px rgba(251, 113, 133, 0.25)',
      },
    },
  },
  plugins: [],
}
