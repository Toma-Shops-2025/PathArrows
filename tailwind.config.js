/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#163a73',
        sky: '#3b82f6',
        paper: '#f7f9fc',
      },
    },
  },
  plugins: [],
}
