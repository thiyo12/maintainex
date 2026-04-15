import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF9E6',
          100: '#FFF0BF',
          200: '#FFE199',
          300: '#FFD166',
          400: '#FFC300',
          500: '#E5AF00',
          600: '#CC9900',
          700: '#B38F00',
          800: '#996600',
          900: '#664700',
          DEFAULT: "#FFC300",
          light: "#FFE199",
          dark: "#CC9900",
        },
        dark: {
          50: '#4B5563',
          100: '#374151',
          200: '#2D3748',
          300: '#1F2937',
          400: '#1A2332',
          500: '#1A1F2E',
          600: '#161B29',
          700: '#111827',
          800: '#0D1520',
          900: '#09101A',
          DEFAULT: "#1F2937",
          mid: "#374151",
        },
        neutral: {
          DEFAULT: "#FFFFFF",
          card: "#F3F4F6",
          placeholder: "#9CA3AF",
          text: "#374151",
        },
        success: "#059669",
        error: "#DC2626",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
