"use client";

import Link from "next/link";
import type { HomeTab } from "@/lib/matchTabs";

// Hinweis-Leiste unter der Begrüßung (Rene, 18.10.2026: Tippen/Live/Beendet).
// Ersetzt "X Spiele warten auf deinen Tipp" aus der Begrüßung:
// - offene Tipps: gold "Noch N offene Tipps" + nächster Tippschluss → Reiter Tippen
// - alles getippt: grün "Alles getippt" → Live (läuft etwas) bzw. Beendet
// - Gäste: freundlich "Zum Tippen einloggen"
export default function HomeTipBar({
  guest,
  toTip,
  next,
  running,
  onGo,
}: {
  guest: boolean;
  toTip: number;
  // Nächster Tippschluss eines noch nicht getippten Spiels.
  next: { time: string; home: string; away: string } | null;
  running: number;
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

  if (toTip > 0) {
    return (
      <button
        type="button"
        onClick={() => onGo("tippen")}
        className="mb-5 flex w-full items-center justify-between gap-3 rounded-card border border-gold/45 bg-gold/10 px-4 py-3 text-left transition-colors hover:bg-gold/15"
      >
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold text-ink">
            Noch <b className="text-gold">{toTip}</b> {toTip === 1 ? "offener Tipp" : "offene Tipps"}
          </span>
          {next && (
            <span className="block truncate text-xs text-muted">
              Nächster Tippschluss {next.time} · {next.home} – {next.away}
            </span>
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap font-display text-sm font-semibold text-gold">Jetzt tippen ›</span>
      </button>
    );
  }

  const target: HomeTab = running > 0 ? "live" : "beendet";
  return (
    <button
      type="button"
      onClick={() => onGo(target)}
      className="mb-5 flex w-full items-center justify-between gap-3 rounded-card border border-action/40 bg-action/10 px-4 py-3 text-left transition-colors hover:bg-action/15"
    >
      <span className="min-w-0">
        <span className="block font-display text-sm font-semibold text-action">✓ Alles getippt</span>
        <span className="block text-xs text-muted">
          {running > 0
            ? `Lehn dich zurück – ${running} ${running === 1 ? "Spiel läuft" : "Spiele laufen"} gerade`
            : "Gerade läuft nichts – hier sind die letzten Ergebnisse"}
        </span>
      </span>
      <span className="shrink-0 font-display text-sm font-semibold text-action">›</span>
    </button>
  );
}
