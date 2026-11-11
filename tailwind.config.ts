import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#080A0C",
          900: "#0B0E11",
          850: "#0E1216",
          800: "#12161B",
          750: "#161B21",
          700: "#1B2128",
          600: "#252D36",
          500: "#36414D",
        },
        ink: {
          100: "#F4F7FA",
          200: "#D9E0E7",
          300: "#AEB9C4",
          400: "#7F8B97",
          500: "#5B6672",
        },
        bull: "#2DD4A7",
        bear: "#F2557A",
        accent: "#5AA9FF",
        warn: "#F5B544",
        violet: "#A78BFA",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(90,169,255,0.25), 0 0 28px -6px rgba(90,169,255,0.35)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite",
        fadeUp: "fadeUp 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
