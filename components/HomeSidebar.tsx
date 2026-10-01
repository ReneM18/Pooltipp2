"use client";

// Desktop-Seitenspalte für die Startseite: Duelle, Tipprunden und Turniere
// kompakt auf einen Blick, statt dass auf breiten Bildschirmen neben der
// Tipp-Liste nur leerer Platz steht und man für diese drei Sachen extra
// wegklicken muss. Nur ab lg: sichtbar (siehe Einbindung in app/page.tsx) –
// am Handy bleibt es bei den Pillen oben in der Navigation.
import { ReactNode } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { useDuels } from "@/lib/DuelsContext";
import { useTeams } from "@/lib/TeamsContext";
import { useTournaments } from "@/lib/TournamentContext";
import { getTournamentStatus } from "@/lib/tournamentLeaderboard";
import { StarIcon } from "@/components/Icons";

function SidebarCard({
  title,
  icon,
  accent,
  href,
  children,
}: {
  title: string;
  icon: string;
  accent: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${accent}`}>{icon}</span>
          {title}
        </span>
        <Link href={href} className="text-xs font-semibold text-muted transition-colors hover:text-ink">
          Alle →
        </Link>
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-muted">{text}</p>;
}

function DuelleWidget() {
  const { duels, pendingForMe } = useDuels();
  const openDuels = duels.filter((d) => d.status === "offen");

  return (
    <SidebarCard title="Duelle" icon="⚔️" accent="bg-gold/15 text-gold" href="/duelle">
      {pendingForMe.length > 0 && (
        <Link
          href="/duelle"
          className="mb-2 block rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/15"
        >
          {pendingForMe.length} {pendingForMe.length === 1 ? "Herausforderung wartet" : "Herausforderungen warten"} auf dich →
        </Link>
      )}
      {openDuels.length === 0 && pendingForMe.length === 0 ? (
        <EmptyHint text="Noch keine Duelle – fordere jemanden heraus." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {openDuels.slice(0, 3).map((duel) => (
            <div key={duel.id} className="flex items-center justify-between text-xs text-ink">
              <span className="truncate">vs. {duel.opponentName}</span>
              <span className="flex shrink-0 items-center gap-1 font-semibold text-gold">
                <StarIcon className="h-3 w-3" /> {duel.stake}
              </span>
            </div>
          ))}
        </div>
      )}
    </SidebarCard>
  );
}

function TipprundenWidget() {
  const { displayName } = useUser();
  const { leagues } = useTeams();
  const myLeagues = leagues.filter((l) => l.members.includes(displayName));

  return (
    <SidebarCard title="Tipprunden" icon="👥" accent="bg-blue-500/15 text-blue-300" href="/teams">
      {myLeagues.length === 0 ? (
        <EmptyHint text="Noch in keiner Tipprunde – erstelle eine oder tritt per Code bei." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {myLeagues.slice(0, 3).map((league) => (
            <div key={league.id} className="flex items-center justify-between text-xs text-ink">
              <span className="truncate">{league.name}</span>
              <span className="shrink-0 text-muted">{league.members.length} Mitgl.</span>
            </div>
          ))}
        </div>
      )}
    </SidebarCard>
  );
}

function TurniereWidget() {
  const { tournaments } = useTournaments();
  const active = tournaments.filter((t) => getTournamentStatus(t) === "aktiv");

  return (
    <SidebarCard title="Turniere" icon="🏆" accent="bg-violet-500/15 text-violet-300" href="/turnier">
      {active.length === 0 ? (
        <EmptyHint text="Aktuell kein aktives Turnier." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {active.slice(0, 3).map((tournament) => (
            <div key={tournament.id} className="flex items-center gap-2 text-xs text-ink">
              <span>{tournament.icon}</span>
              <span className="truncate">{tournament.name}</span>
            </div>
          ))}
        </div>
      )}
    </SidebarCard>
  );
}

export default function HomeSidebar() {
  return (
    <div className="flex flex-col gap-4">
      <DuelleWidget />
      <TipprundenWidget />
      <TurniereWidget />
    </div>
  );
}
