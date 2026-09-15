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
