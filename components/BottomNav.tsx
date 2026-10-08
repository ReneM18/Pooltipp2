"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDuels } from "@/lib/DuelsContext";
import { TIPPRUNDEN_ENABLED } from "@/lib/types";

// Feste Leiste unten am Handy/Tablet (bis lg:), wie in Sport-Apps üblich.
// Die vier wichtigsten Seiten haben einen eigenen Knopf, alles Weitere
// steckt hinter "Mehr" (Fenster von unten). Ab lg: übernimmt die
// Menüleiste oben (NavTabs) – dort ist genug Platz für alles.

type Item = { href: string; label: string; icon: React.ReactNode };

const MAIN: Item[] = [
  {
    href: "/",
    label: "Tipps",
    icon: <path d="M4 5h16v14H4z M4 9h16 M9 13.5l2 2 4-4" />,
  },
  {
    href: "/matchcenter",
    label: "Center",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8.5l3 2.2-1.1 3.6h-3.8L9 10.7z" />
      </>
    ),
  },
  {
    href: "/rangliste",
    label: "Rangliste",
    icon: <path d="M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4" />,
  },
  {
    href: "/fortschritt",
    label: "Pass",
    icon: <path d="M4 7h16v10H4z M8 7v10 M14 10l.9 1.8 2 .3-1.45 1.4.35 2-1.8-1-1.8 1 .35-2-1.45-1.4 2-.3z" />,
  },
];

// Reihenfolge der Hauptseiten – auch fürs Wischen am Handy (SwipeNav).
export const MAIN_HREFS = MAIN.map((it) => it.href);

type MoreItem = { href: string; emoji: string; label: string; hint: string };

// Zwei Spalten im Mehr-Fenster: links alles zum Mitspielen, rechts Freunde,
// Feed und Shop.
const MORE_COLUMNS: { title: string; items: MoreItem[] }[] = [
  {
    title: "Spielen",
    items: [
      { href: "/duelle", emoji: "⚔️", label: "Duelle", hint: "Gegen Freunde" },
      { href: "/teams", emoji: "🤝", label: "Tipprunden", hint: "Private Runden" },
      { href: "/turnier", emoji: "🏆", label: "Turniere", hint: "WM, EM & Co." },
    ].filter((m) => TIPPRUNDEN_ENABLED || m.href !== "/teams"),
  },
  {
    title: "Freunde & Shop",
    items: [
      { href: "/freunde", emoji: "👥", label: "Freunde", hint: "Nummer & Chat" },
      { href: "/feed", emoji: "📰", label: "Feed", hint: "Was andere tippen" },
      { href: "/shop", emoji: "🛒", label: "Shop", hint: "Joker & Taschen" },
    ],
  },
];
const MORE = MORE_COLUMNS.flatMap((c) => c.items);
// Zeilen im Raster: so viele wie die längere Spalte hat (fehlt links ein
// Punkt, bleibt das Feld leer statt dass rechts einer verschwindet).
const MORE_ROWS = Math.max(...MORE_COLUMNS.map((c) => c.items.length));

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -top-1 left-[55%] flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {n}
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname() ?? "/";
  const { invitesForMe } = useDuels();
  const [open, setOpen] = useState(false);
  const invites = invitesForMe.length;
  // Mehr-Fenster mit dem Finger nach unten ziehen: es folgt dem Finger, ab
  // 70 px (oder einem schnellen Wisch) schließt es, sonst schnappt es zurück.
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  function onSheetStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    drag.current = { y: e.touches[0].clientY, t: Date.now(), dy: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }
  function onSheetMove(e: React.TouchEvent) {
    const d = drag.current;
    if (!d || !sheetRef.current) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    sheetRef.current.style.transform = d.dy ? `translateY(${d.dy}px)` : "";
  }
  function onSheetEnd() {
    const d = drag.current;
    const el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    const fast = d.dy > 30 && d.dy / Math.max(1, Date.now() - d.t) > 0.5;
    el.style.transition = "transform 0.2s ease-out";
    if (d.dy > 70 || fast) {
      el.style.transform = `translateY(${el.offsetHeight + 80}px)`;
      window.setTimeout(() => setOpen(false), 180);
    } else {
      el.style.transform = "";
    }
  }

  // Beim Seitenwechsel das Mehr-Fenster schließen.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const moreActive = MORE.some((m) => pathname.startsWith(m.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[45] flex items-end bg-pitch/70 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)}>
          <div
            ref={sheetRef}
            role="dialog"
            aria-label="Mehr"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onSheetStart}
            onTouchMove={onSheetMove}
            onTouchEnd={onSheetEnd}
            onTouchCancel={onSheetEnd}
            className="mb-[calc(4rem+var(--safe-bottom))] w-full animate-[sheetUp_0.2s_ease-out] rounded-t-2xl border-t border-edge bg-surface px-4 pb-4 pt-3"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-edge" />
            {/* Alle Kästchen gleich groß: ein gemeinsames Raster, Zeile für
                Zeile (links Spielen, rechts Freunde & Shop), jede Zeile so
                hoch wie das höchste Kästchen. */}
            <div className="mb-2 grid grid-cols-2 gap-x-3">
              {MORE_COLUMNS.map((col) => (
                <p key={col.title} className="px-1 font-display text-[11px] font-bold uppercase tracking-wider text-muted">
                  {col.title}
                </p>
              ))}
            </div>
            <div className="grid auto-rows-fr grid-cols-2 gap-x-3 gap-y-2">
              {Array.from({ length: MORE_ROWS }).flatMap((_, row) => MORE_COLUMNS.map((col) => col.items[row])).map((m, i) => {
                if (!m) return <div key={`leer-${i}`} aria-hidden />;
                const active = pathname.startsWith(m.href);
                const hasInvites = m.href === "/duelle" && invites > 0;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setOpen(false)}
                    className={`relative flex min-h-[3.75rem] min-w-0 items-center gap-2.5 rounded-card border px-2.5 py-2.5 transition-colors ${
                      active ? "border-gold/60 bg-gold/10" : "border-edge bg-pitch/60 hover:border-gold/40"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center text-xl leading-none" aria-hidden>
                      {m.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[13px] font-semibold leading-tight text-ink">{m.label}</span>
                      <span className="block text-[11px] leading-tight text-muted">
                        {hasInvites ? `${invites} ${invites === 1 ? "Einladung" : "Einladungen"}` : m.hint}
                      </span>
                    </span>
                    {hasInvites && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                        {invites}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Hauptmenü"
        className="fixed inset-x-0 bottom-0 z-[45] border-t border-edge bg-pitch/95 pb-[var(--safe-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-1">
          {MAIN.map((it) => {
            const active = !open && (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-1 font-display text-[11px] font-semibold transition-colors ${
                  active ? "text-gold" : "text-muted hover:text-ink"
                }`}
              >
                {active && <span className="absolute top-0 h-[3px] w-7 rounded-b-full bg-gold" />}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                  {it.icon}
                </svg>
                {it.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-1 font-display text-[11px] font-semibold transition-colors ${
              open || moreActive ? "text-gold" : "text-muted hover:text-ink"
            }`}
          >
            {(open || moreActive) && <span className="absolute top-0 h-[3px] w-7 rounded-b-full bg-gold" />}
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden>
              <circle cx="5.5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="18.5" cy="12" r="1.8" />
            </svg>
            Mehr
            {invites > 0 && <Badge n={invites} />}
          </button>
        </div>
      </nav>
    </>
  );
}
