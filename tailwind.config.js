/** @type {import('tailwindcss').Config} */
export default {
  // QUAN TRỌNG: Cho phép Tailwind chuyển chế độ tối dựa trên class "dark" ở thẻ html
  darkMode: 'class', 
  
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}