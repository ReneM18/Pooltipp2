import type { Sport, Team } from "./types";
import { hasTeamGroups } from "./teamGroups";

// Gastteams (Rene, 28.10.2026: Pokalspiele gegen Vereine aus unteren Ligen,
// "ich möchte nicht für jeden Verein das Trikot erstellen"). Ein Gastteam
// ist ein normales Team, nur mit neutralem grauem Trikot und in einer
// eigenen Untergruppe, damit es die übrige Teamliste nicht füllt. Tipps,
// Punkte und Statistik laufen darum wie bei jedem anderen Team.

export const GUEST_TEAM_GROUP = "Pokal-Gäste";
export const GUEST_PRIMARY_COLOR = "#9CA3AF";
export const GUEST_SECONDARY_COLOR = "#FFFFFF";

/** Daten fürs neue Gastteam; Land z. B. vom Wettbewerb (ÖFB-Cup -> AT), sonst leer. */
export function guestTeamData(name: string, sport: Sport, countryCode: string | null | undefined): Omit<Team, "id"> {
  return {
    name: name.trim(),
    sport,
    countryCode: countryCode ?? "",
    primaryColor: GUEST_PRIMARY_COLOR,
    secondaryColor: GUEST_SECONDARY_COLOR,
    jerseyStyle: "solid",
    ...(hasTeamGroups(sport) ? { group: GUEST_TEAM_GROUP } : {}),
  };
}
