"use client";

import { useEffect, useId, useState } from "react";

// Trainingstaschen im Prämien-Shop: mit Coins kaufen, dann Reißverschluss
// aufziehen. Bild und Preise (gleiche Preise wie supabase/trainingstaschen.sql).

export type BagTier = "training" | "matchtag" | "profi";
export const TASCHEN: Record<
  BagTier,
  { name: string; price: number; body: string; dark: string; glow: string; text: string }
> = {
  training: { name: "Trainingstasche", price: 150, body: "#2F9E5B", dark: "#1C6B3B", glow: "#5FD08B", text: "1 Überraschung aus der Liste" },
  matchtag: { name: "Matchtag-Tasche", price: 400, body: "#9AA6B2", dark: "#5E6873", glow: "#C9D2DB", text: "1 Überraschung aus der Liste" },
  profi: { name: "Profi-Tasche", price: 800, body: "#D9A531", dark: "#8C6512", glow: "#F5C542", text: "Garantiert: Pause-Joker + Tag nachholen" },
};

export const TASCHEN_REIHE: BagTier[] = ["training", "matchtag", "profi"];

// Herbst-Design an? (setzt das Saison-Design an <html>)
export function useHerbstDesign() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(document.documentElement.hasAttribute("data-season-design"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);
  return on;
}

/**
 * Sporttasche als Bild. open = Reißverschluss aufgezogen, Licht kommt heraus.
 * Im Herbst-Design: Riemen in Rostrot und ein Ahornblatt am Zipper.
 */
export function Bag({ tier, size = 120, open = false }: { tier: BagTier; size?: number; open?: boolean }) {
  const t = TASCHEN[tier];
  const herbst = useHerbstDesign();
  const id = useId().replace(/:/g, "");
  const strap = herbst ? "#B5542A" : "#1B2422";
  const h = (size * 120) / 160;
  return (
    <svg width={size} height={h} viewBox="0 0 160 120" aria-hidden>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.body} />
          <stop offset="1" stopColor={t.dark} />
        </linearGradient>
        <radialGradient id={`g${id}`} cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor={t.glow} stopOpacity="0.9" />
          <stop offset="1" stopColor={t.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Licht aus der offenen Tasche */}
      {open && <path d="M40 46 L18 0 L142 0 L120 46 Z" fill={`url(#g${id})`} />}

      {/* Tragegriffe */}
      {open ? (
        <>
          {/* offen: Griffe fallen zur Seite */}
          <path d="M56 46 Q44 18 24 34" fill="none" stroke={strap} strokeWidth="7" strokeLinecap="round" />
          <path d="M104 46 Q116 18 136 34" fill="none" stroke={strap} strokeWidth="7" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M56 46 Q56 14 80 14 Q104 14 104 46" fill="none" stroke={strap} strokeWidth="7" strokeLinecap="round" />
          <path d="M56 46 Q56 14 80 14 Q104 14 104 46" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Körper */}
      <rect x="14" y="40" width="132" height="66" rx="30" fill={`url(#b${id})`} />
      {/* Seitenteile */}
      <ellipse cx="30" cy="73" rx="12" ry="27" fill={t.dark} opacity="0.55" />
      <ellipse cx="130" cy="73" rx="12" ry="27" fill={t.dark} opacity="0.55" />
      {/* Bodenstreifen */}
      <path d="M26 96 Q80 108 134 96" fill="none" stroke={strap} strokeWidth="5" opacity="0.8" />
      {/* Riemen-Halter */}
      <rect x="51" y="40" width="10" height="16" rx="2" fill={strap} />
      <rect x="99" y="40" width="10" height="16" rx="2" fill={strap} />

      {open ? (
        <>
          {/* offene Öffnung */}
          <path d="M34 47 Q80 34 126 47 Q80 62 34 47 Z" fill="#0E1412" />
          <path d="M34 47 Q80 34 126 47" fill="none" stroke="#C9CED3" strokeWidth="2.5" strokeDasharray="2 2" />
          <path d="M34 47 Q80 62 126 47" fill="none" stroke="#C9CED3" strokeWidth="2.5" strokeDasharray="2 2" />
          <ellipse cx="80" cy="47" rx="30" ry="5" fill={t.glow} opacity="0.75" />
          {/* Zipper ganz links */}
          <circle cx="32" cy="47" r="3.5" fill="#E9ECEF" />
          <rect x="22" y="47" width="8" height="13" rx="2.5" fill="#E9ECEF" transform="rotate(25 32 47)" />
        </>
      ) : (
        <>
          {/* geschlossener Reißverschluss */}
          <path d="M34 48 L126 48" stroke="#C9CED3" strokeWidth="3" strokeDasharray="2 2" />
          <circle cx="118" cy="48" r="3.5" fill="#E9ECEF" />
          <rect x="114" y="49" width="8" height="14" rx="2.5" fill="#E9ECEF" />
          {herbst && (
            <text x="112" y="76" fontSize="13">
              🍁
            </text>
          )}
        </>
      )}

      {/* PoolTipp-Abzeichen */}
      <circle cx="80" cy="78" r="13" fill="#F5C542" stroke={t.dark} strokeWidth="2.5" />
      <text x="80" y="83.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#3A2A06" fontFamily="sans-serif">
        P
      </text>
    </svg>
  );
}
