"use client";

import { useEffect, useRef } from "react";

// Text (z. B. Teamnamen), der nur an Leerzeichen umbricht, nie mitten im
// Wort (auch keine automatische Silbentrennung). Passt ein langes Einzelwort wie "Mönchengladbach" nicht in die
// Breite, wird die Schrift schrittweise verkleinert (bis minPx), statt den
// Namen mit "…" abzuschneiden.
export default function FitText({
  text,
  className = "",
  minPx = 10,
  maxLines,
  shrinkFirst = false,
}: {
  text: string;
  className?: string;
  minPx?: number;
  // Höchstens so viele Zeilen (Rene, 15.10.2026): wären es mehr, wird
  // ebenfalls verkleinert; ganz zum Schluss schneidet line-clamp ab.
  maxLines?: 2;
  // Erst in einer Zeile verkleinern (bis minPx), nur wenn es dann immer noch
  // nicht passt, an Leerzeichen umbrechen (Matchcenter-Zeilen mit
  // Tippen-Balken, 04.11.2026: dort ist es schmaler, Namen sollen nicht
  // unnötig zweizeilig werden).
  shrinkFirst?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      el.style.whiteSpace = shrinkFirst ? "nowrap" : "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      const tooBig = () => el.scrollWidth > el.clientWidth || (!!maxLines && el.scrollHeight > el.clientHeight + 1);
      if (shrinkFirst) {
        const start = size;
        while (tooBig() && size > minPx) {
          size -= 0.5;
          el.style.fontSize = `${size}px`;
        }
        if (!tooBig()) return;
        // Passt einzeilig nicht: normal umbrechen, wieder ab voller Größe.
        el.style.whiteSpace = "";
        size = start;
        el.style.fontSize = "";
      }
      while (tooBig() && size > minPx) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [text, minPx, maxLines, shrinkFirst]);

  return (
    <span
      ref={ref}
      className={`${maxLines ? "line-clamp-2" : "block"} min-w-0 [hyphens:none] [overflow-wrap:normal] [word-break:normal] ${className}`}
    >
      {text}
    </span>
  );
}
