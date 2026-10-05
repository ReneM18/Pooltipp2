import { useId } from "react";

// PoolTipp Coin: goldene Münze mit erhabenem Rand und geprägtem P. Bleibt
// auch klein (20 px in der Kopfzeile) gut lesbar. Eigene Farben statt
// currentColor, damit die Münze überall gleich aussieht.
export function CoinIcon({ className }: { className?: string }) {
  // Eindeutige Verlauf-IDs, weil die Münze oft mehrfach auf der Seite steht.
  const id = useId().replace(/:/g, "");
  const P = "M24 17 H35.5 A9.5 9.5 0 0 1 35.5 36 H31 V47 H24 Z M31 23 V30 H35 A3.5 3.5 0 0 0 35 23 Z";
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={`inline-block shrink-0 ${className ?? ""}`}>
      <defs>
        <linearGradient id={`${id}r`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#FFF1B5" />
          <stop offset="0.45" stopColor="#F2C34E" />
          <stop offset="1" stopColor="#A86A12" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0.2" y1="0.05" x2="0.8" y2="0.95">
          <stop offset="0" stopColor="#C98A22" />
          <stop offset="0.55" stopColor="#EDB943" />
          <stop offset="1" stopColor="#FFE08A" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#6E4508" />
      <circle cx="32" cy="32" r="29.6" fill={`url(#${id}r)`} />
      <circle cx="32" cy="32" r="23.2" fill="#8A5A10" opacity="0.55" />
      <circle cx="32" cy="32" r="22.2" fill={`url(#${id}f)`} />
      <g fillRule="evenodd" transform="translate(-0.5 0)">
        <path d={P} fill="#FFF3C4" transform="translate(0.9 1.1)" />
        <path d={P} fill="#7A4A0A" />
      </g>
      <path d="M12 22 A22 22 0 0 1 26 9.5" stroke="#FFFBE6" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" />
    </svg>
  );
}
