import type { Config } from "tailwindcss";

// Design tokens for PoolTipp — a dark, "stadium at night" base with a
// warm gold accent for the "Sterne" currency and a muted grass-green
// accent reserved for actions and live states.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#0D1512", // page background — pitch at night
        surface: "#172420", // card background
        "surface-hover": "#1E2F29",
        edge: "#24332C", // hairline borders
        gold: "#E8B34C", // Sterne / currency accent
        "gold-dim": "#4A3D22", // gold used at low opacity (track backgrounds)
        action: "#3FA66B", // primary buttons / confirmations
        "action-hover": "#4FC181",
        ink: "#F3F1EA", // primary text
        muted: "#8B9890", // secondary text
      },
      fontFamily: {
        display: ["var(--font-rajdhani)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
