"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { DEFAULT_START_PAGE, finishStartSession, readStartSession } from "@/lib/startPage";

// Gewählte Startseite, wenn das Skript im <head> sie noch nicht kannte
// (erstes Öffnen auf einem neuen Gerät bzw. nach dem Einloggen): sobald das
// Konto sie geladen hat, einmal hinwechseln. Nur solange man noch auf der
// Hauptadresse steht, nichts angeklickt hat und die App gerade erst geöffnet
// wurde, sonst würde die Seite unter den Fingern wechseln. Siehe
// lib/startPage.ts.
const MAX_WAIT_MS = 8000;

export default function StartPageRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionChecked, authUserId, startPage } = useUser();
  const firstPathRef = useRef(pathname);

  useEffect(() => {
    if (readStartSession() !== "offen") return;
    if (pathname !== "/" || firstPathRef.current !== "/" || window.location.search) {
      finishStartSession();
      return;
    }
    if (!sessionChecked) return;
    if (!authUserId) {
      finishStartSession();
      return;
    }
    if (startPage === null) return;
    finishStartSession();
    if (startPage !== DEFAULT_START_PAGE && performance.now() < MAX_WAIT_MS) router.replace(startPage);
  }, [pathname, sessionChecked, authUserId, startPage, router]);

  return null;
}
