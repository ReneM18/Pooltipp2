"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface WeekRow {
  woche: string; // Montag der Woche, "2026-10-13"
  aktiv: number;
  neu: number;
  ueber_runde: number;
  wieder: number | null; // null = laufende Woche
}

// Admin-Reiter "Wachstum" (Rene, 14.10.2026): aktive Tipper, Neuanmeldungen,
// Beitritte über Tipprunden und Wiederkehrer pro Woche, damit man sieht, ob
// PoolTipp wächst. Zahlen aus supabase/wachstum.sql (admin_wachstum), der
// Admin selbst zählt nicht mit. Oben vier Zahlen mit Vergleich zur Vorwoche,
// darunter Balken der letzten 8 Wochen und die Wochen-Tabelle.
export function GrowthReport() {
  const [rows, setRows] = useState<WeekRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("admin_wachstum", { p_wochen: 8 });
    setLoading(false);
    if (rpcError) {
      setError(
        /admin_wachstum/.test(rpcError.message)
          ? "Noch nicht eingerichtet: zuerst supabase/wachstum.sql ausführen."
          : "Zahlen konnten nicht geladen werden."
      );
      return;
    }
    setRows((data as WeekRow[] | null) ?? []);
    setPicked(null);
  }

  useEffect(() => {
    void load();
  }, []);

  const current = rows?.[rows.length - 1];
  const previous = rows?.[rows.length - 2];
  const maxActive = Math.max(1, ...(rows ?? []).map((r) => r.aktiv));
  const shown = picked !== null && rows ? rows[picked] : current;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink">📈 Wachstum</h2>
          <p className="text-sm text-muted">
            Wochen von Montag bis Sonntag. Aktiv heißt mindestens ein Tipp in der Woche. Du selbst zählst nicht mit.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 self-start rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-wait sm:self-auto"
        >
          {loading ? "Wird geladen…" : "Aktualisieren"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!rows && !error && <p className="text-sm text-muted">Zahlen werden geladen…</p>}

      {current && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Tile label="Aktive Tipper" value={current.aktiv} delta={previous ? current.aktiv - previous.aktiv : null} />
          <Tile label="Neu angemeldet" value={current.neu} delta={previous ? current.neu - previous.neu : null} />
          <Tile
            label="Über Tipprunde"
            value={current.ueber_runde}
            suffix={`von ${current.neu}`}
            note={current.neu ? `${percent(current.ueber_runde, current.neu)} % der Neuen` : "noch keine Neuen"}
          />
          {/* Die laufende Woche hat noch keine Folgewoche, darum die Vorwoche. */}
          <Tile
            label="Kommen wieder"
            value={previous && previous.neu ? `${percent(previous.wieder ?? 0, previous.neu)} %` : "–"}
            note={previous && previous.neu ? `${previous.wieder ?? 0} von ${previous.neu} aus der Vorwoche` : "keine Neuen in der Vorwoche"}
          />
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-card border border-edge bg-surface px-4 py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-display text-base font-semibold text-ink">Aktive Tipper pro Woche</p>
            {shown && (
              <p className="text-sm text-muted">
                Woche ab {formatWeek(shown.woche)}: <b className="text-ink">{shown.aktiv}</b> aktiv · {shown.neu} neu
              </p>
            )}
          </div>
          {/* Balken zum Antippen: zeigt die Werte der Woche oben rechts. */}
          <div className="flex h-40 items-end gap-1.5 border-b border-edge sm:gap-3">
            {rows.map((r, i) => {
              const isCurrent = i === rows.length - 1;
              const isPicked = picked === i;
              return (
                <button
                  key={r.woche}
                  onClick={() => setPicked(isPicked ? null : i)}
                  aria-label={`Woche ab ${formatWeek(r.woche)}: ${r.aktiv} aktiv, ${r.neu} neu`}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className={`text-xs font-semibold tabular-nums ${isCurrent || isPicked ? "text-ink" : "text-muted"}`}>
                    {r.aktiv}
                  </span>
                  <span
                    className={`w-full max-w-[2.5rem] rounded-t transition-opacity ${
                      isCurrent || isPicked ? "bg-gold" : "bg-gold/50 group-hover:bg-gold/75"
                    }`}
                    style={{ height: `${(r.aktiv / maxActive) * 100}%`, minHeight: r.aktiv ? 4 : 0 }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5 sm:gap-3">
            {rows.map((r) => (
              <span key={r.woche} className="min-w-0 flex-1 text-center text-[11px] tabular-nums text-muted">
                {formatWeek(r.woche)}
              </span>
            ))}
          </div>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-card border border-edge bg-surface px-4 py-4">
          <p className="mb-2 font-display text-base font-semibold text-ink">Woche für Woche</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-edge text-xs text-muted">
                  <th className="py-2 pr-2 text-left font-semibold">Woche ab</th>
                  <th className="px-2 py-2 text-right font-semibold">Aktiv</th>
                  <th className="px-2 py-2 text-right font-semibold">Neu</th>
                  <th className="px-2 py-2 text-right font-semibold">Tipprunde</th>
                  <th className="py-2 pl-2 text-right font-semibold">Wieder da</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.woche} className="border-b border-edge last:border-b-0">
                    <td className="py-2 pr-2 text-left text-ink">{formatWeek(r.woche)}</td>
                    <td className="px-2 py-2 text-right text-ink">{r.aktiv}</td>
                    <td className="px-2 py-2 text-right text-ink">{r.neu}</td>
                    <td className="px-2 py-2 text-right text-ink">{r.ueber_runde}</td>
                    <td className="py-2 pl-2 text-right">
                      <ReturnCell wieder={r.wieder} neu={r.neu} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            „Tipprunde“: am Tag der Anmeldung einer Tipprunde beigetreten, also sehr wahrscheinlich über einen
            Einladungslink. „Wieder da“: hat in der Woche nach der Anmeldung getippt. Grün ab 60 %, gelb ab 35 %,
            darunter rot.
          </p>
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  suffix,
  delta,
  note,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  delta?: number | null;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-edge bg-surface px-3 py-2.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums text-ink">
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-muted">{suffix}</span>}
      </span>
      {delta !== undefined && delta !== null && (
        <span className={`text-xs font-semibold ${delta > 0 ? "text-action" : delta < 0 ? "text-red-400" : "text-muted"}`}>
          {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "gleich wie"} {delta === 0 ? "Vorwoche" : "zur Vorwoche"}
        </span>
      )}
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function ReturnCell({ wieder, neu }: { wieder: number | null; neu: number }) {
  if (wieder === null) return <span className="text-xs text-muted">läuft noch</span>;
  if (!neu) return <span className="text-muted">–</span>;
  const p = percent(wieder, neu);
  const tone = p >= 60 ? "bg-action/20 text-ink" : p >= 35 ? "bg-gold/20 text-ink" : "bg-red-400/20 text-ink";
  return (
    <span className={`inline-block min-w-[3.5rem] rounded-md px-1.5 py-0.5 text-center font-semibold ${tone}`}>
      {wieder}/{neu}
    </span>
  );
}

function percent(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

// "2026-10-13" -> "13.10."
function formatWeek(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}
