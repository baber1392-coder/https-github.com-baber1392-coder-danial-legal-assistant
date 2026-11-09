import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172334",
        navy: "#10243A",
        gold: "#C5A46D",
        paper: "#F5F6F8",
        muted: "#718096"
      },
      fontFamily: { sans: ["Tahoma", "Arial", "sans-serif"] }
    }
  },
  plugins: []
};
export default config;