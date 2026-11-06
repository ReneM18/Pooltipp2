"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import NewsTicker from "./NewsTicker";
import { DuelTourButtons } from "./NavTabs";
import BottomNav from "./BottomNav";
import ChatWidget from "./ChatWidget";
import Footer from "./Footer";
import SeasonDesignGate from "./SeasonDesignGate";
import { SeasonBackdrop } from "./SeasonDeco";
import PullToRefresh from "./PullToRefresh";
import SwipeNav from "./SwipeNav";
import StartPageRedirect from "./StartPageRedirect";
import EventDayClaim from "./EventDayClaim";
import { GoalToastHost } from "./GoalToast";
import InstallHint from "./InstallHint";
import FriendInviteCatcher from "./FriendInviteCatcher";

// Seiten, auf denen Duelle + Turniere am PC rechts oben stehen (siehe unten).
const DUEL_TOUR_PAGES = ["/", "/rangliste", "/fortschritt", "/freunde", "/feed", "/duelle", "/turnier", "/shop"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTeamsArea = pathname?.startsWith("/teams");
  const showDuelTour = DUEL_TOUR_PAGES.includes(pathname ?? "");

  if (isTeamsArea) {
    // Der Teams-Bereich hat sein eigenes Layout/Navigation (siehe app/teams/layout.tsx)
    return (
      <>
        <SeasonDesignGate showNotice={false} />
        <EventDayClaim />
        <PullToRefresh />
        {children}
      </>
    );
  }

  return (
    <>
      {/* Logo-Leiste, News-Ticker und Menüleiste als EIN gemeinsamer, fest
          angehefteter Block – vorher war nur die Logo-Leiste sticky, dadurch
          "verschwand" die Menüleiste beim Scrollen unter ihr und wirkte
          instabil. So bleibt die ganze Kopfzeile immer an derselben Stelle.
          Am PC stehen die Reiter seit 06.11.2026 in der Logo-Leiste (Navbar),
          die eigene Menüleiste darunter gibt es nicht mehr (Rene: eine Zeile
          weniger). [transform:translateZ(0)] zwingt den Block auf eine eigene
          GPU-Ebene – ohne das neigt position:sticky in Kombination mit dem
          seitlichen Wischen der Menüleiste direkt darunter auf dem Handy
          (v. a. iOS Safari) zu sichtbarem vertikalen Ruckeln/"Schwimmen". */}
      <div className="sticky top-0 z-20 [transform:translateZ(0)]" data-pull-anchor>
        <Navbar />
        <NewsTicker />
      </div>
      {/* pb-36 (Handy) / pb-24 (lg:): reserviert unten Platz, damit die
          feste Leiste unten und der schwebende Chat-Button nicht über den
          letzten Inhalt/Footer ragen. */}
      {/* Saison-Design: verblasste Blätter hinter der ganzen Seite. */}
      <SeasonBackdrop />
      <div className="pb-[calc(9rem+var(--safe-bottom))] lg:pb-24" data-swipe-root>
        <SeasonDesignGate />
        <EventDayClaim />
        {/* Duelle + Turniere am PC rechts oben, auf Höhe der ersten Zeile
            der Seite (z. B. "Hallo, Rene"), darübergelegt statt in einer
            eigenen leeren Zeile, damit der Inhalt ganz oben anfängt (Rene,
            06.11.2026). Im Matchcenter stehen sie in der Zeile mit den
            Sportarten. Nur auf den Hauptseiten, deren erste Zeile rechts frei
            ist (Profil, Admin usw. haben dort eigene Knöpfe). */}
        {showDuelTour && (
          <div className="relative mx-auto hidden max-w-6xl lg:block">
            <DuelTourButtons className="absolute right-5 top-7 z-10" />
          </div>
        )}
        {children}
        <Footer />
      </div>
      <ChatWidget />
      {/* Tor-Hinweis bei getippten Live-Spielen (Rene, 15.10.2026: Spieltag-Umbau). */}
      <GoalToastHost />
      {/* Handy/Tablet: feste Leiste unten (ersetzt dort die Menüleiste oben). */}
      <BottomNav />
      {/* "PoolTipp als App" am Handy, über der Leiste unten. */}
      <InstallHint />
      {/* Neue Spieler haben auf /start ihr eigenes Start-Erlebnis. */}
      <PullToRefresh />
      <SwipeNav />
      <StartPageRedirect />
      <FriendInviteCatcher />
    </>
  );
}
