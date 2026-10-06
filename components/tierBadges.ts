import type { TipResultTier } from "@/lib/poolScore";

// Liegt bei den Komponenten, weil Tailwind nur app/ und components/ nach
// Klassen durchsucht (tailwind.config.ts) – in lib/ fehlten die Farben.

// Farben der Tipp-Ergebnisse (Tipp-Historie, Wochenrückblick). Feste Farben
// (nicht die Saison-Farben), damit Exakt immer grün und Falsch immer rot
// ist, auch im Saison-Design.
export const TIER_BADGE: Record<TipResultTier, { text: string; className: string }> = {
  exakt: { text: "Exakt", className: "border-emerald-500/60 bg-emerald-500/15 text-emerald-400" },
  differenz: { text: "Tordifferenz", className: "border-yellow-400/60 bg-yellow-400/15 text-yellow-300" },
  tendenz: { text: "Tendenz", className: "border-orange-500/60 bg-orange-500/15 text-orange-400" },
  falsch: { text: "Falsch", className: "border-red-500/60 bg-red-500/15 text-red-400" },
};
