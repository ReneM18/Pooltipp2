"use client";

import { useState } from "react";
import { RankIconOption } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";

// Interaktive Variante von RankBadge – sieht genauso aus (Icon in Farbverlauf-
// Abzeichen), zeigt die Bedeutung (Label + Rang-Titel) aber nicht permanent
// als Text daneben, sondern erst bei Hover (Desktop) bzw. Antippen (Handy)
// als kleines Popup. Ersetzt RankBadge an den Stellen, an denen die
// Bedeutung vorher zusätzlich ausgeschrieben war – das Icon gibt es also nur
// noch EINMAL, nicht mehr doppelt (einmal am Profilbild, einmal als Text-Pille
// daneben).
export default function RankMeaningBadge({
  option,
  size = "md",
  className = "",
  popupAlign = "left",
}: {
  option: RankIconOption;
  size?: "2xs" | "xs" | "sm" | "md" | "lg";
  className?: string;
  popupAlign?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        aria-label={`Rang-Icon: ${option.label}${option.title ? ` · ${option.title}` : ""}`}
        className="block"
      >
        <RankBadge option={option} size={size} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`absolute top-full z-20 mt-1.5 whitespace-nowrap rounded-lg border border-edge bg-pitch px-3 py-1.5 text-xs font-semibold text-ink shadow-lg ${
            popupAlign === "right" ? "right-0" : "left-0"
          }`}
        >
          {option.label}
          {option.title && <span className="ml-1 opacity-70">· {option.title}</span>}
        </div>
      )}
    </span>
  );
}
