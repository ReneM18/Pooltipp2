"use client";

import { useState } from "react";
import { useUser } from "@/lib/UserContext";
import { NewsPoll, pollEnded, useNewsPoll } from "@/lib/newsPolls";

// Abstimmung im News-Fenster (Rene, 12.10.2026, Entwurf B "kompakt"):
// Antworten als Knöpfe; nach der eigenen Stimme ein farbiger Balken mit
// Prozenten. Ergebnisse erst nach der eigenen Stimme (oder wenn sie vorbei
// ist), damit sich niemand von der Mehrheit beeinflussen lässt.
const COLORS = ["#4FC181", "#E8B34C", "#6FA8DC", "#8B9890"];

export default function NewsPollView({ newsId, poll }: { newsId: string; poll: NewsPoll }) {
  const { authUserId, isRegistered } = useUser();
  const { counts, total, myVote, missing, vote } = useNewsPoll(newsId, authUserId ?? null);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ended = pollEnded(poll);
  const options = poll.options.slice(0, 4);
  const showResults = ended || (myVote !== null && !changing);
  const pct = (i: number) => (total > 0 ? Math.round(((counts[i] ?? 0) / total) * 100) : 0);
  const votesText = `${total.toLocaleString("de-DE")} ${total === 1 ? "Stimme" : "Stimmen"}`;

  async function pick(i: number) {
    if (busy || ended || !isRegistered) return;
    setBusy(true);
    setError(null);
    const err = await vote(i);
    setBusy(false);
    if (err) setError(err.includes("beendet") ? "Die Abstimmung ist schon beendet." : "Das hat nicht geklappt, bitte nochmal.");
    else setChanging(false);
  }

  return (
    <div className="mt-5 rounded-xl border border-gold/35 bg-gold/[0.05] p-3.5">
      <p className="mb-3 font-display text-sm font-semibold leading-snug text-ink">📊 {poll.question}</p>

      {missing ? (
        <p className="text-xs text-muted">Abstimmungen werden gerade freigeschaltet – bitte später nochmal schauen.</p>
      ) : showResults ? (
        <>
          <div className="flex h-8 w-full overflow-hidden rounded-full bg-pitch">
            {total === 0 ? (
              <div className="flex w-full items-center justify-center text-xs text-muted">Noch keine Stimmen</div>
            ) : (
              options.map((_, i) =>
                pct(i) > 0 ? (
                  <div
                    key={i}
                    className="flex items-center justify-center overflow-hidden text-xs font-bold text-pitch"
                    style={{ width: `${pct(i)}%`, background: COLORS[i] }}
                  >
                    {pct(i) >= 12 ? `${pct(i)} %` : ""}
                  </div>
                ) : null
              )
            )}
          </div>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {options.map((label, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
                <span className={`min-w-0 flex-1 ${myVote === i ? "font-semibold text-ink" : "text-muted"}`}>
                  {label}
                  {myVote === i && <span className="text-action"> ✓</span>}
                </span>
                <span className="shrink-0 font-semibold text-ink">{pct(i)} %</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted">
            {ended ? (
              <span>Abstimmung beendet</span>
            ) : (
              <button type="button" onClick={() => setChanging(true)} className="font-semibold text-gold hover:underline">
                Stimme ändern
              </button>
            )}
            <span>{votesText}</span>
          </div>
        </>
      ) : (
        <>
          {/* 2 und 4 Antworten: zwei Spalten, 3 Antworten: drei Spalten. Lange
              Antworten brechen im Knopf um statt abgeschnitten zu werden. */}
          <div className={`grid gap-2 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {options.map((label, i) => (
              <button
                key={i}
                type="button"
                disabled={busy || !isRegistered}
                onClick={() => pick(i)}
                className={`min-h-[42px] rounded-xl border px-2 py-2 text-center text-sm font-semibold leading-snug transition-colors disabled:opacity-60 ${
                  myVote === i ? "border-action bg-action/15 text-action" : "border-edge bg-pitch text-ink hover:border-gold/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              {!isRegistered
                ? "Zum Abstimmen bitte einloggen."
                : changing
                ? (
                  <button type="button" onClick={() => setChanging(false)} className="font-semibold hover:text-ink">
                    Abbrechen
                  </button>
                )
                : "Tippe eine Antwort an"}
            </span>
            <span>bisher {votesText}</span>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
