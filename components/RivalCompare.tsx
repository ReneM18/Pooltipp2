"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RivalCompare as Compare, RivalSearchHit, compareRival, searchRivals } from "@/lib/rivals";
import { SPORT_ICONS } from "@/lib/types";

// Rivalen-Vergleich im Profil (Rene, 12.10.2026): Spieler nach Name oder
// #Nummer suchen, dann beide Statistiken nebeneinander. Wer seine Statistik
// nicht freigibt, ist mit 🔒 markiert. Der bessere Wert je Zeile ist grün.
export default function RivalCompareButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 whitespace-nowrap rounded-full border border-gold/50 px-3 py-1 text-xs font-bold text-gold transition-colors hover:bg-gold/10"
      >
        ⚔️ Mit Rivalen vergleichen
      </button>
      {open && typeof document !== "undefined" && createPortal(<RivalDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function RivalDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RivalSearchHit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<RivalSearchHit | null>(null);
  const [result, setResult] = useState<Compare | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  // Suche mit kurzer Pause nach dem Tippen.
  useEffect(() => {
    const q = query.trim();
    if (picked || q.length < 1 || (q.replace("#", "").match(/^\d+$/) === null && q.length < 2)) {
      setHits(null);
      return;
    }
    const id = ++seq.current;
    const timer = window.setTimeout(async () => {
      const found = await searchRivals(q);
      if (id !== seq.current) return;
      setFailed(found === null);
      setHits(found ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, picked]);

  async function pick(hit: RivalSearchHit) {
    setPicked(hit);
    setResult(null);
    if (!hit.visible) return;
    setLoading(true);
    const data = await compareRival(hit.id);
    setLoading(false);
    if (data) setResult(data);
    else setFailed(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-pitch/85 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-card border border-edge bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">⚔️ Rivalen-Vergleich</h2>

          {!picked ? (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name oder #Nummer …"
                className="mb-3 w-full rounded-lg border border-edge bg-pitch px-3 py-2.5 text-base text-ink outline-none focus:border-gold"
              />
              {failed && (
                <p className="text-sm text-muted">Der Vergleich ist noch nicht eingerichtet (SQL fehlt) oder gerade nicht erreichbar.</p>
              )}
              {hits && hits.length === 0 && !failed && <p className="text-sm text-muted">Niemand gefunden.</p>}
              <div className="flex flex-col">
                {(hits ?? []).map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => pick(hit)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pitch text-xs font-semibold text-muted">
                      {hit.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-ink">{hit.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {hit.number ? `#${hit.number}` : ""}
                      {hit.isFriend ? " · Freund" : ""}
                      {!hit.visible ? " · 🔒 Statistik privat" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setResult(null);
                }}
                className="mb-3 text-sm text-muted hover:text-ink"
              >
                ← Andere Person suchen
              </button>
              {!picked.visible ? (
                <p className="rounded-lg border border-edge bg-pitch px-4 py-5 text-center text-sm text-muted">
                  🔒 {picked.name} zeigt seine Statistik nicht.
                </p>
              ) : loading || !result ? (
                <p className="text-sm text-muted">{failed ? "Vergleich konnte nicht geladen werden." : "Wird geladen…"}</p>
              ) : (
                <CompareTable data={result} />
              )}
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full shrink-0 bg-action py-3 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}

const pct = (part?: number, total?: number) => (total ? Math.round(((part ?? 0) * 100) / total) : null);

function CompareTable({ data }: { data: Compare }) {
  const { me, other, h2h } = data;
  // higher = besser; null = nicht vergleichbar
  const rows: { label: string; hint?: string; a: number | null; b: number | null; show: (n: number | null) => string }[] = [
    { label: "Rangpunkte", a: me.rang ?? 0, b: other.rang ?? 0, show: (n) => (n ?? 0).toLocaleString("de-DE") },
    { label: "Abgegebene Tipps", a: me.tips ?? 0, b: other.tips ?? 0, show: (n) => (n ?? 0).toLocaleString("de-DE") },
    {
      label: "Exakt getroffen",
      a: pct(me.exakt, me.evaluated),
      b: pct(other.exakt, other.evaluated),
      show: (n) => (n === null ? "–" : `${n} %`),
    },
    {
      label: "Tendenz richtig",
      a: pct(me.richtig, me.evaluated),
      b: pct(other.richtig, other.evaluated),
      show: (n) => (n === null ? "–" : `${n} %`),
    },
    { label: "Tipp-Serie", a: me.streak ?? 0, b: other.streak ?? 0, show: (n) => `🔥 ${n ?? 0}` },
  ];
  const cell = (mine: number | null, theirs: number | null) =>
    mine !== null && theirs !== null && mine > theirs ? "text-[#4FC181]" : "text-ink";
  const sportIcon = (s?: string | null) => (s && (SPORT_ICONS as Record<string, string>)[s]) || "–";

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th />
          <th className="w-20 pb-2 text-center font-display font-bold text-ink [overflow-wrap:anywhere]">{me.name}</th>
          <th className="w-20 pb-2 text-center font-display font-bold text-ink [overflow-wrap:anywhere]">{other.name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-edge">
            <td className="py-2 pr-2 text-muted">{r.label}</td>
            <td className={`py-2 text-center font-bold ${cell(r.a, r.b)}`}>{r.show(r.a)}</td>
            <td className={`py-2 text-center font-bold ${cell(r.b, r.a)}`}>{r.show(r.b)}</td>
          </tr>
        ))}
        <tr className="border-t border-edge">
          <td className="py-2 pr-2 text-muted">Beste Sportart</td>
          <td className="py-2 text-center">{sportIcon(me.bestSport)}</td>
          <td className="py-2 text-center">{sportIcon(other.bestSport)}</td>
        </tr>
        <tr className="border-t border-edge">
          <td className="py-2 pr-2">
            <span className="font-semibold text-ink">Direkt gegeneinander</span>
            <span className="block text-xs text-muted">
              {h2h && h2h.games > 0 ? `${h2h.games} gleiche Spiele – wer war besser` : "noch keine gemeinsamen Spiele"}
            </span>
          </td>
          <td className={`py-2 text-center font-bold ${cell(h2h?.me ?? null, h2h?.other ?? null)}`}>{h2h?.games ? h2h.me : "–"}</td>
          <td className={`py-2 text-center font-bold ${cell(h2h?.other ?? null, h2h?.me ?? null)}`}>
            {h2h?.games ? h2h.other : "–"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
