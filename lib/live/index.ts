import type { LiveProvider } from "./types";
import { apiSportsProvider } from "./providers/apiSports";

// Auswahl des Live-Anbieters (Rene, 16.10.2026: Anbieter austauschbar).
// Umgebungsvariable LIVE_PROVIDER (nur Server, bei Vercel unter Settings →
// Environment Variables), Standard "api-sports". Unbekannter Wert → Standard.
// Neuen Anbieter ergänzen: siehe README, Abschnitt "Neuen Live-Anbieter
// ergänzen".
const PROVIDERS: Record<string, LiveProvider> = {
  [apiSportsProvider.id]: apiSportsProvider,
};

export const DEFAULT_LIVE_PROVIDER = "api-sports";

export function getLiveProvider(): LiveProvider {
  const wanted = (process.env.LIVE_PROVIDER ?? "").trim().toLowerCase();
  return PROVIDERS[wanted] ?? PROVIDERS[DEFAULT_LIVE_PROVIDER];
}
