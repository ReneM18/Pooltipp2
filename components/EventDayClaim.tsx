"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/lib/UserContext";
import { useAppRefresh } from "@/lib/appRefresh";
import { HALLOWEEN_2026, eventPhase } from "@/lib/seasons";
import { viennaDateKey } from "@/lib/seasons/schedule";
import { claimEventDay } from "@/lib/eventProgress";

// Kürbis fürs Reinschauen beim Halloween-Event (supabase/halloween-event.sql):
// beim Öffnen der App und wenn sie wieder in den Vordergrund kommt, höchstens
// einmal pro Tag und Gerät angefragt. Die Datenbank zählt ohnehin nur einen
// pro Tag. Zeigt nichts an.
export default function EventDayClaim() {
  const { authUserId } = useUser();
  const doneRef = useRef<string | null>(null);

  async function claim() {
    if (!authUserId) return;
    const now = new Date();
    if (eventPhase(HALLOWEEN_2026, now) !== "laeuft") return;
    const key = `${authUserId}:${viennaDateKey(now)}`;
    if (doneRef.current === key) return;
    doneRef.current = key;
    const result = await claimEventDay(HALLOWEEN_2026);
    if (!result) doneRef.current = null; // z. B. SQL noch nicht gelaufen: später nochmal
  }

  useEffect(() => {
    void claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);
  useAppRefresh(() => claim());

  return null;
}
