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
      const tooBig = () => el.scrollWidth > el.clientWidth || (!!maxLines && el.scrollHeight > el.clientHeight + 1);
      while (tooBig() && size > minPx) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
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
