/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#fcfcfc",
        card: "#ffffff",
        accent: "#ff3b30",
        dim: "#64748b",
        mustard: "#ffd60a",
        cobalt: "#007aff",
        mint: "#34c759",
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '6px 6px 0px rgba(0,0,0,1)',
        'brutal-sm': '3px 3px 0px rgba(0,0,0,1)',
        'brutal-hover': '10px 10px 0px rgba(0,0,0,1)',
      },
      borderRadius: {
        'brutal': '1rem',
        'brutal-lg': '2rem',
      }
    },
  },
  plugins: [],
}
