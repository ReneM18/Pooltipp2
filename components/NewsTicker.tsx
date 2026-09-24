"use client";

import { useAppData } from "@/lib/AppDataContext";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

export default function NewsTicker() {
  const { newsItems } = useAppData();

  const headlines =
    newsItems.length > 0
      ? newsItems.map((n) => (n.sport ? `${sportIcon[n.sport] ?? ""} ${n.text}` : n.text))
      : ["Noch keine News – im Admin-Bereich könnt ihr welche anlegen."];

  const content = headlines.join("        •        ");

  return (
    <div className="overflow-hidden border-b border-edge bg-gold py-1.5">
      <div className="ticker-track flex whitespace-nowrap font-display text-sm font-semibold text-pitch">
        <span className="px-8">{content}</span>
        <span className="px-8" aria-hidden="true">
          {content}
        </span>
      </div>
    </div>
  );
}
