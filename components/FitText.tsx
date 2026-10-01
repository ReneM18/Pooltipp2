"use client";

import { useEffect, useRef } from "react";

// Text (z. B. Teamnamen), der nur an Leerzeichen umbricht, nie mitten im
// Wort. Passt ein langes Einzelwort wie "Mönchengladbach" nicht in die
// Breite, wird die Schrift schrittweise verkleinert (bis minPx), statt den
// Namen mit "…" abzuschneiden.
export default function FitText({
  text,
  className = "",
  minPx = 10,
}: {
  text: string;
  className?: string;
  minPx?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > minPx) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [text, minPx]);

  return (
    <span
      ref={ref}
      className={`block min-w-0 [hyphens:manual] [overflow-wrap:normal] ${className}`}
    >
      {text}
    </span>
  );
}
