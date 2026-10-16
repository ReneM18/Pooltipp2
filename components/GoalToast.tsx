"use client";

import { useEffect, useState } from "react";

// Tor-Moment (Rene, 15.10.2026: Spieltag-Umbau): Fällt in einem Spiel, auf
// das der Spieler getippt hat, ein Tor, erscheint unten mittig ein dunkler
// Hinweis mit Gold-Rand: "⚽ TOR für Milan · 0:3" und klein darunter
// Torschütze, ob der Tipp gerade richtig liegt und der vorläufige Platz.
// Ausgelöst von der Tippkarte (components/MatchCard.tsx), angezeigt vom
// GoalToastHost in components/AppChrome.tsx – so steht jedes Tor nur
// einmal da, auch wenn dasselbe Spiel auf mehreren Karten zu sehen ist.

export interface GoalToastData {
  title: string;
  detail: string;
  // Zusatzzeile "Du bist jetzt 2. von 12 ▲1 unter deinen Freunden"
  // (Rene, 16.10.2026: Freunde-Live), extraGood = aufgestiegen (Gold).
  extra?: string;
  extraGood?: boolean;
}

interface Item extends GoalToastData {
  id: number;
  key: string;
}

const SHOW_MS = 6500;
const listeners = new Set<(items: Item[]) => void>();
let items: Item[] = [];
let nextId = 1;
// Schon gezeigte Tore (Spiel + Stand), damit jedes Tor nur einmal kommt.
const shown = new Set<string>();

function publish() {
  listeners.forEach((l) => l(items));
}

export function showGoalToast(key: string, data: GoalToastData) {
  if (shown.has(key)) return;
  shown.add(key);
  const item: Item = { ...data, key, id: nextId++ };
  items = [...items.slice(-1), item];
  publish();
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    publish();
  }, SHOW_MS);
}

export function GoalToastHost() {
  const [list, setList] = useState<Item[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  if (list.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+var(--safe-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      aria-live="polite"
    >
      {list.map((item) => (
        <div
          key={item.id}
          role="status"
          className="pointer-events-auto w-full max-w-sm animate-toast-in rounded-xl border border-gold/70 bg-pitch/95 px-4 py-2.5 text-center shadow-[0_8px_30px_rgb(0_0_0/0.45)] backdrop-blur"
        >
          <p className="font-display text-[15px] font-bold text-ink">{item.title}</p>
          {item.detail && <p className="mt-0.5 text-xs leading-snug text-muted">{item.detail}</p>}
          {item.extra && (
            <p className={`mt-0.5 text-xs font-semibold leading-snug ${item.extraGood ? "text-gold" : "text-ink"}`}>{item.extra}</p>
          )}
        </div>
      ))}
    </div>
  );
}
