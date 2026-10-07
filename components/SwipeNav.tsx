"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MAIN_HREFS } from "./BottomNav";

// Am Handy/Tablet (bis lg:, solange die Leiste unten da ist) wechselt ein
// klar waagerechter Wischer zur Nachbarseite der Leiste: nach links wischen =
// nächste Seite, nach rechts = vorige. Am ersten/letzten Reiter passiert
// nichts. Nicht gewischt wird in Eingabefeldern, in waagerecht scrollbaren
// Bereichen, in festen Fenstern (Chat, Mehr-Fenster, Dialoge) und vom
// Bildschirmrand aus (dort liegt die Zurück-Geste des Handys).

const MIN_DX = 70; // Mindest-Weg in px
const RATIO = 2; // waagerecht mindestens doppelt so weit wie senkrecht
const MAX_MS = 700;
const EDGE = 24;

let pendingDir: "next" | "prev" | null = null;

function blocked(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-swipe]")) return true;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") return true;
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}

function indexOf(pathname: string) {
  return MAIN_HREFS.findIndex((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")));
}

export default function SwipeNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    // Nach einem Wisch-Wechsel gleitet die neue Seite von der Seite herein.
    if (!pendingDir) return;
    const root = document.querySelector<HTMLElement>("[data-swipe-root]");
    const cls = pendingDir === "next" ? "animate-swipe-from-right" : "animate-swipe-from-left";
    pendingDir = null;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add(cls);
    const done = () => root.classList.remove(cls);
    root.addEventListener("animationend", done, { once: true });
    const t = window.setTimeout(done, 600);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const idx = indexOf(pathname);
    if (idx < 0) return;
    const mobile = window.matchMedia("(max-width: 1023px)");
    let sx = 0;
    let sy = 0;
    let st = 0;
    let active = false;

    const onStart = (e: TouchEvent) => {
      active = false;
      if (!mobile.matches || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      if (blocked(e.target)) return;
      sx = t.clientX;
      sy = t.clientY;
      st = Date.now();
      active = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Date.now() - st > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < RATIO * Math.abs(dy)) return;
      // Text markiert? Dann war es kein Wischer.
      if (window.getSelection()?.toString()) return;
      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next < 0 || next >= MAIN_HREFS.length) return;
      pendingDir = dx < 0 ? "next" : "prev";
      router.push(MAIN_HREFS[next]);
    };
    const onCancel = () => {
      active = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [pathname, router]);

  return null;
}
