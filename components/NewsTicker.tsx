"use client";

import { useState } from "react";
import { useAppData, NewsItem } from "@/lib/AppDataContext";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

export default function NewsTicker() {
  const { newsItems } = useAppData();
  const [selected, setSelected] = useState<NewsItem | null>(null);

  if (newsItems.length === 0) {
    return (
      <div className="border-b border-edge bg-gold py-1.5 text-center font-display text-sm font-semibold text-pitch">
        Noch keine News – im Admin-Bereich könnt ihr welche anlegen.
      </div>
    );
  }

  // Jede Meldung wird zweimal gerendert (zweite Kopie unsichtbar für Screenreader/Tab),
  // damit das Laufband nahtlos loopt. Ein einheitliches gap sorgt für gleichmäßige
  // Abstände zwischen allen Meldungen – auch an der Nahtstelle der beiden Kopien.
  const doubled = [...newsItems, ...newsItems];

  return (
    <>
      <div className="overflow-hidden border-b border-edge bg-gold py-1.5">
        <div className="ticker-track flex items-center gap-10 px-5">
          {doubled.map((item, i) => {
            const isDuplicate = i >= newsItems.length;
            return (
              <button
                key={`${item.id}-${i}`}
                type="button"
                onClick={() => setSelected(item)}
                tabIndex={isDuplicate ? -1 : 0}
                aria-hidden={isDuplicate || undefined}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-display text-sm font-semibold text-pitch transition-opacity hover:opacity-70"
              >
                {item.sport && <span>{sportIcon[item.sport]}</span>}
                <span>{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-pitch/85 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto p-8">
              <div className="mb-4 flex items-center gap-3">
                {selected.sport && <span className="text-3xl">{sportIcon[selected.sport]}</span>}
                <h2 className="font-display text-2xl font-bold leading-snug text-ink">
                  {selected.text}
                </h2>
              </div>
              <p className="whitespace-pre-line text-base leading-relaxed text-muted">
                {selected.article ?? "Zu dieser Meldung gibt es noch keinen ausführlichen Artikel."}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-full shrink-0 bg-gold py-3.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
