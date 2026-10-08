"use client";

// Kopfzeile ohne Warten: Coins, Platz, Profilbild und Rang-Abzeichen vom
// letzten Besuch werden beim Öffnen der App sofort gezeigt und still durch die
// frischen Werte aus der Datenbank ersetzt, sobald die da sind.
//
// Nur ANZEIGE-Zwischenspeicher auf diesem Gerät: Daraus wird nie etwas in die
// Datenbank geschrieben und nie gerechnet. Quelle der Wahrheit bleibt das
// Konto (my_wallet, profile_extras, Rangliste) samt Sofort-Abgleich.
// Gilt nur, solange genau dieses Konto in diesem Browser eingeloggt ist
// (Supabase speichert die Sitzung unter "sb-…-auth-token").

import { useEffect, useLayoutEffect, useState } from "react";
import type { Sport } from "@/lib/types";
import type { PrestigeBySport } from "@/lib/rankTiers";

const STORAGE_KEY = "pooltipp:kopfzeile";

export interface HeaderCache {
  userId: string;
  coins?: number;
  name?: string;
  rangPunkte?: Record<Sport, number>;
  prestige?: PrestigeBySport;
  rankIconId?: string | null;
  photo?: string | null;
  rank?: number | null;
  passXP?: number;
  premium?: boolean;
  frameColors?: { from: string; to: string } | null;
  isAdmin?: boolean;
}

/** ID des Kontos, dessen Sitzung in diesem Browser gespeichert ist. */
function storedSessionUserId(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && /^sb-.*-auth-token$/.test(key)) {
      const token = JSON.parse(localStorage.getItem(key) || "null");
      return token?.user?.id ?? null;
    }
  }
  return null;
}

export function readHeaderCache(): HeaderCache | null {
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as HeaderCache | null;
    if (!cache?.userId || cache.userId !== storedSessionUserId()) return null;
    return cache;
  } catch {
    return null;
  }
}

/** Ergänzt die gemerkten Werte des Kontos (andere Konten werden ersetzt). */
export function writeHeaderCache(userId: string, values: Omit<HeaderCache, "userId">) {
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as HeaderCache | null;
    const next = { ...(old?.userId === userId ? old : {}), ...values, userId };
    const text = JSON.stringify(next);
    if (text === localStorage.getItem(STORAGE_KEY)) return;
    try {
      localStorage.setItem(STORAGE_KEY, text);
    } catch {
      // Speicher voll (großes Foto): ohne Foto merken.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, photo: undefined }));
    }
  } catch {
    // nicht speicherbar: dann eben ohne Vorschau beim nächsten Öffnen
  }
}

export function clearHeaderCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // egal
  }
}

// Vor dem ersten Zeichnen lesen, damit kein leerer Zwischenstand aufblitzt
// (auf dem Server gibt es keinen Speicher, dort bleibt es beim normalen Effekt).
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Gemerkte Kopfzeilen-Werte, einmal beim Öffnen gelesen. */
export function useHeaderCache(): HeaderCache | null {
  const [cache, setCache] = useState<HeaderCache | null>(null);
  useBeforePaint(() => {
    setCache(readHeaderCache());
  }, []);
  return cache;
}
