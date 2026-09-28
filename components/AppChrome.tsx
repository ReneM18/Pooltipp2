"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import NewsTicker from "./NewsTicker";
import NavTabs from "./NavTabs";
import ChatWidget from "./ChatWidget";
import OnboardingTour from "./OnboardingTour";
import Footer from "./Footer";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTeamsArea = pathname?.startsWith("/teams");

  if (isTeamsArea) {
    // Der Teams-Bereich hat sein eigenes Layout/Navigation (siehe app/teams/layout.tsx)
    return <>{children}</>;
  }

  return (
    <>
      {/* Logo-Leiste, News-Ticker und Menüleiste als EIN gemeinsamer, fest
          angehefteter Block – vorher war nur die Logo-Leiste sticky, dadurch
          "verschwand" die Menüleiste beim Scrollen unter ihr und wirkte
          instabil. So bleibt die ganze Kopfzeile immer an derselben Stelle. */}
      <div className="sticky top-0 z-20">
        <Navbar />
        <NewsTicker />
        <NavTabs />
      </div>
      {/* pb-24: reserviert unten Platz, damit der schwebende Chat-Button
          nicht über den letzten Inhalt/Footer ragt. */}
      <div className="pb-24">
        {children}
        <Footer />
      </div>
      <ChatWidget />
      <OnboardingTour />
    </>
  );
}
