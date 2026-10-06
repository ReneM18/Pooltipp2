// ENTWURF: Kisten-Bild und Kisten-Daten (für Shop und Entwurfsseite).

export type Tier = "holz" | "silber" | "gold";
export const KISTEN: Record<
  Tier,
  { name: string; price: number; body: string; band: string; glow: string; text: string }
> = {
  holz: { name: "Holz-Kiste", price: 150, body: "#9A6234", band: "#5E3A1C", glow: "#C98A4B", text: "1 Zufalls-Stück" },
  silber: { name: "Silber-Kiste", price: 400, body: "#8E9AA6", band: "#59636E", glow: "#C0C7CF", text: "1 Stück, bessere Chancen" },
  gold: { name: "Gold-Kiste", price: 800, body: "#D9A531", band: "#8C6512", glow: "#F5C542", text: "Pause-Joker + Tag nachholen, sicher" },
};

// Kiste als Bild (geschlossen oder offen mit Lichtstrahl)
export function Chest({ tier, size = 96, open = false }: { tier: Tier; size?: number; open?: boolean }) {
  const k = KISTEN[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      {open && (
        <>
          <path d="M30 52 L10 0 L110 0 L90 52 Z" fill={k.glow} opacity="0.18" />
          <circle cx="60" cy="50" r="26" fill={k.glow} opacity="0.3" />
        </>
      )}
      {/* Unterteil */}
      <rect x="16" y="58" width="88" height="48" rx="6" fill={k.body} />
      <rect x="16" y="58" width="88" height="8" fill={k.band} opacity="0.6" />
      <rect x="30" y="58" width="8" height="48" fill={k.band} />
      <rect x="82" y="58" width="8" height="48" fill={k.band} />
      {/* Deckel */}
      {open ? (
        <>
          <path d="M18 58 L26 26 L94 26 L102 58 Z" fill={k.band} />
          <path d="M24 56 L30 32 L90 32 L96 56 Z" fill="#1a1208" opacity="0.55" />
          <ellipse cx="60" cy="50" rx="30" ry="8" fill={k.glow} opacity="0.7" />
        </>
      ) : (
        <>
          <path d="M16 58 L16 44 Q60 18 104 44 L104 58 Z" fill={k.body} />
          <path d="M30 58 L30 34 L38 30 L38 58 Z M82 30 L90 34 L90 58 L82 58 Z" fill={k.band} />
        </>
      )}
      {/* Schloss */}
      <rect x="52" y={open ? 62 : 52} width="16" height="16" rx="3" fill={tier === "gold" ? "#FFF2C2" : "#F5C542"} stroke={k.band} strokeWidth="2" />
      <circle cx="60" cy={open ? 69 : 59} r="2.5" fill={k.band} />
    </svg>
  );
}

