// Zentrale, gezeichnete Icons im einheitlichen Stil der App (statt Emojis,
// die je nach Gerät/Browser unterschiedlich aussehen). Sportarten-Icons
// bleiben bewusst als Emoji (⚽🏈🏀🏒) – die sind so weltweit einheitlich
// erkennbar, dass ein eigenes Icon-Set hier keinen Mehrwert hätte.

export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.6l1.4-6.6-5-4.6 6.6-.7L12 2.5z" />
    </svg>
  );
}

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" />
      <path d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3" />
      <path d="M12 13v3M9 20h6M9.5 16h5l.5 2a2 2 0 01-2 2h-2a2 2 0 01-2-2l.5-2z" />
    </svg>
  );
}

export function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009.1 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9.1a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// Fernseher mit Antenne und Standfuß, dicker Strich: klein am Handy gut
// erkennbar (Variante A, von Rene am 08.10.2026 ausgesucht, etwas größer
// Strich auf Wunsch wieder etwas dünner).
// Fernseher mit Play-Dreieck im Bildschirm – für die Highlights-Kachel.
export function HighlightTvIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="7.5" width="19" height="12.5" rx="2.5" />
      <path d="M7.5 2.5 12 7l4.5-4.5" />
      <path d="M10.2 11.2v5.6l4.6-2.8z" fill="currentColor" strokeWidth={1} />
    </svg>
  );
}

export function TvIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2.5" y="7.5" width="19" height="12.5" rx="2.5" />
      <path d="M7.5 2.5 12 7l4.5-4.5" />
      <path d="M8 22.5h8" />
    </svg>
  );
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3,20 C3,16 5.5,14 9,14 C12.5,14 15,16 15,20" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15,20 C15,17 16.5,15.2 19,15.2 C21,15.2 21.5,16.5 21.5,18" />
    </svg>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

export function ThumbUpIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3z" />
      <path d="M7 11l4.5-7a2 2 0 012.9-.6c.7.5 1 1.4.7 2.2L14 9h5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H10a3 3 0 01-3-3v-6z" />
    </svg>
  );
}

export function CartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.5 3h2l2.6 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L21 8H6" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" />
    </svg>
  );
}

// Stadion (Rene, 29.10.2026: buntes Stadion wie auf seinem Beispielbild statt
// des 🏟️-Emojis). Eigene Zeichnung, feste Farben, auf dunklem Grund lesbar.
export function StadiumIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      stroke="#16181c"
      strokeWidth={2.6}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M18 15V3.5M32 15V3.5M46 15V3.5" fill="none" stroke="#c9ccd3" strokeWidth={2.4} />
      <path
        d="M19 3.5h7.5l-2.2 2.6 2.2 2.6H19zM33 3.5h7.5l-2.2 2.6 2.2 2.6H33zM47 3.5h7.5l-2.2 2.6 2.2 2.6H47z"
        fill="#ef4351"
        strokeWidth={1.6}
      />
      <path d="M3.5 29c0-8.5 6.5-15 15-15h27c8.5 0 15 6.5 15 15v15c0 8-6.5 14.5-15 14.5h-27c-8.5 0-15-6.5-15-14.5z" fill="#eceef1" />
      <path d="M4 46.5h56M7.5 52.5h49" fill="none" strokeWidth={2.2} />
      <path d="M3.5 29c0-8.5 6.5-15 15-15h27c8.5 0 15 6.5 15 15s-6.5 13-15 13h-27c-8.5 0-15-4.5-15-13z" fill="#5f646c" />
      <path
        d="M25 14v5.5M39 14v5.5M25 36.5V42M39 36.5V42M7 21l5 3.5M57 21l-5 3.5M7 37.5l5-3M57 37.5l-5-3"
        fill="none"
        strokeWidth={2.2}
      />
      <path d="M11 28.5c0-5.2 3.8-8.5 9-8.5h24c5.2 0 9 3.3 9 8.5s-3.8 8.5-9 8.5H20c-5.2 0-9-3.3-9-8.5z" fill="#f2f3f5" />
      <path d="M15.5 30c0-2 1.5-3.5 3.5-3.5h26c2 0 3.5 1.5 3.5 3.5s-1.5 3-3.5 3H19c-2 0-3.5-1-3.5-3z" fill="#86d04a" />
      <path d="M24.5 58.5V47.5h15v11" fill="#ffffff" />
      <path d="M28.5 58.5v-6.5h7v6.5" fill="#5f646c" strokeWidth={2.2} />
    </svg>
  );
}
