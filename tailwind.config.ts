import type { Config } from "tailwindcss";

// Design tokens for PoolTipp — a dark, "stadium at night" base with a
// warm gold accent for the "Sterne" currency and a muted grass-green
// accent reserved for actions and live states.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Die Werte stehen als CSS-Variablen in app/globals.css (:root), damit
      // das Saison-Design (lib/seasonDesign.ts) sie pro Saison austauschen kann.
      colors: {
        pitch: "rgb(var(--c-pitch) / <alpha-value>)", // page background — pitch at night
        surface: "rgb(var(--c-surface) / <alpha-value>)", // card background
        "surface-hover": "rgb(var(--c-surface-hover) / <alpha-value>)",
        edge: "rgb(var(--c-edge) / <alpha-value>)", // hairline borders
        gold: "rgb(var(--c-gold) / <alpha-value>)", // Sterne / currency accent
        "gold-dim": "rgb(var(--c-gold-dim) / <alpha-value>)", // gold used at low opacity (track backgrounds)
        action: "rgb(var(--c-action) / <alpha-value>)", // primary buttons / confirmations
        "action-hover": "rgb(var(--c-action-hover) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)", // primary text
        muted: "rgb(var(--c-muted) / <alpha-value>)", // secondary text
        ticker: "rgb(var(--c-ticker) / <alpha-value>)", // news strip under the header
      },
      fontFamily: {
        // "display" ist die Haupt-Schrift für Überschriften/Buttons/Menü in
        // der ganzen App. "logo" ist bewusst separat und wird nur für den
        // "PoolTipp"-Schriftzug in der Navbar verwendet, der unverändert
        // bleiben soll.
        display: ["var(--font-poppins)", "sans-serif"],
        logo: ["var(--font-rajdhani)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        eliteGlow: {
          "0%, 100%": { boxShadow: "0 0 3px 0.5px rgba(182,148,246,0.35)" },
          "50%": { boxShadow: "0 0 7px 1.5px rgba(255,215,0,0.45)" },
        },
      },
      animation: {
        // Sanftes Leuchten für das Elite-Rang-Icon (Sport-Allrounder), damit
        // es auf einen Blick als etwas Besonderes erkennbar ist.
        "elite-glow": "eliteGlow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
