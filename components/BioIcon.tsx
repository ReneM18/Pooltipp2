import { EX_PLAYER_ICON } from "@/lib/sportBio";

/** Ex-Spieler: Fußballschuh mit Stollen, der an einem Haken hängt (Rene, 04.11.2026). */
export function ExPlayerIcon({ onGold = false }: { onGold?: boolean }) {
  const line = onGold ? "#111" : "#e8e8e8";
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="inline-block h-[1.15em] w-[1.15em] align-[-0.2em]">
      <path d="M12 .8v2.4c0 1.3 1.9 1.3 1.9 0" fill="none" stroke={onGold ? "#111" : "#f2c200"} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.9 3.4 8.6 10.2M13.9 3.4l-.3 7.6" fill="none" stroke={line} strokeWidth=".9" />
      <path d="M5.2 9.8h5.4l.9 3.4c.3.9 1 1.5 2 1.6l5.6.7c1.8.2 3.1 1.6 3.1 3.2v.4H3.1l.1-1.9C3.3 14 4 11.6 5.2 9.8Z" fill="#1b1b1b" stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <path d="M7 14.2c2.4.5 4.4 1.4 6.6 3" fill="none" stroke="#f2c200" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 19.3h19.3" stroke={line} strokeWidth="1.2" />
      <g fill={line}>
        <rect x="4.4" y="19.6" width="1.7" height="2.4" rx=".6" />
        <rect x="8" y="19.6" width="1.7" height="2.4" rx=".6" />
        <rect x="14.6" y="19.6" width="1.7" height="2.4" rx=".6" />
        <rect x="18.6" y="19.6" width="1.7" height="2.4" rx=".6" />
      </g>
    </svg>
  );
}

/** Zeigt ein Steckbrief-Icon: Emoji als Text, das gezeichnete Ex-Spieler-Icon als Bild. */
export function BioIcon({ icon, onGold }: { icon: string; onGold?: boolean }) {
  return icon === EX_PLAYER_ICON ? <ExPlayerIcon onGold={onGold} /> : <>{icon}</>;
}
