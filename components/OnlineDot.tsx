"use client";

import { useOnline } from "@/lib/OnlineContext";

// Grüner Punkt unten rechts am Profilbild, wenn der Spieler gerade online ist
// (lib/OnlineContext.tsx). Das Profilbild muss in einem "relative"-Rahmen
// stehen.
export default function OnlineDot({ userId, size = 12 }: { userId: string | null | undefined; size?: number }) {
  const { isOnline } = useOnline();
  if (!isOnline(userId)) return null;
  return (
    <span
      className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-[#3FCF6E]"
      style={{ width: size, height: size }}
      title="Gerade online"
      aria-label="Gerade online"
    />
  );
}
