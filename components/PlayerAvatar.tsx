// Spieler-Bild mit Anfangsbuchstaben für andere Spieler (Chat, Freunde,
// Rangliste, Spieler-Seite). Jede Person bekommt aus ihrer ID immer dieselbe
// gedämpfte Farbe, damit man sie überall auf einen Blick wiedererkennt.
// Das eigene Profilbild mit Foto und Pass-Rahmen bleibt davon unberührt.

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
