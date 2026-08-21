/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#09090b',
          800: '#121215',
          700: '#1c1c21',
          600: '#272730',
        }
      }
    },
  },
  plugins: [],
}
