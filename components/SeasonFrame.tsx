"use client";

import { ReactNode } from "react";
import { useUser } from "@/lib/UserContext";
import { ActiveFrame, getActiveFrame } from "@/lib/seasonPass";
import { useHeaderCache } from "@/lib/headerCache";

// Rahmen ums eigene Profilbild – zeigt den im Profil gewählten Rahmen
// (Einstellungen -> Pass-Belohnungen), sonst automatisch die höchste
// freigeschaltete Stufe (siehe lib/seasonPass.ts). Ohne Rahmen wird einfach
// nur children gezeigt – diese Komponente ist also überall dort einsetzbar,
// wo bisher schon ein Avatar gerendert wird, ohne dass sich am Layout etwas
// ändert.
export default function SeasonFrame({
  size,
  children,
}: {
  size: number;
  children: ReactNode;
}) {
  const { passXP, hasPremiumPass, customFrameColors, passDisplay, sessionChecked, authUserId, profileLoaded, extrasLoaded } =
    useUser();
  // Eingeloggt, aber Konto noch nicht geladen: Rahmen vom letzten Besuch
  // (lib/headerCache.ts) statt des Demo-Werts, sonst springt er gleich um.
  const cache = useHeaderCache();
  const loading = sessionChecked ? authUserId !== null && !(profileLoaded && extrasLoaded) : cache !== null;
  const frame = !loading
    ? getActiveFrame(passXP, hasPremiumPass, customFrameColors, passDisplay.frame)
    : cache && cache.passXP !== undefined
      ? getActiveFrame(cache.passXP, cache.premium ?? false, cache.frameColors ?? null, cache.frameChoice ?? undefined)
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

// Rahmen eines ANDEREN Spielers um seinen Kreis (Chat, Rangliste,
// Spielerseite). Bleibt genau so groß wie der Kreis ohne Rahmen, damit sich
// nichts verschiebt: der Kreis wird dafür etwas kleiner.
export function OtherFrameRing({
  frame,
  size,
  children,
}: {
  frame: Pick<ActiveFrame, "colorFrom" | "colorTo" | "animated" | "label"> | null | undefined;
  size: number;
  /** Bekommt die Größe des Kreises innerhalb des Rahmens. */
  children: (innerSize: number) => ReactNode;
}) {
  if (!frame) return <>{children(size)}</>;
  const ring = size >= 48 ? 3 : 2;
  return (
    <span
      title={`Rahmen: ${frame.label}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${frame.animated ? "animate-frame-pulse" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${frame.colorFrom}, ${frame.colorTo})`,
        width: size,
        height: size,
        padding: ring,
      }}
    >
      {children(size - ring * 2)}
    </span>
  );
}
