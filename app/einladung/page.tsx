"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { supabase } from "@/lib/supabaseClient";
import {
  acceptFriendInvite,
  clearPendingFriendInvite,
  savePendingFriendInvite,
} from "@/lib/friendInvite";

// Freundes-Einladungslink /einladung?code=... (supabase/freunde-einladen.sql).
// Eingeloggt: sofort befreundet. Sonst Name des Einladenden zeigen, Code
// merken und zum Registrieren schicken; danach geht es hierher zurück.

type Inviter = { id: string; name: string; number: number };
type Outcome = "friend" | "already" | "self" | { error: string };

const PRIMARY =
  "block w-full rounded-full bg-action px-5 py-3 text-center font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover";
const SECONDARY =
  "block w-full rounded-full border border-edge px-5 py-3 text-center text-sm font-semibold text-muted transition-colors hover:border-gold/60 hover:text-ink";

export default function EinladungPage() {
  const { sessionChecked, authUserId } = useUser();
  const { celebrate } = useFeedback();
  const [code, setCode] = useState<string | null>(null);
  // undefined = lädt noch, null = Link gilt nicht
  const [inviter, setInviter] = useState<Inviter | null | undefined>(undefined);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() ?? "";
    setCode(fromUrl);
    if (!fromUrl) {
      setInviter(null);
      return;
    }
    supabase.rpc("friend_invite_info", { p_code: fromUrl }).then(({ data }) => {
      const row = (data as { inviter_id: string; display_name: string; user_number: number }[] | null)?.[0];
      setInviter(row ? { id: row.inviter_id, name: row.display_name, number: row.user_number } : null);
    });
  }, []);

  // Ohne Konto: Code merken, bis man registriert bzw. eingeloggt ist.
  useEffect(() => {
    if (sessionChecked && !authUserId && inviter && code) savePendingFriendInvite(code);
  }, [sessionChecked, authUserId, inviter, code]);

  // Eingeloggt: Einladung gleich annehmen.
  useEffect(() => {
    if (!authUserId || !inviter || !code || acceptedRef.current) return;
    acceptedRef.current = true;
    acceptFriendInvite(code).then((result) => {
      clearPendingFriendInvite();
      setOutcome("error" in result ? result : result.relation);
      if (!("error" in result) && result.relation === "friend") celebrate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, inviter, code]);

  let body;
  if (inviter === undefined || !sessionChecked || (authUserId && inviter && outcome === null)) {
    body = <p className="text-sm text-muted">Lädt…</p>;
  } else if (inviter === null) {
    body = (
      <>
        <p className="text-4xl">🔗</p>
        <h1 className="mt-3 font-display text-xl font-bold text-ink">Link ungültig</h1>
        <p className="mt-2 text-sm text-muted">
          Dieser Einladungslink gilt nicht (mehr). Frag nach einem neuen Link oder such deine Freunde mit Name oder
          Nummer.
        </p>
        <div className="mt-6 space-y-2">
          <Link href={authUserId ? "/freunde" : "/registrieren?modus=registrieren"} className={PRIMARY}>
            {authUserId ? "Zu deinen Freunden" : "Kostenlos registrieren"}
          </Link>
        </div>
      </>
    );
  } else {
    const head = (
      <div className="flex flex-col items-center">
        <PlayerAvatar id={inviter.id} name={inviter.name} size={72} />
        <p className="mt-2 text-xs text-muted">#{inviter.number}</p>
      </div>
    );
    if (!authUserId) {
      body = (
        <>
          {head}
          <h1 className="mt-3 break-words font-display text-xl font-bold text-ink">
            {inviter.name} lädt dich zu PoolTipp ein
          </h1>
          <p className="mt-2 text-sm text-muted">
            Tippe Spiele gegen deine Freunde und sammle Punkte. Registriere dich kostenlos, dann seid ihr gleich
            Freunde.
          </p>
          <div className="mt-6 space-y-2">
            <Link href="/registrieren?modus=registrieren" className={PRIMARY}>
              Kostenlos registrieren
            </Link>
            <Link href="/registrieren" className={SECONDARY}>
              Ich habe schon ein Konto
            </Link>
          </div>
        </>
      );
    } else {
      const title =
        outcome === "friend"
          ? `Du und ${inviter.name} seid jetzt Freunde`
          : outcome === "already"
            ? `Du und ${inviter.name} seid schon Freunde`
            : outcome === "self"
              ? "Das ist dein eigener Einladungslink"
              : "Hat nicht geklappt";
      const text =
        outcome === "self"
          ? "Schick ihn an Freunde, zum Beispiel per WhatsApp. Wer ihn öffnet, ist gleich mit dir befreundet."
          : typeof outcome === "object" && outcome
            ? outcome.error
            : "Ab jetzt könnt ihr euch schreiben und zu Duellen herausfordern.";
      body = (
        <>
          {outcome === "self" ? <p className="text-4xl">🔗</p> : head}
          <h1 className="mt-3 break-words font-display text-xl font-bold text-ink">
            {outcome === "friend" && "🤝 "}
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted">{text}</p>
          <div className="mt-6 space-y-2">
            <Link href="/freunde" className={PRIMARY}>
              Zu deinen Freunden
            </Link>
            {outcome !== "self" && (
              <Link href="/" className={SECONDARY}>
                Jetzt tippen
              </Link>
            )}
          </div>
        </>
      );
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="rounded-card border border-gold/40 bg-surface p-6 text-center">{body}</div>
    </main>
  );
}
