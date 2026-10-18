"use client";

import Link from "next/link";
import type { HomeTab } from "@/lib/matchTabs";

// Hinweis-Leiste unter der Begrüßung (Rene, 18.10.2026: Tippen/Live/Beendet).
// Ersetzt "X Spiele warten auf deinen Tipp" aus der Begrüßung:
// - Gäste: freundlich "Zum Tippen einloggen"
// - eingeloggt (Rene, 18.10.2026): schmale Zeile über den Reitern, nur auf
//   Live/Beendet bei offenen Tipps → Reiter Tippen
export default function HomeTipBar({
  guest,
  toTip,
  next,
  tab,
  onGo,
}: {
  guest: boolean;
  toTip: number;
  // Nächster Tippschluss eines noch nicht getippten Spiels ("12:30", "Sa. 15:30").
  next: string | null;
  tab: HomeTab;
  onGo: (tab: HomeTab) => void;
}) {
  if (guest) {
    return (
      <Link
        href="/registrieren"
        className="mb-5 flex items-center justify-between gap-3 rounded-card border border-gold/40 bg-gold/10 px-4 py-3 transition-colors hover:bg-gold/15"
      >
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold text-ink">Zum Tippen einloggen</span>
          <span className="block text-xs text-muted">Kostenlos mittippen, Punkte sammeln, Freunde schlagen.</span>
        </span>
        <span className="shrink-0 font-display text-sm font-semibold text-gold">Los ›</span>
      </Link>
    );
  }

  // Eingeloggt: nur auf den Reitern Live/Beendet und nur bei offenen Tipps –
  // auf Tippen stehen Zahl und Tippschluss schon im Reiter und in der
  // Überschrift, "Alles getippt" zeigt dort der Leerzustand (Rene, 18.10.2026).
  if (tab === "tippen" || toTip === 0) return null;
  return (
    <button
      type="button"
      onClick={() => onGo("tippen")}
      className="mb-3 flex w-full items-center gap-1 rounded-md bg-gold/10 px-3 py-1.5 text-left text-xs font-semibold text-gold transition-colors hover:bg-gold/15"
    >
      <span className="min-w-0 truncate">
        Noch {toTip} {toTip === 1 ? "offener Tipp" : "offene Tipps"}
        {next && <> · nächster Tippschluss {next}</>}
      </span>
      <span aria-hidden className="shrink-0">›</span>
    </button>
  );
}
