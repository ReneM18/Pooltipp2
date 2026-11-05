"use client";

import { useEffect, useRef } from "react";

// Text (z. B. Teamnamen), der nur an Leerzeichen umbricht, nie mitten im
// Wort (auch keine automatische Silbentrennung). Passt ein langes Einzelwort wie "Mönchengladbach" nicht in die
// Breite, wird die Schrift schrittweise verkleinert (bis minPx), statt den
// Namen mit "…" abzuschneiden.
// Namen, die zusammen stehen (beide Vereine einer Spielzeile oder Tippkarte),
// bekommen dieselbe Schriftgröße: die kleinere der beiden. Vorher wurde jeder
// Name für sich verkleinert, dann stand z. B. "Baltimore Ravens" kleiner da
// als "Jacksonville Jaguars" (Rene, 05.11.2026: "die Schriftgrößen der Teams
// sind verschieden am Handy"). Gruppe = nächstes Element mit data-fit-group.
export function syncFitGroup(el: HTMLElement, fittedPx: number) {
  el.dataset.fitPx = String(fittedPx);
  const group = el.closest("[data-fit-group]");
  if (!group) return;
  const peers = Array.from(group.querySelectorAll<HTMLElement>("[data-fit-px]"));
  const sizes = peers.map((p) => parseFloat(p.dataset.fitPx ?? "")).filter((n) => n > 0);
  if (!sizes.length) return;
  const min = Math.min(...sizes);
  for (const p of peers) {
    const own = parseFloat(p.dataset.fitPx ?? "");
    p.style.fontSize = own > min ? `${min}px` : own < parseFloat(p.dataset.basePx ?? "0") ? `${own}px` : "";
  }
}

export default function FitText({
  text,
  className = "",
  minPx = 10,
  maxLines,
}: {
  text: string;
  className?: string;
  minPx?: number;
  // Höchstens so viele Zeilen (Rene, 15.10.2026): wären es mehr, wird
  // ebenfalls verkleinert; ganz zum Schluss schneidet line-clamp ab.
  maxLines?: 2;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      el.dataset.basePx = String(size);
      const tooBig = () => el.scrollWidth > el.clientWidth || (!!maxLines && el.scrollHeight > el.clientHeight + 1);
      while (tooBig() && size > minPx) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      syncFitGroup(el, size);
    };
    fit();
    // Nach dem Laden der Schrift neu messen (sie ist breiter als die Ersatzschrift).
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [text, minPx, maxLines]);

  return (
    <span
      ref={ref}
      className={`${maxLines ? "line-clamp-2" : "block"} min-w-0 [hyphens:none] [overflow-wrap:normal] [word-break:normal] ${className}`}
    >
      {text}
    </span>
  );
}
