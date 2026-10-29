"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { acceptFriendInvite, clearPendingFriendInvite, readPendingFriendInvite } from "@/lib/friendInvite";
import { supabase } from "@/lib/supabaseClient";

// Kam man über einen Freundes-Einladungslink und musste sich erst
// registrieren oder einloggen: Sobald man eingeloggt ist (egal auf welcher
// Seite, z. B. nach dem Link in der Bestätigungsmail), die Einladung
// annehmen und kurz Bescheid geben. Auf der Einladungsseite und beim Einloggen
// nicht: Von dort geht es zur Einladungsseite, die das selbst zeigt.
export default function FriendInviteCatcher() {
  const pathname = usePathname();
  const { authUserId } = useUser();
  const { showToast, celebrate } = useFeedback();
  const doneForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authUserId || doneForRef.current === authUserId) return;
    if (pathname?.startsWith("/einladung") || pathname?.startsWith("/registrieren")) return;
    const code = readPendingFriendInvite();
    if (!code) return;
    doneForRef.current = authUserId;
    (async () => {
      const [result, info] = await Promise.all([
        acceptFriendInvite(code),
        supabase.rpc("friend_invite_info", { p_code: code }),
      ]);
      clearPendingFriendInvite();
      if ("error" in result || result.relation === "self") return;
      const name = (info.data as { display_name: string }[] | null)?.[0]?.display_name;
      if (result.relation === "friend") celebrate();
      showToast(name ? `🤝 Du bist jetzt mit ${name} befreundet` : "🤝 Ihr seid jetzt Freunde", "gold");
    })();
  }, [authUserId, pathname, showToast, celebrate]);

  return null;
}
