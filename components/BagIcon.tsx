"use client";

import { useEffect, useId, useState } from "react";

// Trainingstaschen im Prämien-Shop: mit Coins kaufen, dann Reißverschluss
// aufziehen. Bild und Preise (gleiche Preise wie supabase/trainingstaschen.sql).

export type BagTier = "training" | "matchtag" | "profi";
export const TASCHEN: Record<
  BagTier,
  { name: string; price: number; body: string; dark: string; glow: string; text: string }
> = {
  training: { name: "Trainingstasche", price: 150, body: "#3F8A5C", dark: "#285A3B", glow: "#5FD08B", text: "1 Überraschung aus der Liste" },
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

// Funkelnder Stern (Profi-Tasche).
function Sparkle({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <path
      d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
      fill={color}
    />
  );
}

/**
 * Sporttasche als Bild. open = Reißverschluss aufgezogen, Licht kommt heraus.
 * Im Herbst-Design: Riemen in Rostrot und ein Ahornblatt am Zipper.
 * Jede Stufe sieht anders aus (überall gleich, weil alle Stellen dieses Bild
 * benutzen):
 *   training: gebraucht, matt, Flicken, Kratzer, Aufkleber halb abgelöst
 *   matchtag: gepflegt, Glanz, blanker Reißverschluss, Silber-Emblem
 *   profi:    edel, Gold mit Glanz, Ziernaht, Wappen, goldene Griffkanten, Funkeln
 */
export function Bag({ tier, size = 120, open = false }: { tier: BagTier; size?: number; open?: boolean }) {
  const t = TASCHEN[tier];
  const herbst = useHerbstDesign();
  const id = useId().replace(/:/g, "");
  const strap = herbst ? (tier === "training" ? "#9A5233" : "#B5542A") : tier === "training" ? "#323936" : "#1B2422";
  const zip = tier === "profi" ? "#F5D77A" : tier === "matchtag" ? "#F4F7FA" : "#AEB4B0";
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
        <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9A3" />
          <stop offset="1" stopColor="#C8901F" />
        </linearGradient>
      </defs>

      {/* Licht aus der offenen Tasche */}
      {open && <path d="M40 46 L18 0 L142 0 L120 46 Z" fill={`url(#g${id})`} />}

      {/* Tragegriffe */}
      {open ? (
        <>
          {/* offen: Griffe fallen zur Seite */}
          <path d="M56 46 Q44 18 24 34" fill="none" stroke={strap} strokeWidth="7" strokeLinecap="round" />
          <path d="M104 46 Q116 18 136 34" fill="none" stroke={strap} strokeWidth="7" strokeLinecap="round" />
          {tier === "profi" && (
            <>
              <path d="M56 46 Q44 18 24 34" fill="none" stroke="#F5C542" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M104 46 Q116 18 136 34" fill="none" stroke="#F5C542" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </>
      ) : (
        <>
          <path d="M56 46 Q56 14 80 14 Q104 14 104 46" fill="none" stroke={strap} strokeWidth="7" strokeLinecap="round" />
          <path
            d="M56 46 Q56 14 80 14 Q104 14 104 46"
            fill="none"
            stroke={tier === "profi" ? "#F5C542" : "#ffffff"}
            strokeOpacity={tier === "profi" ? 0.7 : tier === "training" ? 0.05 : 0.12}
            strokeWidth={tier === "profi" ? 1.5 : 2}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Körper */}
      <rect x="14" y="40" width="132" height="66" rx="30" fill={`url(#b${id})`} />
      {/* Seitenteile */}
      <ellipse cx="30" cy="73" rx="12" ry="27" fill={t.dark} opacity="0.55" />
      <ellipse cx="130" cy="73" rx="12" ry="27" fill={t.dark} opacity="0.55" />

      {/* Glanz (Matchtag leicht, Profi stark) */}
      {tier !== "training" && (
        <ellipse cx="80" cy="57" rx="50" ry="5" fill="#ffffff" opacity={tier === "profi" ? 0.32 : 0.22} />
      )}
      {/* Ziernaht rundum (Profi) */}
      {tier === "profi" && (
        <rect x="19" y="45" width="122" height="56" rx="26" fill="none" stroke="#FFF1C2" strokeOpacity="0.7" strokeWidth="1.2" strokeDasharray="3 2.5" />
      )}
      {/* Gebrauchsspuren (Training): Kratzer und ein aufgenähter Flicken */}
      {tier === "training" && (
        <>
          <path d="M36 62 l9 -3 M40 88 l7 2 M118 86 l8 -4 M124 60 l-6 3" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.3" strokeLinecap="round" />
          <g transform="rotate(-9 53 79)">
            <rect x="44" y="72" width="18" height="14" rx="2" fill="#B9A57C" />
            <rect x="45.5" y="73.5" width="15" height="11" rx="1.5" fill="none" stroke="#6E5E3F" strokeWidth="0.9" strokeDasharray="2 1.6" />
          </g>
        </>
      )}

      {/* Bodenstreifen */}
      <path d="M26 96 Q80 108 134 96" fill="none" stroke={strap} strokeWidth="5" opacity={tier === "training" ? 0.5 : 0.8} />
      {tier === "profi" && <path d="M26 96 Q80 108 134 96" fill="none" stroke="#F5C542" strokeWidth="1" opacity="0.8" />}
      {/* Riemen-Halter */}
      <rect x="51" y="40" width="10" height="16" rx="2" fill={strap} />
      <rect x="99" y="40" width="10" height="16" rx="2" fill={strap} />
      {tier === "profi" && (
        <>
          <circle cx="56" cy="51" r="1.6" fill="#F5C542" />
          <circle cx="104" cy="51" r="1.6" fill="#F5C542" />
        </>
      )}

      {open ? (
        <>
          {/* offene Öffnung */}
          <path d="M34 47 Q80 34 126 47 Q80 62 34 47 Z" fill="#0E1412" />
          <path d="M34 47 Q80 34 126 47" fill="none" stroke={zip} strokeWidth="2.5" strokeDasharray="2 2" />
          <path d="M34 47 Q80 62 126 47" fill="none" stroke={zip} strokeWidth="2.5" strokeDasharray="2 2" />
          <ellipse cx="80" cy="47" rx="30" ry="5" fill={t.glow} opacity="0.75" />
          {/* Zipper ganz links */}
          <circle cx="32" cy="47" r="3.5" fill={zip} />
          <rect x="22" y="47" width="8" height="13" rx="2.5" fill={zip} transform="rotate(25 32 47)" />
        </>
      ) : (
        <>
          {/* geschlossener Reißverschluss */}
          <path d="M34 48 L126 48" stroke={zip} strokeWidth="3" strokeDasharray="2 2" />
          <circle cx="118" cy="48" r="3.5" fill={zip} />
          <rect x="114" y="49" width="8" height="14" rx="2.5" fill={zip} />
          {tier !== "training" && <rect x="116" y="51" width="2" height="9" rx="1" fill="#ffffff" opacity="0.7" />}
          {herbst && (
            <text x="112" y="76" fontSize="13">
              🍁
            </text>
          )}
        </>
      )}

      {/* PoolTipp-Abzeichen: Training = Aufkleber halb abgelöst,
          Matchtag = Emblem mit Silberring, Profi = goldenes Wappen */}
      {tier === "profi" ? (
        <>
          <path d="M80 63 L94 67.5 L94 79 Q94 89 80 95 Q66 89 66 79 L66 67.5 Z" fill={`url(#w${id})`} stroke={t.dark} strokeWidth="2.2" />
          <path d="M80 66.5 L91 70 L91 79 Q91 87 80 91.5 Q69 87 69 79 L69 70 Z" fill="none" stroke="#FFF4CF" strokeOpacity="0.8" strokeWidth="0.9" />
          <text x="80" y="84.5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#3A2A06" fontFamily="sans-serif">
            P
          </text>
        </>
      ) : tier === "matchtag" ? (
        <>
          <circle cx="80" cy="78" r="14.5" fill="#EEF2F5" stroke={t.dark} strokeWidth="1.5" />
          <circle cx="80" cy="78" r="11.5" fill="#F5C542" />
          <text x="80" y="83.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#3A2A06" fontFamily="sans-serif">
            P
          </text>
        </>
      ) : (
        <>
          <circle cx="80" cy="78" r="13" fill="#D9B64E" stroke={t.dark} strokeWidth="2.5" opacity="0.85" />
          <text x="80" y="83.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#3A2A06" fontFamily="sans-serif" opacity="0.75">
            P
          </text>
          {/* abgelöste Ecke */}
          <path d="M86 66.5 Q93.5 69 92.5 75 Q88 71.5 86 66.5 Z" fill="#E7E2D3" stroke={t.dark} strokeWidth="0.8" />
        </>
      )}

      {/* Funkeln (Profi) */}
      {tier === "profi" && (
        <>
          <Sparkle x={24} y={50} r={5} color="#FFF4CF" />
          <Sparkle x={140} y={92} r={4} color="#FFF4CF" />
          <Sparkle x={128} y={44} r={3} color="#FFF4CF" />
        </>
      )}
    </svg>
  );
}
