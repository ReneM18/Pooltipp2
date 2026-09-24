import type { Sport } from "@/lib/types";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  isCurrentUser?: boolean;
}

// Rangliste wird laut Konzept jeden Monat auf 0 zurückgesetzt.
export const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: "Sabine K.", points: 2140 },
  { rank: 2, name: "Marco T.", points: 1985 },
  { rank: 3, name: "Jonas W.", points: 1820 },
  { rank: 4, name: "Alex", points: 1180, isCurrentUser: true },
  { rank: 5, name: "Fatima R.", points: 1095 },
  { rank: 6, name: "Timo B.", points: 970 },
  { rank: 7, name: "Nina S.", points: 890 },
];

// Eigene Rangliste je Sportart – nur Tipps auf Spiele der jeweiligen Sportart zählen.
export const mockLeaderboardBySport: Record<Sport, LeaderboardEntry[]> = {
  "Fußball": [
    { rank: 1, name: "Sabine K.", points: 1320 },
    { rank: 2, name: "Jonas W.", points: 1140 },
    { rank: 3, name: "Alex", points: 980, isCurrentUser: true },
    { rank: 4, name: "Marco T.", points: 860 },
    { rank: 5, name: "Nina S.", points: 640 },
  ],
  NFL: [
    { rank: 1, name: "Marco T.", points: 705 },
    { rank: 2, name: "Fatima R.", points: 610 },
    { rank: 3, name: "Alex", points: 420, isCurrentUser: true },
    { rank: 4, name: "Timo B.", points: 380 },
    { rank: 5, name: "Sabine K.", points: 310 },
  ],
  NBA: [
    { rank: 1, name: "Fatima R.", points: 540 },
    { rank: 2, name: "Sabine K.", points: 510 },
    { rank: 3, name: "Timo B.", points: 470 },
    { rank: 4, name: "Marco T.", points: 420 },
    { rank: 5, name: "Alex", points: 180, isCurrentUser: true },
  ],
  NHL: [
    { rank: 1, name: "Jonas W.", points: 460 },
    { rank: 2, name: "Nina S.", points: 395 },
    { rank: 3, name: "Timo B.", points: 310 },
    { rank: 4, name: "Alex", points: 140, isCurrentUser: true },
    { rank: 5, name: "Marco T.", points: 90 },
  ],
};
