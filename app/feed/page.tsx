"use client";

import { useAppData } from "@/lib/AppDataContext";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function FeedPage() {
  const { activity } = useAppData();

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Aktivitäts-Feed</h1>
        <p className="mt-1 text-sm text-muted">
          Was in der Community gerade passiert – Tipps, Kommentare und mehr.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {activity.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Aktivität.</p>
        )}
        {activity.map((item, index) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 px-5 py-4 ${
              index !== activity.length - 1 ? "border-b border-edge" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-lg">
              {item.icon}
            </span>
            <div className="flex-1">
              <p className="text-sm text-ink">{item.text}</p>
              <p className="mt-0.5 text-xs text-muted">{timeAgo(item.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
