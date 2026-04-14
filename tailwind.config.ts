import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FFC300",
          light: "#FFE199",
          dark: "#CC9900",
        },
        dark: {
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