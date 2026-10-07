"use client";

import { useUser } from "@/lib/UserContext";
import { DEFAULT_START_PAGE } from "@/lib/startPage";

/** Ziel fürs Logo und "Weiter/Zurück zu PoolTipp": die im Profil gewählte
 *  Startseite, für Gäste und solange nichts geladen ist die Tipps-Seite
 *  (siehe lib/startPage.ts). */
export function useStartHref(): string {
  const { authUserId, startPage } = useUser();
  return authUserId && startPage ? startPage : DEFAULT_START_PAGE;
}
