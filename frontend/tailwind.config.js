/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // src भित्र सबै files scan हुन्छन्
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eaf1fb",
          100: "#cfe0f6",
          200: "#9fc1ee",
          300: "#6ea2e5",
          400: "#3d83dd",
          500: "#1d64c9",
          600: "#0047AB",
          700: "#003a8c",
          800: "#002d6d",
          900: "#00204e",
        },
        accent: {
          50: "#fff8e6",
          100: "#ffedbf",
          200: "#ffdd85",
          300: "#ffc94d",
          400: "#ffb81f",
          500: "#f5a300",
          600: "#cc8600",
          700: "#a36a00",
          800: "#7a4f00",
          900: "#523500",
        },
        // Public-site theme (Home/About/Services/Projects/Contact/Navbar/Footer).
        // Ramp built from the Leeez navy-to-sky-blue palette: 100 = main theme
        // (page wash / light pop), 500 = font accent, 900 = hover/selection.
        theme: {
          50: "#daf1ff",
          100: "#c1e8ff",
          200: "#9fc4e5",
          300: "#7da0ca",
          400: "#6992bf",
          500: "#5483b3",
          600: "#3a6495",
          700: "#204678",
          800: "#052659",
          900: "#021024",
        },
        // Warm accent reserved for action buttons only (softened — the earlier
        // shade read as an alarm/danger color).
        pop: {
          400: "#f5ab6e",
          500: "#F2994A",
          600: "#d9822f",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Poppins", "Inter", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
}