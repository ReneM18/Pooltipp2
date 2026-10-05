"use client";

// Eigener Gesamtplatz für die Kopfzeile: gleiche Rechnung wie der Tab
// "Gesamt" auf der Rangliste (Summe der Rangpunkte aller Sportarten, gleiche
// Punkte = gleicher Platz). Die eigenen Punkte kommen live aus dem Browser,
// die der anderen Spieler aus der "profiles"-Tabelle.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useResumeTick } from "@/lib/appRefresh";
import { useUser } from "@/lib/UserContext";
import { loadProfiles, sumPoints, toPointsBySport } from "@/lib/globalLeaderboard";

export type MyOverallRank =
  | { status: "loading" }
  // Nicht eingeloggt, noch keine Rangpunkte oder Datenbank nicht erreichbar.
  | { status: "none"; reason: "guest" | "noPoints" | "error" }
  | { status: "ranked"; rank: number; players: number };

export function useMyOverallRank(): MyOverallRank {
  const { authUserId, profileLoaded, rangPunkte } = useUser();
  const pathname = usePathname();
  const myTotal = sumPoints(rangPunkte);
  // Gesamtpunkte der anderen Spieler (null = noch nicht geladen / Fehler).
  const [others, setOthers] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const resumeTick = useResumeTick();

  // Neu laden beim Seitenwechsel und wenn sich die eigenen Punkte ändern
  // (dann haben sich oft auch andere Spieler bewegt) – und beim Zurückkehren
  // in die App.
  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    (async () => {
      const result = await loadProfiles(() => cancelled);
      if (cancelled) return;
      if ("error" in result) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setOthers(
        result.rows
          .filter((row) => row.id !== authUserId)
          .map((row) => sumPoints(toPointsBySport(row.rang_punkte)))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [authUserId, pathname, myTotal, resumeTick]);

  if (!authUserId) return { status: "none", reason: "guest" };
  if (!profileLoaded) return { status: "loading" };
  // Ohne eigene Rangpunkte gibt es noch keinen echten Platz (sonst stünden
  // am Anfang alle gemeinsam auf Platz 1).
  if (myTotal <= 0) return { status: "none", reason: "noPoints" };
  if (others === null) return failed ? { status: "none", reason: "error" } : { status: "loading" };
  const rank = 1 + others.filter((points) => points > myTotal).length;
  return { status: "ranked", rank, players: others.length + 1 };
}
