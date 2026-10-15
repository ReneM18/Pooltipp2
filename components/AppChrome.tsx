"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import NewsTicker from "./NewsTicker";
import NavTabs from "./NavTabs";
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

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTeamsArea = pathname?.startsWith("/teams");

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
          [transform:translateZ(0)] zwingt den Block auf eine eigene
          GPU-Ebene – ohne das neigt position:sticky in Kombination mit dem
          seitlichen Wischen der Menüleiste direkt darunter auf dem Handy
          (v. a. iOS Safari) zu sichtbarem vertikalen Ruckeln/"Schwimmen". */}
      <div className="sticky top-0 z-20 [transform:translateZ(0)]" data-pull-anchor>
        <Navbar />
        <NewsTicker />
        <NavTabs />
      </div>
      {/* pb-36 (Handy) / pb-24 (lg:): reserviert unten Platz, damit die
          feste Leiste unten und der schwebende Chat-Button nicht über den
          letzten Inhalt/Footer ragen. */}
      {/* Saison-Design: verblasste Blätter hinter der ganzen Seite. */}
      <SeasonBackdrop />
      <div className="pb-[calc(9rem+var(--safe-bottom))] lg:pb-24" data-swipe-root>
        <SeasonDesignGate />
        <EventDayClaim />
        {children}
        <Footer />
      </div>
      <ChatWidget />
      {/* Tor-Hinweis bei getippten Live-Spielen (Rene, 15.10.2026: Spieltag-Umbau). */}
      <GoalToastHost />
      {/* Handy/Tablet: feste Leiste unten (ersetzt dort die Menüleiste oben). */}
      <BottomNav />
      {/* Neue Spieler haben auf /start ihr eigenes Start-Erlebnis. */}
      <PullToRefresh />
      <SwipeNav />
      <StartPageRedirect />
    </>
  );
}
