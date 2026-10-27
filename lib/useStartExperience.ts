"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { readPendingInvite } from "@/lib/leagueInvite";

/** Neu registriert (noch kein Tipp, Start-Erlebnis weder fertig noch
 *  übersprungen): einmal zum Start-Erlebnis. Nicht, wenn man gerade über
 *  einen Tipprunden-Link kommt. Läuft auf jeder Seite, die Startseite sein
 *  kann (Tipps, Matchcenter), damit neue Spieler es nie verpassen. */
export function useStartExperience() {
  const { isRegistered, startDone } = useUser();
  const { myTips, myTipsLoaded } = useAppData();
  const router = useRouter();
  useEffect(() => {
    if (!isRegistered || startDone !== false || !myTipsLoaded || myTips.length > 0) return;
    if (readPendingInvite()) return;
    router.replace("/start");
  }, [isRegistered, startDone, myTipsLoaded, myTips.length, router]);
}
