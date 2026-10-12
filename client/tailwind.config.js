/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jama: {
          50: '#f0f5fa',
          100: '#dce8f4',
          200: '#bfd5ec',
          300: '#94bce0',
          400: '#639ecf',
          500: '#4082bf',
          600: '#2f69a5',
          700: '#1b4b7e', // JAMA Primary Navy
          800: '#193f69',
          900: '#102742',
          gold: '#cba052' // Corporate accent
        }
      }
    },
  },
  plugins: [],
}
