/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        odoo: {
          light: '#8f6885',
          DEFAULT: '#714B67',
          dark: '#58364f',
          trans: 'rgba(113, 75, 103, 0.08)',
          transHover: 'rgba(113, 75, 103, 0.15)',
        },
        charcoal: '#1e293b',
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
