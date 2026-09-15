"use client";

import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { PASS_LEVELS } from "@/lib/passLevels";
import { SPORTS } from "@/lib/types";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
};

export default function FortschrittPage() {
  const { points } = useUser();
  const { tipsBySport } = useAppData();

  const currentLevel = [...PASS_LEVELS].reverse().find((l) => points >= l.xpRequired) ?? PASS_LEVELS[0];
  const nextLevel = PASS_LEVELS.find((l) => l.xpRequired > points);
  const progressToNext = nextLevel
    ? Math.round(((points - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100)
    : 100;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Dein Fortschritt</h1>
        <p className="mt-1 text-sm text-muted">
          Sammle Punkte durch Tippen und schalte nach und nach neue Belohnungen frei.
        </p>
      </div>

      {/* Season-Pass Fortschrittsbalken */}
      <section className="mb-8 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-ink">
            Level {currentLevel.level} <span className="text-gold">{currentLevel.icon}</span>
          </span>
          <span className="text-sm text-muted">
            {points.toLocaleString("de-DE")} Punkte
            {nextLevel && ` · noch ${(nextLevel.xpRequired - points).toLocaleString("de-DE")} bis Level ${nextLevel.level}`}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-pitch">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-action transition-all"
            style={{ width: `${Math.max(4, progressToNext)}%` }}
          />
        </div>
      </section>

      {/* Pass-Track */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Season-Pass</h2>
        <div className="flex flex-col gap-3">
          {PASS_LEVELS.map((lvl) => {
            const unlocked = points >= lvl.xpRequired;
            const isCurrent = lvl.level === currentLevel.level;
            return (
              <div
                key={lvl.level}
                className={`flex items-center gap-4 rounded-card border p-4 transition-colors ${
                  isCurrent
                    ? "border-gold bg-surface-hover"
                    : unlocked
                    ? "border-edge bg-surface"
                    : "border-edge bg-surface opacity-50"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${
                    unlocked ? "bg-gold/20" : "bg-pitch"
                  }`}
                >
                  {unlocked ? lvl.icon : "🔒"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-ink">
                      Level {lvl.level}
                    </span>
                    {unlocked && <span className="text-xs font-semibold text-action">✓ Freigeschaltet</span>}
                  </div>
                  <p className="text-sm text-muted">{lvl.reward}</p>
                </div>
                <span className="text-xs text-muted">{lvl.xpRequired.toLocaleString("de-DE")} P</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sportarten-Aufschlüsselung */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Tipps nach Sportart</h2>
        <div className="grid grid-cols-3 gap-3">
          {SPORTS.map((sport) => (
            <div key={sport} className="rounded-card border border-edge bg-surface p-4 text-center">
              <div className="mb-1 text-2xl">{sportIcon[sport]}</div>
              <p className="font-display text-xl font-bold text-ink">{tipsBySport[sport] ?? 0}</p>
              <p className="text-xs text-muted">{sport}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
