/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Дозволяє перемикати темну тему класом 'dark'
  theme: {
    extend: {
      colors: {
        // Тут ми потім додамо фірмові кольори з твого макета (наприклад, синій фон бічної панелі)
        brand: {
          dark: '#1e293b',
          light: '#f0f9ff',
          accent: '#0ea5e9'
        }
      }
    },
  },
  plugins: [],
}
