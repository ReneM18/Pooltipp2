"use client";

import Link from "next/link";
import { useAppData, ActivityItem } from "@/lib/AppDataContext";
import { getCommunityTipsForMatch } from "@/lib/communityTips";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Heute";
  if (sameDay(date, yesterday)) return "Gestern";
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function groupByDay(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

// Formatiert eine Aktivitäts-Zeile so, dass eigene Aktionen ("Du hast...")
// optisch hervorgehoben werden.
function ActivityText({ text }: { text: string }) {
  if (text.startsWith("Du ")) {
    return (
      <p className="text-sm text-ink">
        <span className="font-semibold text-gold">Du</span>
        {text.slice(2)}
      </p>
    );
  }
  return <p className="text-sm text-ink">{text}</p>;
}

export default function FeedPage() {
  const { activity, matches, getTeam } = useAppData();
  const groups = groupByDay(activity);

  // Was die Community bei den nächsten Spielen tippt – macht andere User als
  // echte Inhalte im Feed sichtbar, nicht nur die eigene Aktivität.
  const upcomingMatches = [...matches]
    .filter((m) => m.status !== "finished")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, 3);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-5xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Feed</h1>

      {upcomingMatches.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 px-1 font-display text-xs font-bold uppercase tracking-wider text-muted">
            Was die Community tippt
          </h2>
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
            {upcomingMatches.flatMap((match) => {
              const home = getTeam(match.homeTeamId);
              const away = getTeam(match.awayTeamId);
              if (!home || !away) return [];
              return getCommunityTipsForMatch(match).map((tip, i) => (
                <div
                  key={`${match.id}-${i}`}
                  className="flex items-center gap-3 rounded-card border border-gold/20 bg-gold/5 px-4 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-xs font-semibold text-gold">
                    {tip.name.slice(0, 1).toUpperCase()}
                  </span>
                  <p className="text-sm text-ink">
                    <Link
                      href={`/spieler/${encodeURIComponent(tip.name)}`}
                      className="font-semibold text-gold hover:opacity-80"
                    >
                      {tip.name}
                    </Link>{" "}
                    tippt <span className="font-semibold">{tip.predictionLabel}</span> bei {home.name} vs{" "}
                    {away.name}
                  </p>
                </div>
              ));
            })}
          </div>
        </section>
      )}

      {activity.length === 0 && (
        <p className="rounded-card border border-dashed border-edge bg-surface p-8 text-center text-sm text-muted">
          Noch keine Aktivität – leg los und tipp dein erstes Spiel!
        </p>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2.5 px-1 font-display text-xs font-bold uppercase tracking-wider text-muted">
              {group.label}
            </h2>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => {
                const isMine = item.text.startsWith("Du ");
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 rounded-card border px-4 py-3.5 transition-colors ${
                      isMine
                        ? "border-gold/30 bg-gold/5 hover:bg-gold/10"
                        : "border-edge bg-surface hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                        isMine ? "bg-gold/15" : "bg-surface-hover"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <div className="flex-1 pt-0.5">
                      <ActivityText text={item.text} />
                      <p className="mt-0.5 text-xs text-muted">{timeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
