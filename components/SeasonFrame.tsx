"use client";

import { ReactNode } from "react";
import { useUser } from "@/lib/UserContext";
import { getActiveFrame } from "@/lib/seasonPass";
import { useHeaderCache } from "@/lib/headerCache";

// Rahmen ums Profilbild – zeigt automatisch die höchste freigeschaltete
// Stufe (siehe lib/seasonPass.ts: Gratis-Farbstufe, oder mit Premium den
// animierten Neon-Pulse- bzw. den frei gemischten Rahmen). Ohne
// freigeschaltete Stufe wird einfach nur children ohne Rahmen gezeigt –
// diese Komponente ist also überall dort einsetzbar, wo bisher schon ein
// Avatar gerendert wird, ohne dass sich am Layout etwas ändert.
export default function SeasonFrame({
  size,
  children,
}: {
  size: number;
  children: ReactNode;
}) {
  const { passXP, hasPremiumPass, customFrameColors, sessionChecked, authUserId, profileLoaded, extrasLoaded } =
    useUser();
  // Eingeloggt, aber Konto noch nicht geladen: Rahmen vom letzten Besuch
  // (lib/headerCache.ts) statt des Demo-Werts, sonst springt er gleich um.
  const cache = useHeaderCache();
  const loading = sessionChecked ? authUserId !== null && !(profileLoaded && extrasLoaded) : cache !== null;
  const frame = !loading
    ? getActiveFrame(passXP, hasPremiumPass, customFrameColors)
    : cache && cache.passXP !== undefined
      ? getActiveFrame(cache.passXP, cache.premium ?? false, cache.frameColors ?? null)
      : null;

  if (!frame) return <>{children}</>;

  return (
    <span
      title={frame.label}
      className={`inline-flex shrink-0 rounded-full p-[3px] ${frame.animated ? "animate-frame-pulse" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${frame.colorFrom}, ${frame.colorTo})`,
        width: size + 6,
        height: size + 6,
      }}
    >
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-pitch">
        {children}
      </span>
    </span>
  );
}
