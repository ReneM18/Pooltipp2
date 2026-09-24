"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import NewsTicker from "./NewsTicker";
import NavTabs from "./NavTabs";
import ChatWidget from "./ChatWidget";
import OnboardingTour from "./OnboardingTour";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTeamsArea = pathname?.startsWith("/teams");

  if (isTeamsArea) {
    // Der Teams-Bereich hat sein eigenes Layout/Navigation (siehe app/teams/layout.tsx)
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <NewsTicker />
      <NavTabs />
      {children}
      <ChatWidget />
      <OnboardingTour />
    </>
  );
}
