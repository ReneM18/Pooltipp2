"use client";

import { usePlayerPhoto } from "@/lib/playerPhotos";

// Spieler-Bild mit Anfangsbuchstaben für andere Spieler (Chat, Freunde,
// Rangliste, Spieler-Seite). Jede Person bekommt aus ihrer ID immer dieselbe
// gedämpfte Farbe, damit man sie überall auf einen Blick wiedererkennt.
// Hat jemand ein Profilfoto (und darf man es sehen), steht stattdessen das
// Foto im Kreis – auch beim eigenen Konto (lib/playerPhotos.ts).

export function avatarHue(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
  hash ^= hash >>> 13;
  return (hash >>> 0) % 360;
}

export default function PlayerAvatar({
  id,
  name,
  size = 40,
  className = "",
}: {
  id: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const hue = avatarHue(id || name);
  const photo = usePlayerPhoto(id);
  if (photo) {
    return (
      <span
        className={`flex shrink-0 overflow-hidden rounded-full bg-surface ${className}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={`Profilbild von ${name}`} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(${hue} 38% 26%)`,
        color: `hsl(${hue} 70% 82%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 45% 40% / 0.6)`,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
