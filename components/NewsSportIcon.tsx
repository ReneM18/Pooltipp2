import { NEWS_SPORT_ICONS, NEWS_SPORTS, NewsSport } from "@/lib/types";

// Für MotoGP und Darts gibt es kein passendes Emoji (🏍️ ist ein normales
// Motorrad, 🎯 eine Zielscheibe). Darum zeichnen wir dort eigene kleine
// Symbole: ein Rennmotorrad mit Fahrer in Rennhaltung und einen Dartpfeil.
// Sie sind 1em groß und sitzen wie ein Emoji in der Textzeile, passen sich
// also automatisch der Schriftgröße an (Laufband, Artikel, Admin, Feed).
function MotoGPIcon() {
  return (
    <svg viewBox="0 0 32 32" width="1.15em" height="1.15em" aria-hidden className="inline-block shrink-0 align-[-0.2em]">
      {/* Räder */}
      <circle cx="7" cy="23.5" r="4.8" fill="#2b3137" stroke="#5f6870" strokeWidth="0.9" />
      <circle cx="7" cy="23.5" r="2.6" fill="none" stroke="#a9b1b8" strokeWidth="1.2" />
      <circle cx="26" cy="23.5" r="4.8" fill="#2b3137" stroke="#5f6870" strokeWidth="0.9" />
      <circle cx="26" cy="23.5" r="2.6" fill="none" stroke="#a9b1b8" strokeWidth="1.2" />
      {/* Schwinge und Gabel */}
      <path d="M7 23.5 L14.5 20.5" stroke="#5b6168" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M26 23.5 L24.2 15" stroke="#5b6168" strokeWidth="1.8" strokeLinecap="round" />
      {/* Verkleidung mit hohem, spitzem Heck */}
      <path d="M2 12.5 L10 15 L14 15.2 L19 12.6 L25 11.2 L31 15.6 L28.5 19 L21 22.3 L13.5 22.3 L10.5 18.2 L2.5 14.6 Z" fill="#e10600" />
      <path d="M19 12.6 L25 11.2 L31 15.6 L29.8 16.6 L23 14.6 Z" fill="#ff5a47" />
      {/* Startnummer-Feld */}
      <ellipse cx="26.6" cy="17.3" rx="1.9" ry="1.5" fill="#ffffff" />
      {/* Windschild */}
      <path d="M24.4 11.4 L27.4 9.4 L29.2 13.6 Z" fill="#8fd3ff" opacity="0.9" />
      {/* Fahrer flach auf dem Tank */}
      <path d="M10.5 14.8 C12 10.6 17 8.6 22 10.2 L23.5 12.4 L19 13.4 L14 15.4 Z" fill="#2a3540" />
      <circle cx="23.4" cy="10.4" r="2.9" fill="#f4f4f4" />
      <path d="M23.8 9.2 L26.3 10 L26 11.4 L23.6 11.1 Z" fill="#1f2326" />
    </svg>
  );
}

function DartIcon() {
  return (
    <svg viewBox="0 0 32 32" width="1.15em" height="1.15em" aria-hidden className="inline-block shrink-0 align-[-0.2em]">
      {/* waagrecht gezeichnet, dann so gedreht, dass die Spitze nach rechts oben zeigt */}
      <g transform="rotate(-45 16 16)">
        {/* Flights */}
        <path d="M0.5 16 L1.5 9.2 L9.5 15 Z" fill="#e10600" />
        <path d="M0.5 16 L1.5 22.8 L9.5 17 Z" fill="#b30500" />
        {/* Schaft */}
        <rect x="7.5" y="14.9" width="7" height="2.2" rx="0.5" fill="#2a2f35" />
        {/* Barrel mit Rändelung */}
        <rect x="13.5" y="13.4" width="9.5" height="5.2" rx="2.2" fill="#c9a24a" />
        <path d="M15.6 13.7 V18.3 M17.6 13.4 V18.6 M19.6 13.4 V18.6 M21.6 13.7 V18.3" stroke="#8a6a24" strokeWidth="0.7" />
        {/* Spitze */}
        <path d="M22.8 15 L31.5 16 L22.8 17 Z" fill="#d7dde2" />
      </g>
    </svg>
  );
}

export default function NewsSportIcon({ sport }: { sport: NewsSport }) {
  if (sport === "MotoGP") return <MotoGPIcon />;
  if (sport === "Darts") return <DartIcon />;
  return <>{NEWS_SPORT_ICONS[sport]}</>;
}

// Feed-Einträge speichern ihr Symbol als Text (Emoji). Neue News zu MotoGP
// und Darts legen dort 🏍️ bzw. 🎯 ab; beides kommt im Feed sonst nicht vor,
// darum zeigen wir an dieser Stelle die eigenen Symbole.
export function ActivityIcon({ icon }: { icon: string }) {
  if (icon === NEWS_SPORT_ICONS.MotoGP) return <MotoGPIcon />;
  if (icon === NEWS_SPORT_ICONS.Darts) return <DartIcon />;
  return <>{icon}</>;
}

// Sportart-Auswahl für News im Admin. Eine normale Auswahlliste (<select>)
// kann nur Text anzeigen, dort wären die eigenen Symbole nicht zu sehen.
// Darum Knöpfe zum Antippen, die auf dem Handy automatisch umbrechen.
export function NewsSportPicker({
  value,
  onChange,
  small = false,
}: {
  value: NewsSport | "";
  onChange: (sport: NewsSport | "") => void;
  small?: boolean;
}) {
  const options: (NewsSport | "")[] = ["", ...NEWS_SPORTS];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sportart">
      {options.map((s) => {
        const active = value === s;
        return (
          <button
            key={s || "allgemein"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold transition-colors ${
              small ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
            } ${
              active
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-pitch text-muted hover:border-gold/50 hover:text-ink"
            }`}
          >
            {s ? (
              <>
                <span className={small ? "text-sm" : "text-base"}>
                  <NewsSportIcon sport={s} />
                </span>
                {s}
              </>
            ) : (
              "Allgemein"
            )}
          </button>
        );
      })}
    </div>
  );
}
