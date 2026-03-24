/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        mono: ["'Space Mono'", "monospace"],
      },
      colors: {
        brand: {
          50:  "#f0fdf4",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
        dark: {
          900: "#080c0e",
          800: "#0d1418",
          700: "#141e24",
          600: "#1c2a32",
          500: "#243540",
        }
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-up": "fadeUp 0.5s ease forwards",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
