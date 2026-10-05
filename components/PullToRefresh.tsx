"use client";

import { useEffect, useRef, useState } from "react";
import { refreshNow } from "@/lib/appRefresh";

// Runterwischen zum Aktualisieren: Steht die Seite ganz oben und zieht man
// mit dem Finger nach unten, erscheint oben ein kleiner Kreis. Weit genug
// gezogen und losgelassen, lädt die App Tipps, Spiele, Coins und die Daten
// der Seite neu – ohne die ganze Seite neu zu laden (halbe Eingaben bleiben
// stehen). Das browsereigene Runterwischen ist dafür in globals.css
// abgeschaltet (overscroll-behavior), sonst gäbe es beides gleichzeitig.
//
// Bewusst NICHT ausgelöst:
// - in Fenstern, im Chat und allem anderen, was fest über der Seite liegt;
// - solange ein Fenster das Scrollen der Seite sperrt;
// - in Listen, die selbst noch nach oben scrollen können;
// - bei seitlichem Wischen (z. B. die Menüleiste) und mit zwei Fingern.

const THRESHOLD = 70; // so weit muss der Kreis gezogen werden
const MAX_PULL = 110;
const RESISTANCE = 0.5; // der Kreis bewegt sich halb so weit wie der Finger

function blockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (document.body.style.overflow === "hidden" || document.documentElement.style.overflow === "hidden") return true;
  if (target.closest('[role="dialog"], [aria-modal="true"], [data-no-pull-refresh]')) return true;
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.position === "fixed") return true;
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight && el.scrollTop > 0) return true;
  }
  return false;
}

export default function PullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const circleRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false; // Finger liegt auf, Wischen könnte ein Runterziehen werden
    let pulling = false; // eindeutig nach unten gezogen
    let distance = 0;

    function show(d: number, animate: boolean) {
      const circle = circleRef.current;
      if (!circle) return;
      circle.style.transition = animate ? "transform 200ms ease, opacity 200ms ease" : "none";
      circle.style.transform = `translate(-50%, ${d - 48}px)`;
      circle.style.opacity = d > 4 ? String(Math.min(1, d / THRESHOLD)) : "0";
      if (arrowRef.current) {
        arrowRef.current.style.transform = `rotate(${d >= THRESHOLD ? 180 : (d / THRESHOLD) * 180}deg)`;
      }
    }

    function onStart(e: TouchEvent) {
      tracking = false;
      pulling = false;
      if (refreshingRef.current || e.touches.length !== 1 || window.scrollY > 0) return;
      if (blockedTarget(e.target)) return;
      // Der Kreis kommt unter der fest angehefteten Kopfzeile hervor.
      const header = document.querySelector("[data-pull-anchor]");
      if (circleRef.current) circleRef.current.style.top = `${header ? header.getBoundingClientRect().bottom : 0}px`;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }

    function onMove(e: TouchEvent) {
      if (!tracking) return;
      if (e.touches.length !== 1) {
        tracking = false;
        if (pulling) show(0, true);
        pulling = false;
        return;
      }
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!pulling) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Seitlich oder nach oben: normales Wischen, hier nichts tun.
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
          tracking = false;
          return;
        }
        pulling = true;
        startY = e.touches[0].clientY;
      }
      distance = Math.min(MAX_PULL, Math.max(0, (e.touches[0].clientY - startY) * RESISTANCE));
      show(distance, false);
    }

    function onEnd() {
      if (!tracking) return;
      tracking = false;
      if (!pulling) return;
      pulling = false;
      if (distance < THRESHOLD) {
        show(0, true);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      show(THRESHOLD - 10, true);
      const started = Date.now();
      refreshNow().finally(() => {
        // Kurz stehen lassen, damit man sieht, dass etwas passiert ist.
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          show(0, true);
        }, Math.max(0, 600 - (Date.now() - started)));
      });
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={circleRef}
      aria-hidden={!refreshing}
      role="status"
      className="pointer-events-none fixed left-1/2 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-gold shadow-lg"
      style={{ transform: "translate(-50%, -48px)", opacity: 0 }}
    >
      {refreshing ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      ) : (
        <svg ref={arrowRef} viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      )}
      <span className="sr-only">{refreshing ? "Wird aktualisiert" : ""}</span>
    </div>
  );
}
