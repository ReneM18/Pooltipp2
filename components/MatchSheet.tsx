"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Spiel-Detail am Handy als Fenster von unten (Rene, 28.10.2026: "wenn ich
// ein Match antippe, fährt der ganze Bildschirm runter … ich muss immer
// wieder ganz rauf scrollen"). Liegt über der Liste, die dahinter an ihrer
// Stelle bleibt. Schließen mit "← Zurück", ✕, Runterwischen am Kopf,
// Escape oder der Zurück-Taste des Handys/Browsers.

const SWIPE_CLOSE_PX = 90;

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
  const startY = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Wurde für das Fenster ein Verlaufseintrag angelegt? Dann schließt
  // "Zurück" im Fenster über history.back(), damit kein Eintrag übrig bleibt.
  const pushedRef = useRef(false);

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

  function close() {
    // Mit Verlaufseintrag: zurück, popstate schließt dann das Fenster.
    if (pushedRef.current) window.history.back();
    else closeRef.current();
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
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-card border border-muted/40 bg-surface shadow-2xl"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? "none" : "transform 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
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
