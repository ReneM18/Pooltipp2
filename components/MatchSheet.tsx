"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

// Spiel-Detail am Handy als Fenster von unten (Rene, 28.10.2026: "wenn ich
// ein Match antippe, fährt der ganze Bildschirm runter … ich muss immer
// wieder ganz rauf scrollen"). Liegt über der Liste, die dahinter an ihrer
// Stelle bleibt. Schließen mit "← Zurück", ✕, Runterwischen am Kopf,
// Escape oder der Zurück-Taste des Handys/Browsers.
// Dazu (Rene, 04.11.2026: "muss ich durch rechtswischen wieder
// zurückkommen"): irgendwo im Fenster nach rechts wischen schließt es. Das
// Fenster läuft dabei mit dem Finger nach rechts mit.

const SWIPE_CLOSE_PX = 90;
// Seitlich: ab diesem Weg (oder schnellem Wisch) schließt das Fenster.
const SIDE_CLOSE_PX = 80;
const SIDE_FLICK_PX = 40;
const SIDE_FLICK_MS = 250;
const LOCK = 6;
// Am linken Rand liegt im Browser die Zurück-Geste von Handy/Safari selbst,
// die schließt das Fenster schon über popstate. Dort nicht doppelt zurück.
const EDGE = 24;

// Waagerecht scrollbare Bereiche und Eingabefelder behalten ihr Wischen.
function sideBlocked(target: EventTarget | null, stop: Element): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== stop) {
    if (el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-swipe]")) return true;
    const cs = getComputedStyle(el);
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}

// App vom Home-Bildschirm am iPhone: dort gibt es keine Zurück-Geste vom Rand.
function iosStandalone(): boolean {
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function MatchSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const [side, setSide] = useState(0);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Wurde für das Fenster ein Verlaufseintrag angelegt? Dann schließt
  // "Zurück" im Fenster über history.back(), damit kein Eintrag übrig bleibt.
  const pushedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const body = document.body.style;
    const prevOverflow = body.overflow;
    body.overflow = "hidden";
    window.history.pushState({ ...(window.history.state ?? {}), matchSheet: true }, "");
    pushedRef.current = true;
    const onPop = () => {
      pushedRef.current = false;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      body.overflow = prevOverflow;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      // Von außen geschlossen (z. B. anderes Spiel): Eintrag wieder entfernen.
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Nach rechts wischen: eigene Listener, weil touchmove nicht passiv sein
  // darf (sonst scrollt die Seite beim seitlichen Wischen senkrecht mit).
  useEffect(() => {
    if (!open || !panel) return;
    const el = panel;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let dxNow = 0;
    let active = false;
    let axis: "x" | "y" | null = null;
    let timer = 0;
    const onStart = (e: TouchEvent) => {
      active = false;
      axis = null;
      dxNow = 0;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE && !iosStandalone()) return;
      if (sideBlocked(e.target, el)) return;
      sx = t.clientX;
      sy = t.clientY;
      st = Date.now();
      active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (!axis) {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
        // Nur nach rechts; nach links oder senkrecht = normal weiter.
        axis = Math.abs(dx) > Math.abs(dy) && dx > 0 ? "x" : "y";
      }
      if (axis === "y") {
        active = false;
        return;
      }
      if (e.cancelable) e.preventDefault();
      dxNow = Math.max(0, dx);
      setSide(dxNow);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      if (axis !== "x") return;
      const fast = Date.now() - st < SIDE_FLICK_MS && dxNow > SIDE_FLICK_PX;
      if (dxNow > SIDE_CLOSE_PX || fast) {
        // Erst ganz hinausschieben, dann schließen.
        setSide(window.innerWidth);
        timer = window.setTimeout(() => {
          setSide(0);
          close();
        }, 160);
      } else setSide(0);
    };
    const onCancel = () => {
      active = false;
      setSide(0);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panel]);

  function close() {
    // Mit Verlaufseintrag: zurück, popstate schließt dann das Fenster.
    // Nur einmal zurück, auch wenn zwei Gesten gleichzeitig schließen.
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else closeRef.current();
  }

  // Link im Fenster, z. B. "Jetzt tippen" (Rene, 29.10.2026: "am Handy bei
  // den Spielen auf Tippen komme ich nicht zu den Tipps"): Bisher holte das
  // Aufräumen beim Verlassen der Seite mit history.back() sofort wieder das
  // Matchcenter. Jetzt ersetzt der Link den Eintrag des Fensters, so führt
  // die Zurück-Taste danach direkt ins Matchcenter.
  function onLinkClick(e: React.MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    const href = url.pathname + url.search + url.hash;
    // Ohne eigenen Eintrag nicht ersetzen, sonst ginge das Matchcenter verloren.
    if (pushedRef.current) {
      pushedRef.current = false;
      router.replace(href);
    } else router.push(href);
  }

  if (!open || typeof document === "undefined") return null;
  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current === null) return;
      setDrag(Math.max(0, e.touches[0].clientY - startY.current));
    },
    onTouchEnd: () => {
      const d = drag;
      startY.current = null;
      setDrag(0);
      if (d > SWIPE_CLOSE_PX) close();
    },
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end bg-pitch/80 backdrop-blur-sm lg:hidden" onClick={close}>
      <div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-card border border-muted/40 bg-surface shadow-2xl"
        style={{
          transform: side ? `translateX(${side}px)` : drag ? `translateY(${drag}px)` : undefined,
          transition: (drag || side) && side < window.innerWidth ? "none" : "transform 0.16s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
        onClickCapture={onLinkClick}
      >
        <div className="shrink-0 touch-none border-b border-edge" {...dragHandlers}>
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted/50" />
          <div className="flex items-center gap-3 px-3 pb-2.5 pt-2">
            <button type="button" onClick={close} className="shrink-0 text-sm font-semibold text-gold">
              ← Zurück
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{title}</span>
            <button
              type="button"
              onClick={close}
              aria-label="Schließen"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-muted"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+var(--safe-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
