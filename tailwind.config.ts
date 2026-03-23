import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#111827",
        accent: "#10b981",
        accentSoft: "#064e3b"
      },
      boxShadow: {
        soft: "0 20px 50px rgba(0,0,0,.25)"
      }
    }
  },
  plugins: []
};

export default config;
