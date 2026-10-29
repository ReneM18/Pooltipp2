import { supabase } from "@/lib/supabaseClient";

// Freunde per Link einladen (supabase/freunde-einladen.sql). Wer den Link
// öffnet, ist sofort mit dem Einladenden befreundet. Muss man sich erst
// registrieren oder einloggen, merkt sich der Browser den Code so lange
// (siehe FriendInviteCatcher).
const KEY = "pooltipp_friend_invite";

export function friendInviteLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/einladung?code=${encodeURIComponent(code)}`;
}

export function friendInviteText(code: string): string {
  return `⚽ Tipp mit mir bei PoolTipp! Über diesen Link sind wir gleich Freunde und können gegeneinander tippen:\n\n${friendInviteLink(code)}`;
}

export function readPendingFriendInvite(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function savePendingFriendInvite(code: string) {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Speicher blockiert (z. B. privates Fenster) – dann eben ohne Merken.
  }
}

export function clearPendingFriendInvite() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignorieren
  }
}

export type InviteResult = { relation: "friend" | "already" | "self" } | { error: string };

export async function acceptFriendInvite(code: string): Promise<InviteResult> {
  const { data, error } = await supabase.rpc("accept_friend_invite", { p_code: code });
  if (error) {
    // Eigene Meldungen aus dem Skript durchreichen, sonst etwas Allgemeines.
    const own = /Einladung/.test(error.message);
    return { error: own ? error.message : "Das hat gerade nicht geklappt. Versuch es nochmal." };
  }
  return { relation: data as "friend" | "already" | "self" };
}
