/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", ".theme-dark"],
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--page) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        tint: "rgb(var(--tint) / <alpha-value>)",
        ink: "#17191d",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "danger-soft": "rgb(var(--danger-soft) / <alpha-value>)",
        stg: {
          yellow: "rgb(var(--yellow) / <alpha-value>)",
          blue: "rgb(var(--blue) / <alpha-value>)",
          gray: "#f3f4f6",
          ink: "#1f2937",
        },
      },
      boxShadow: {
        soft: "0 18px 55px rgba(31, 41, 55, 0.12)",
      },
    },
  },
  plugins: [],
};
