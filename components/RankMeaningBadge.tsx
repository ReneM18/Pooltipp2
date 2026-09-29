"use client";

import { useState } from "react";
import { RankIconOption } from "@/lib/rankTiers";

// Zeigt nur noch das Icon (Farbverlauf-Kreis) neben Profilbild/Namen – die
// Bedeutung (Label + Rang-Titel) steht nicht mehr permanent danaben, sondern
// erscheint erst bei Hover (Desktop) bzw. Antippen (Handy) als kleines
// Popup. Die ausführliche Erklärung/Auswahl gibt es schon auf der eigenen
// Profilseite im Reiter "Rang" ("Dein Rang-Icon") – hier reicht der schnelle
// Blick, ohne die Kopfzeile mit Fließtext vollzustellen.
export default function RankMeaningBadge({ option }: { option: RankIconOption }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative mt-2 inline-block">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        aria-label={`Rang-Icon: ${option.label}${option.title ? ` · ${option.title}` : ""}`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-md transition-transform active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo})`,
          color: option.colorText,
        }}
      >
        {option.icon}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute left-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-lg border border-edge bg-pitch px-3 py-1.5 text-xs font-semibold text-ink shadow-lg"
        >
          {option.label}
          {option.title && <span className="ml-1 opacity-70">· {option.title}</span>}
        </div>
      )}
    </span>
  );
}
