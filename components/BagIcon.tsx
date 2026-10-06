"use client";

import { useEffect, useId, useState } from "react";

// Trainingstaschen im Prämien-Shop: mit Coins kaufen, dann Reißverschluss
// aufziehen. Bild und Preise (gleiche Preise wie supabase/trainingstaschen.sql).

export type BagTier = "training" | "matchtag" | "profi";
export const TASCHEN: Record<
  BagTier,
  { name: string; price: number; body: string; dark: string; glow: string; text: string }
> = {
  training: { name: "Trainingstasche", price: 150, body: "#76806A", dark: "#4C5444", glow: "#A9C79A", text: "1 Überraschung aus der Liste" },
  matchtag: { name: "Matchtag-Tasche", price: 400, body: "#2F72D6", dark: "#173E86", glow: "#8EC2FF", text: "1 Überraschung aus der Liste" },
  profi: { name: "Profi-Tasche", price: 800, body: "#E9B73E", dark: "#8C6512", glow: "#F5C542", text: "Garantiert: Pause-Joker + Tag nachholen" },
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

// Umriss der Tasche. Die Trainingstasche ist ausgeleiert und hängt durch.
const KOERPER = {
  training: "M42 43 Q80 40 120 44 Q146 46 145 75 Q144 103 116 106 Q80 111 44 105 Q15 102 15 74 Q16 45 42 43 Z",
  sauber: "M44 40 L116 40 Q146 40 146 73 Q146 106 116 106 L44 106 Q14 106 14 73 Q14 40 44 40 Z",
};

/**
 * Sporttasche als Bild. open = Reißverschluss aufgezogen, Licht kommt heraus.
 * Im Herbst-Design: Riemen in Rostrot und ein Ahornblatt am Zipper.
 * Die drei Stufen sollen sich auf einen Blick unterscheiden, auch klein am
 * Handy (überall gleich, weil alle Stellen dieses Bild benutzen):
 *   training: kleiner, ausgeleiert, verblasstes Oliv, Flicken, Riss,
 *             abgeschabte Ecken, Flecken, Klebeband am Griff, schiefer
 *             Aufkleber, einfacher Reißverschluss mit Schnur statt Zipper
 *   matchtag: kräftiges Vereinsblau, weiße Seitenstreifen, Glanz,
 *             Silber-Paspel, Silber-Füße, Emblem mit Silberring
 *   profi:    am größten, Gold mit Metall-Verlauf und Glanzstreifen,
 *             Lederriemen mit Goldnaht, Ziernaht, großes Wappen mit
 *             Lorbeer und Krone, Goldfüße, Leuchten und Funkeln
 */
export function Bag({ tier, size = 120, open = false }: { tier: BagTier; size?: number; open?: boolean }) {
  const t = TASCHEN[tier];
  const herbst = useHerbstDesign();
  const id = useId().replace(/:/g, "");
  const strap = herbst
    ? tier === "training" ? "#8C6450" : tier === "profi" ? "#5A2410" : "#163274"
    : tier === "training" ? "#59605A" : tier === "profi" ? "#4A2E10" : "#163274";
  const zip = tier === "profi" ? "#FFE08A" : tier === "matchtag" ? "#E9EEF3" : "#9A9F98";
  const body = tier === "training" ? KOERPER.training : KOERPER.sauber;
  // Größe: Training wirkt klein und schlapp, Profi am größten.
  const scale = tier === "training" ? 0.84 : tier === "matchtag" ? 0.93 : 1;
  const h = (size * 120) / 160;
  const griff = open ? ["M56 46 Q44 18 24 34", "M104 46 Q116 18 136 34"] : ["M56 46 Q56 14 80 14 Q104 14 104 46"];
  return (
    <svg width={size} height={h} viewBox="0 0 160 120" aria-hidden>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2={tier === "profi" ? "0.35" : "0"} y2="1">
          {tier === "profi" ? (
            <>
              <stop offset="0" stopColor="#FFEFB0" />
              <stop offset="0.3" stopColor="#EDBE45" />
              <stop offset="0.62" stopColor="#B88316" />
              <stop offset="0.8" stopColor="#E8BC4C" />
              <stop offset="1" stopColor="#7E5A0E" />
            </>
          ) : tier === "matchtag" ? (
            <>
              <stop offset="0" stopColor="#4A8BEA" />
              <stop offset="0.55" stopColor={t.body} />
              <stop offset="1" stopColor={t.dark} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={t.body} />
              <stop offset="1" stopColor="#646D58" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`g${id}`} cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor={t.glow} stopOpacity="0.9" />
          <stop offset="1" stopColor={t.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`h${id}`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#F5C542" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F5C542" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6D6" />
          <stop offset="0.5" stopColor="#F2C94C" />
          <stop offset="1" stopColor="#B07F14" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* Leuchten hinter der Profi-Tasche */}
      {tier === "profi" && <ellipse cx="80" cy="64" rx="80" ry="54" fill={`url(#h${id})`} />}

      <g transform={`translate(80 108) scale(${scale}) translate(-80 -108)`}>
        {/* Licht aus der offenen Tasche */}
        {open && <path d="M40 46 L18 0 L142 0 L120 46 Z" fill={`url(#g${id})`} />}

        {/* Schatten am Boden */}
        <ellipse cx="80" cy="109" rx="58" ry="4" fill="#000000" opacity="0.28" />

        {/* Tragegriffe */}
        {griff.map((d) => (
          <g key={d}>
            <path d={d} fill="none" stroke={strap} strokeWidth={tier === "training" ? 5 : tier === "profi" ? 8 : 7} strokeLinecap="round" />
            {tier === "profi" && <path d={d} fill="none" stroke="#F5C542" strokeWidth="1.2" strokeDasharray="2.5 2" strokeLinecap="round" />}
            {tier === "matchtag" && <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />}
          </g>
        ))}
        {/* Klebeband um den Griff (Training) */}
        {tier === "training" && !open && (
          <g transform="rotate(-38 64 22)">
            <rect x="58" y="18" width="12" height="8" rx="1" fill="#C9C4B3" />
            <path d="M58 19 l12 0 M58 25 l12 0" stroke="#8E8977" strokeWidth="0.6" />
          </g>
        )}

        {/* Körper */}
        <path d={body} fill={`url(#b${id})`} />
        <g clipPath={`url(#c${id})`}>
          {/* Seitenteile */}
          <ellipse cx="28" cy="73" rx="13" ry="30" fill={t.dark} opacity={tier === "training" ? 0.4 : 0.5} />
          <ellipse cx="132" cy="73" rx="13" ry="30" fill={t.dark} opacity={tier === "training" ? 0.4 : 0.5} />

          {tier === "training" && (
            <>
              {/* abgeschabte Kanten und Ecken */}
              <ellipse cx="18" cy="98" rx="10" ry="7" fill="#D9D3BC" opacity="0.4" />
              <ellipse cx="144" cy="94" rx="8" ry="9" fill="#D9D3BC" opacity="0.35" />
              <ellipse cx="86" cy="107" rx="22" ry="4" fill="#D9D3BC" opacity="0.35" />
              {/* Flecken */}
              <ellipse cx="58" cy="99" rx="6" ry="3.5" fill="#3A3F31" opacity="0.35" />
              {/* Kratzer */}
              <path d="M34 66 l10 -3 M112 62 l9 4 M58 98 l9 -2 M122 78 l7 -5" stroke="#E9E4D2" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
              {/* Riss mit Fransen */}
              <path d="M100 84 l4 3 l-2 3 l5 3 l-1 3 l4 3" fill="none" stroke="#22261C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M102 88 l3 -1 M103 93 l-3 1 M107 97 l3 0" stroke="#E9E4D2" strokeOpacity="0.7" strokeWidth="0.8" strokeLinecap="round" />
            </>
          )}

          {tier === "matchtag" && (
            <>
              {/* weiße Seitenstreifen */}
              <path d="M8 86 Q80 74 152 86" fill="none" stroke="#ffffff" strokeWidth="4.5" />
              <path d="M8 93 Q80 81 152 93" fill="none" stroke="#ffffff" strokeWidth="2" />
              {/* saubere Naht */}
              <path d={body} transform="translate(80 73) scale(0.93) translate(-80 -73)" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.9" strokeDasharray="2.5 2" />
              {/* Glanz */}
              <ellipse cx="80" cy="56" rx="52" ry="6" fill="#ffffff" opacity="0.28" />
            </>
          )}

          {tier === "profi" && (
            <>
              {/* Glanzstreifen schräg über die Tasche */}
              <path d="M30 30 L52 30 L22 120 L0 120 Z" fill="#ffffff" opacity="0.35" />
              <path d="M58 30 L66 30 L36 120 L28 120 Z" fill="#ffffff" opacity="0.22" />
              <ellipse cx="80" cy="55" rx="52" ry="5.5" fill="#FFFBEA" opacity="0.5" />
              {/* Ziernaht rundum */}
              <path d={body} transform="translate(80 73) scale(0.9) translate(-80 -73)" fill="none" stroke="#FFF4CF" strokeWidth="1.3" strokeDasharray="3 2.2" />
            </>
          )}
        </g>

        {/* Umrandung: Silber-Paspel (Matchtag), Goldkante (Profi) */}
        {tier === "matchtag" && <path d={body} fill="none" stroke="#DCE3EA" strokeWidth="1.6" />}
        {tier === "profi" && <path d={body} fill="none" stroke="#7A560C" strokeWidth="1.8" />}

        {/* Füße */}
        {tier !== "training" &&
          [40, 120].map((x) => (
            <rect key={x} x={x - 7} y="103" width="14" height="5" rx="2.5" fill={tier === "profi" ? `url(#w${id})` : "#C9D1D9"} stroke={tier === "profi" ? "#7A560C" : "#7B8794"} strokeWidth="0.8" />
          ))}

        {/* Aufgenähter Flicken mit Kreuzstichen (Training) */}
        {tier === "training" && (
          <g transform="rotate(-10 44 82)">
            <rect x="32" y="73" width="22" height="17" rx="2" fill="#A8946A" />
            <rect x="34" y="75" width="18" height="13" rx="1.5" fill="none" stroke="#5E4F33" strokeWidth="0.9" strokeDasharray="2 1.6" />
            <path d="M31 73 l3 3 M54 73 l-3 3 M31 90 l3 -3 M54 90 l-3 -3" stroke="#3E3422" strokeWidth="1" />
          </g>
        )}

        {/* Riemen-Halter */}
        <rect x="51" y="40" width="10" height="16" rx="2" fill={strap} />
        <rect x="99" y="40" width="10" height="16" rx="2" fill={strap} />
        {tier === "profi" && (
          <>
            <rect x="51.5" y="48" width="9" height="5" rx="1" fill={`url(#w${id})`} />
            <rect x="99.5" y="48" width="9" height="5" rx="1" fill={`url(#w${id})`} />
          </>
        )}
        {tier === "matchtag" && (
          <>
            <circle cx="56" cy="51" r="1.6" fill="#E9EEF3" />
            <circle cx="104" cy="51" r="1.6" fill="#E9EEF3" />
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
            {tier === "training" ? (
              <path d="M32 47 q-6 6 -2 12 q3 3 -1 7" fill="none" stroke="#C9C4B3" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <>
                <circle cx="32" cy="47" r="3.5" fill={zip} />
                <rect x="22" y="47" width="8" height="13" rx="2.5" fill={zip} transform="rotate(25 32 47)" />
              </>
            )}
          </>
        ) : (
          <>
            {/* geschlossener Reißverschluss; Training: eine Lücke, Schnur statt Zipper */}
            {tier === "training" ? (
              <>
                <path d="M36 49 L82 48 M88 48 L124 49" stroke={zip} strokeWidth="2.6" strokeDasharray="2 2" />
                <circle cx="118" cy="48.5" r="2.5" fill={zip} />
                <path d="M118 50 q-3 6 1 10 q3 3 -1 7" fill="none" stroke="#C9C4B3" strokeWidth="1.6" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M34 48 L126 48" stroke={zip} strokeWidth="3" strokeDasharray="2 2" />
                <circle cx="118" cy="48" r="3.5" fill={zip} />
                <rect x="114" y="49" width="8" height="14" rx="2.5" fill={zip} stroke={tier === "profi" ? "#9A6E12" : "#8A96A3"} strokeWidth="0.6" />
                <rect x="116" y="51" width="2" height="9" rx="1" fill="#ffffff" opacity="0.8" />
              </>
            )}
            {herbst && (
              <text x={tier === "training" ? 120 : 124} y="78" fontSize="12" transform={tier === "training" ? "rotate(14 126 74)" : undefined}>
                🍁
              </text>
            )}
          </>
        )}

        {/* Abzeichen: Training = verblasster Aufkleber schief und halb abgelöst,
            Matchtag = Emblem mit Silberring, Profi = großes Wappen mit Lorbeer und Krone */}
        {tier === "profi" ? (
          <g transform={open ? "translate(0 5)" : undefined}>
            {/* Lorbeer */}
            {[-1, 1].map((sx) => (
              <g key={sx} transform={`translate(80 0) scale(${sx} 1) translate(-80 0)`}>
                <path d="M63 96 Q55 84 59 68" fill="none" stroke="#FFF1C2" strokeWidth="1.4" strokeLinecap="round" />
                {[70, 76, 82, 88].map((y, i) => (
                  <ellipse key={y} cx={58.5 + i * 0.4} cy={y} rx="2" ry="4" fill="#FFF1C2" transform={`rotate(-35 ${58.5 + i * 0.4} ${y})`} />
                ))}
              </g>
            ))}
            <path d="M80 61 L96 66 L96 79 Q96 90 80 97 Q64 90 64 79 L64 66 Z" fill={`url(#w${id})`} stroke="#6E4E0A" strokeWidth="2" />
            <path d="M80 64.5 L93 68.5 L93 79 Q93 88 80 93.5 Q67 88 67 79 L67 68.5 Z" fill="none" stroke="#FFF8DE" strokeWidth="1" />
            <text x="80" y="86" textAnchor="middle" fontSize="16" fontWeight="900" fill="#3A2A06" fontFamily="sans-serif">
              P
            </text>
            {/* Krone */}
            <path d="M72 60 L72 53 L76 57 L80 51 L84 57 L88 53 L88 60 Z" fill={`url(#w${id})`} stroke="#6E4E0A" strokeWidth="1" strokeLinejoin="round" />
          </g>
        ) : tier === "matchtag" ? (
          <>
            <circle cx="80" cy="74" r="14.5" fill="#EEF2F5" stroke="#8A96A3" strokeWidth="1.5" />
            <circle cx="80" cy="74" r="11.5" fill="#F5C542" />
            <text x="80" y="79.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#3A2A06" fontFamily="sans-serif">
              P
            </text>
          </>
        ) : (
          <g transform="rotate(-18 82 76)" opacity="0.8">
            <circle cx="82" cy="76" r="12" fill="#BFAE7A" />
            <text x="82" y="81" textAnchor="middle" fontSize="14" fontWeight="800" fill="#4A4232" fontFamily="sans-serif" opacity="0.7">
              P
            </text>
            {/* abgelöste Ecke */}
            <path d="M88 65.6 Q95.5 68 94.5 74.5 Q89.5 71 88 65.6 Z" fill="#ECE7D8" stroke="#4C5444" strokeWidth="0.7" />
          </g>
        )}
      </g>

      {/* Funkeln (Profi) */}
      {tier === "profi" && (
        <>
          <Sparkle x={14} y={44} r={7} color="#FFF4CF" />
          <Sparkle x={148} y={96} r={6} color="#FFF4CF" />
          <Sparkle x={140} y={34} r={4.5} color="#FFF4CF" />
          <Sparkle x={22} y={100} r={3.5} color="#FFF4CF" />
          <Sparkle x={98} y={8} r={3.5} color="#FFF4CF" />
        </>
      )}
    </svg>
  );
}
