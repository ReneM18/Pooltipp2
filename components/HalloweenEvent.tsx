"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/UserContext";
import { HALLOWEEN_2026, eventPhase, passClaimKey } from "@/lib/seasons";
import type { EventPhase } from "@/lib/seasons";
import { useEventStatus } from "@/lib/eventProgress";
import { EmoteSticker } from "@/components/Emotes";

// Abschnitt "Halloween-Extras" auf der Seite Fortschritt, unter dem Saison-Pass
// (Rene, 12.10.2026; seit 27.10.2026 kein eigener Reiter mehr).
// Kürbisse: supabase/halloween-event.sql, je Kürbis +50 Pass-XP:
// supabase/halloween-kuerbis-xp.sql. Stufen: lib/seasons/halloween2026.ts.
const EVENT = HALLOWEEN_2026;

/** Phase heute (erst im Browser, damit sie nicht vom Bau-Tag stammt). */
export function useHalloweenPhase(): EventPhase | null {
  const [phase, setPhase] = useState<EventPhase | null>(null);
  useEffect(() => {
    setPhase(eventPhase(EVENT, new Date()));
  }, []);
  return phase;
}

function endText(): string {
  const [, m, d] = EVENT.endsOn.split("-").map(Number);
  return `${d}.${m}.`;
}

function daysLeft(): number {
  const [y, m, d] = EVENT.endsOn.split("-").map(Number);
  const end = Date.UTC(y, m - 1, d);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" }).split("-").map(Number);
  return Math.round((end - Date.UTC(today[0], today[1] - 1, today[2])) / 86_400_000);
}

export default function HalloweenEvent({ phase }: { phase: EventPhase }) {
  const { authUserId, isRegistered, passClaims } = useUser();
  const { status, missing } = useEventStatus(EVENT, authUserId ?? null);
  const points = status?.points ?? 0;
  const levels = EVENT.levels;
  const reached = (level: number) => passClaims.includes(passClaimKey(EVENT.theme.id, level));
  const next = levels.find((l) => !reached(l.level) && l.xpRequired > points) ?? null;
  const prev = [...levels].reverse().find((l) => l.xpRequired <= points);
  const from = prev?.xpRequired ?? 0;
  const progress = next ? Math.round(((points - from) / Math.max(1, next.xpRequired - from)) * 100) : 100;
  const left = phase === "laeuft" ? daysLeft() : 0;

  return (
    <section id="halloween" className="mb-8 scroll-mt-20">
      <div
        className="relative mb-4 overflow-hidden rounded-card p-5 sm:p-6"
        style={{ background: `linear-gradient(135deg, ${EVENT.design!.heroFrom}, ${EVENT.design!.heroTo})` }}
      >
        <span className="pointer-events-none absolute right-4 top-3 text-2xl opacity-60" aria-hidden>
          🦇
        </span>
        <span className="pointer-events-none absolute right-14 top-9 text-base opacity-50" aria-hidden>
          🦇
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FFB347]">
          {EVENT.theme.icon} Bis {endText()}
          {phase === "laeuft" && (
            <span className="text-[#D9CBE6]">
              {" · "}
              {left <= 0 ? "letzter Tag" : left === 1 ? "noch 1 Tag" : `noch ${left} Tage`}
            </span>
          )}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-white">Halloween-Extras</h2>
        <p className="mt-1 max-w-xl text-sm text-[#D9CBE6]">
          Jeder Kürbis gibt +50 Pass-XP für deinen Saison-Pass und bringt dich den gruseligen Extras näher. Nur
          Optik und Ehre, keine Coins.
        </p>

        {phase === "vorher" && (
          <p className="mt-3 inline-block rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white">
            👀 Vorschau für den Admin – startet am 15.10. von selbst
          </p>
        )}
        {phase === "beendet" && (
          <p className="mt-3 inline-block rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white">
            Event beendet – deine Belohnungen behältst du
          </p>
        )}

        {isRegistered && phase !== "vorher" && (
          <div className="mt-4">
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/35">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF8A2B] to-[#FFB347] transition-all"
                style={{ width: `${Math.max(3, progress)}%` }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-[#D9CBE6]">
              <span className="font-semibold text-white">
                {points} {EVENT.pointIcon} gesammelt
              </span>
              {next ? (
                <span>
                  Nächste Stufe bei {next.xpRequired} {EVENT.pointIcon}
                </span>
              ) : (
                <span>Alle Stufen geschafft! 🎉</span>
              )}
            </div>
          </div>
        )}
      </div>

      {missing && (
        <p className="mb-4 rounded-card border border-edge bg-surface p-4 text-sm text-muted">
          Das Event wird gerade freigeschaltet – bitte später nochmal schauen.
        </p>
      )}

      <div className="mb-4 rounded-card border border-edge bg-surface p-4">
        <p className="font-display text-sm font-semibold text-ink">So sammelst du Kürbisse</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span aria-hidden>🎃</span>
            <span className="flex-1">+1 (und +50 Pass-XP) an jedem Tag, an dem du in die App kommst</span>
            {phase === "laeuft" && status?.loginToday && <span className="shrink-0 text-action">✓ heute</span>}
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden>🎃</span>
            <span className="flex-1">+1 (und +50 Pass-XP) an jedem Tag, an dem du mindestens einen Tipp abgibst</span>
            {phase === "laeuft" && status?.tippToday && <span className="shrink-0 text-action">✓ heute</span>}
          </li>
        </ul>
        {!isRegistered && <p className="mt-2 text-xs text-muted">Zum Mitmachen bitte einloggen.</p>}
      </div>

      <h3 className="mb-3 font-display text-base font-semibold text-ink">Halloween-Belohnungen (nach Kürbissen)</h3>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {levels.map((l) => {
          const ok = reached(l.level);
          return (
            <div
              key={l.level}
              className={`flex items-center gap-3 rounded-card border p-3 ${
                ok ? "border-[#FF8A2B]/60 bg-[#FF8A2B]/[0.07]" : "border-edge bg-surface"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${
                  ok ? "bg-[#FF8A2B]/20" : "bg-surface-hover"
                }`}
                aria-hidden
              >
                {l.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-ink">{l.reward}</p>
                <p className="text-xs text-muted">{l.rewardWhere}</p>
                {l.kind === "emotes" && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {EVENT.emotes.map((e) => (
                      <span key={e.id} className={ok ? "" : "opacity-40 grayscale"}>
                        <EmoteSticker emote={e} size={28} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span
                className={`shrink-0 whitespace-nowrap text-xs font-semibold ${ok ? "text-[#FF8A2B]" : "text-muted"}`}
              >
                {ok ? "✓ " : ""}
                {l.xpRequired} {EVENT.pointIcon}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">
        Höchstens 2 Kürbisse pro Tag. Alle Stufen schaffst du mit etwa 15 Tagen, an denen du reinschaust und
        tippst. Sticker, Rahmen, Titel und Abzeichen behältst du nach dem Event, nur das Halloween-Design endet am
        1.11.
      </p>
    </section>
  );
}
