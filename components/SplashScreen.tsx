"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_READY_EVENT, waitsForReady } from "@/lib/appReady";

// Startbild beim Öffnen der App, nur am Handy (Rene, 03.11.2026: "nur am
// Handy", am PC/Web nicht). Schwarzer Schirm mit dem goldenen P und
// "PoolTipp", bis die erste Seite fertig ist (lib/appReady.ts), dann ruhig
// ausblenden – statt dass die Spiele Stück für Stück hereinspringen.
// Ob es überhaupt erscheint, entscheidet CSS schon vor dem ersten Zeichnen
// (.pt-splash in app/globals.css: schmaler Schirm + Finger-Bedienung).
// Nur beim echten Laden der Seite, nicht beim Wechseln im Menü (das
// Root-Layout bleibt dabei stehen). Mindestens MIN_MS sichtbar, damit es
// nicht nur aufblitzt, höchstens MAX_MS, falls eine Seite nie "fertig" meldet.
const MIN_MS = 700;
const MAX_MS = 3000;
const FADE_MS = 400;

export default function SplashScreen() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const [state, setState] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let done = false;
    const timers: number[] = [];
    function hide() {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_MS - performance.now());
      timers.push(
        window.setTimeout(() => {
          setState("fade");
          timers.push(window.setTimeout(() => setState("gone"), FADE_MS));
        }, wait),
      );
    }
    if (!waitsForReady(firstPath.current) || window.__pooltippReady) {
      hide();
    } else {
      window.addEventListener(APP_READY_EVENT, hide);
      timers.push(window.setTimeout(hide, Math.max(0, MAX_MS - performance.now())));
    }
    return () => {
      window.removeEventListener(APP_READY_EVENT, hide);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (state === "gone") return null;
  return (
    <div className={`pt-splash${state === "fade" ? " pt-splash-fade" : ""}`} aria-hidden>
      <svg viewBox="0 0 512 512" className="pt-splash-logo">
        <defs>
          <linearGradient id="pt-splash-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFE7A3" />
            <stop offset=".5" stopColor="#EDB94A" />
            <stop offset="1" stopColor="#B9822A" />
          </linearGradient>
          <linearGradient id="pt-splash-white" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DCE3DE" />
          </linearGradient>
          <filter id="pt-splash-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        <circle cx="256" cy="256" r="178" fill="none" stroke="#EDB94A" strokeWidth="30" opacity=".35" filter="url(#pt-splash-glow)" />
        <path d="M256 78 A178 178 0 1 1 130 130" fill="none" stroke="url(#pt-splash-gold)" strokeWidth="26" strokeLinecap="round" />
        <circle cx="168" cy="104" r="20" fill="url(#pt-splash-gold)" />
        <path
          fill="url(#pt-splash-white)"
          fillRule="evenodd"
          transform="translate(0 2)"
          d="M188 128 H286 A82 82 0 0 1 286 292 H256 V384 H188 Z M256 184 V236 H282 A26 26 0 0 0 282 184 Z"
        />
      </svg>
      <div className="pt-splash-word font-logo">
        Pool<span className="text-gold">Tipp</span>
      </div>
    </div>
  );
}
