"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/UserContext";
import { useHeaderCache } from "@/lib/headerCache";

// Profilbilder ANDERER Spieler (Chat, Rangliste, Spielerseite, Freunde,
// "wer hat getippt"). Kommen aus supabase/profilfoto-fuer-alle.sql
// (player_photos): nur das erste Foto und nur, wenn der Besitzer es erlaubt
// (Öffentlich = alle, Nur für Freunde = Freunde).
// Alle Kreise auf einer Seite werden gesammelt in EINER Abfrage geladen und für
// die Sitzung gemerkt. Ändert jemand sein Foto (oder die Sichtbarkeit), meldet
// player_photo_stamps das sofort und alle offenen Geräte laden es neu.
// Für die eigene ID gilt immer das eigene, aktuelle Foto aus dem Profil.
// Fehlt das SQL noch, bleibt es still beim Anfangsbuchstaben.

const cache = new Map<string, string | null>();
const queued = new Set<string>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let unavailable = false;
let channelStarted = false;
// Konto + Freundesliste, für die die gemerkten Fotos gelten.
let accessKey: string | null = null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notify() {
  listeners.forEach((l) => l());
}

async function flush() {
  timer = null;
  const ids = Array.from(queued);
  queued.clear();
  if (ids.length === 0 || unavailable) return;
  ids.forEach((id) => loading.add(id));
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data, error } = await supabase.rpc("player_photos", { p_ids: chunk });
    chunk.forEach((id) => loading.delete(id));
    if (error) {
      // Funktion fehlt (SQL noch nicht ausgeführt): nicht weiter fragen.
      if (/player_photos|function|schema cache/i.test(error.message)) unavailable = true;
      continue;
    }
    const found = new Map<string, string>();
    for (const row of (data ?? []) as { id: string; photo: string | null }[]) {
      if (typeof row.photo === "string" && row.photo.startsWith("data:image/")) found.set(row.id, row.photo);
    }
    for (const id of chunk) cache.set(id, found.get(id) ?? null);
  }
  notify();
}

function request(ids: string[]) {
  let added = false;
  for (const id of ids) {
    if (cache.has(id) || queued.has(id) || loading.has(id)) continue;
    queued.add(id);
    added = true;
  }
  if (added && !timer) timer = setTimeout(() => void flush(), 30);
}

/** Alles neu laden, was schon angezeigt wurde (z. B. neue Freundschaft). */
function reloadAll() {
  const ids = Array.from(cache.keys());
  cache.clear();
  request(ids);
}

function startLiveUpdates() {
  if (channelStarted || typeof window === "undefined") return;
  channelStarted = true;
  supabase
    .channel("player_photo_stamps_live")
    .on("postgres_changes", { event: "*", schema: "public", table: "player_photo_stamps" }, (payload) => {
      const id = (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id;
      if (!id || !cache.has(id)) return;
      cache.delete(id);
      request([id]);
    })
    .subscribe();
}

/** Profilbilder zu den IDs (fehlt eine ID = kein Foto bzw. nicht sichtbar). */
export function usePlayerPhotos(userIds: (string | null | undefined)[]): Record<string, string> {
  const [, forceUpdate] = useState(0);
  const { authUserId, photos, friendEntries, extrasLoaded } = useUser();
  const headerCache = useHeaderCache();
  const key = Array.from(new Set(userIds.filter((id): id is string => !!id && UUID.test(id))))
    .sort()
    .join(",");

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    startLiveUpdates();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (key) request(key.split(",").filter((id) => id !== authUserId));
  }, [key, authUserId]);

  // Neue oder beendete Freundschaft bzw. Konto-Wechsel: "Nur für Freunde"-
  // Fotos können jetzt sichtbar oder verborgen sein.
  const friendKey = friendEntries
    .filter((f) => f.relation === "friend")
    .map((f) => f.id)
    .sort()
    .join(",");
  useEffect(() => {
    const k = `${authUserId}|${friendKey}`;
    if (accessKey === k) return;
    const first = accessKey === null;
    accessKey = k;
    if (!first) reloadAll();
  }, [authUserId, friendKey]);

  // Eigenes Foto: sobald das Konto geladen ist das aktuelle, davor das vom
  // letzten Besuch (wie oben in der Kopfzeile).
  const myPhoto = extrasLoaded ? photos[0] : headerCache?.photo ?? null;

  const result: Record<string, string> = {};
  for (const id of key ? key.split(",") : []) {
    if (id === authUserId) {
      if (myPhoto) result[id] = myPhoto;
      continue;
    }
    const photo = cache.get(id);
    if (photo) result[id] = photo;
  }
  return result;
}

/** Profilbild eines Spielers (oder null). */
export function usePlayerPhoto(userId: string | null | undefined): string | null {
  return usePlayerPhotos([userId])[userId ?? ""] ?? null;
}
