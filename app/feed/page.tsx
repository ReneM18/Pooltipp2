"use client";

import { useAppData, ActivityItem } from "@/lib/AppDataContext";

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
  const { activity } = useAppData();
  const groups = groupByDay(activity);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Aktivitäts-Feed</h1>
        <p className="mt-1 text-sm text-muted">
          Was in der Community gerade passiert – Tipps, Kommentare, Freundschaften und mehr.
        </p>
      </div>

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
