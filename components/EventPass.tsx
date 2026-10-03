"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HALLOWEEN_2026 as EV } from "@/lib/events/halloween2026";

// ENTWURF: Fortschritt kommt in der Vorschau aus der Adresse (?tage=6&heute=2026-10-21).
function useDraft() {
  const [s, setS] = useState<{ days: number; today: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setS({ days: Number(q.get("tage") ?? 6), today: q.get("heute") ?? "2026-10-21" });
  }, []);
  return s;
}

function dayNum(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function Bats() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <span className="absolute right-3 top-2 text-lg opacity-30">🦇</span>
      <span className="absolute right-12 top-7 text-xs opacity-25">🦇</span>
      <span className="absolute -bottom-3 -right-2 text-5xl opacity-15">🎃</span>
    </div>
  );
}

export function EventPassCard() {
  const s = useDraft();
  if (!s || s.today < EV.startsOn || s.today > EV.endsOn) return null;
  const left = dayNum(EV.endsOn) - dayNum(s.today);
  const max = EV.levels[EV.levels.length - 1].days;
  const next = EV.levels.find((l) => l.days > s.days);
  const pct = Math.min(100, Math.round((s.days / max) * 100));
  return (
    <section
      className="relative mb-6 overflow-hidden rounded-card border p-4 sm:p-5"
      style={{
        borderColor: `${EV.colorFrom}66`,
        background: `linear-gradient(135deg, ${EV.colorTo}38, rgb(var(--c-surface)) 55%, ${EV.colorFrom}26)`,
      }}
    >
      <Bats />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: EV.colorFrom }}>
            {EV.icon} Event · nur kurz
          </p>
          <p className="text-xs text-muted">
            <span className="whitespace-nowrap">15.10.–2.11.2026</span>
            {" · "}
            <span className="whitespace-nowrap font-semibold text-ink">
              {left === 0 ? "Endet heute" : left === 1 ? "Endet morgen" : `Endet in ${left} Tagen`}
            </span>
          </p>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink">Halloween-Pass</h2>
        <p className="mt-1 text-sm text-muted">
          Dein täglicher Bonus zählt jetzt doppelt: für den Saison-Pass <span className="text-ink">und</span> für
          diesen Halloween-Pass. Nichts extra zu tun.
        </p>

        <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="whitespace-nowrap font-display text-sm font-bold text-ink">
            {s.days} von {max} Bonus-Tagen
          </span>
          {next && (
            <span className="text-xs text-muted">
              noch {next.days - s.days} {next.days - s.days === 1 ? "Tag" : "Tage"} bis Level {next.level}
            </span>
          )}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-pitch">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(4, pct)}%`, background: `linear-gradient(90deg, ${EV.colorTo}, ${EV.colorFrom})` }}
          />
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {EV.levels.map((l) => {
            const done = s.days >= l.days;
            return (
              <li
                key={l.level}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  done ? "bg-pitch/60" : "border-edge bg-pitch/40 opacity-60"
                }`}
                style={done ? { borderColor: `${EV.colorFrom}80` } : undefined}
              >
                <span
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: done ? `${EV.colorFrom}33` : "rgb(var(--c-pitch))" }}
                >
                  {done ? l.icon : "🔒"}
                  {done && l.accent && <span className="absolute -bottom-0.5 -right-0.5 text-xs">{l.accent}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="whitespace-nowrap font-display font-semibold text-ink">Level {l.level}</span>
                    {done && (
                      <span className="whitespace-nowrap text-xs font-semibold" style={{ color: EV.colorFrom }}>
                        ✓ Freigeschaltet
                      </span>
                    )}
                  </p>
                  <p className={`text-sm ${done ? "text-ink" : "text-muted"}`}>{l.reward}</p>
                  <p className="text-xs text-muted">{l.where}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-right text-xs text-muted">
                  {l.days === 1 ? "1 Tag" : `${l.days} Tage`}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Nach dem Event verschwindet dieser Pass. Sticker und Abzeichen behältst du für immer. Dein Saison-Pass läuft
          ganz normal weiter.
        </p>
      </div>
    </section>
  );
}

export function EventStrip() {
  const s = useDraft();
  if (!s || s.today < EV.startsOn || s.today > EV.endsOn) return null;
  const left = dayNum(EV.endsOn) - dayNum(s.today);
  const max = EV.levels[EV.levels.length - 1].days;
  return (
    <Link
      href="/fortschritt"
      className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-card border px-3 py-2.5 sm:px-4"
      style={{
        borderColor: `${EV.colorFrom}66`,
        background: `linear-gradient(90deg, ${EV.colorTo}40, rgb(var(--c-surface)) 70%)`,
      }}
    >
      <span className="text-2xl">🎃</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-ink">Halloween-Event läuft</p>
        <p className="text-xs text-muted">
          <span className="whitespace-nowrap">{s.days} von {max} Bonus-Tagen</span>
          {" · "}
          <span className="whitespace-nowrap">noch {left} Tage</span>
        </p>
      </div>
      <span
        className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-display text-xs font-semibold text-white"
        style={{ background: EV.colorFrom }}
      >
        Ansehen
      </span>
    </Link>
  );
}
