/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4A90A4',
        secondary: '#7BC9A6',
        accent: '#E8846B',
        background: '#F8FAFB',
        text: '#2D3748',
      },
      fontFamily: {
        sans: ['Noto Sans CJK SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
