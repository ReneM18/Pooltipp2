// App-Einstellungen, die der Admin festlegt und die bei allen Spielern
// ankommen (z. B. Tempo des News-Bands). Liegen – wie die Wettbewerbe – als
// EINE eigene Zeile in der Tabelle "teams" (gleiche Rechte: alle lesen, nur
// der Admin schreibt), darum kein SQL nötig. Beim Laden der Teams wird die
// Zeile herausgefiltert (siehe AppDataContext).
export const SETTINGS_ROW_ID = "__einstellungen__";

export interface TickerSpeed {
  mobile: number; // Pixel pro Sekunde am Handy (unter 640 px Breite)
  desktop: number; // Pixel pro Sekunde am PC/Tablet
}

export interface AppSettingsRow {
  kind: "settings";
  tickerSpeed?: TickerSpeed;
}

// Stand vom 12.10.2026 (Rene), bis im Admin-Bereich etwas anderes gespeichert ist.
export const DEFAULT_TICKER_SPEED: TickerSpeed = { mobile: 72, desktop: 103 };
export const TICKER_SPEED_MIN = 20;
export const TICKER_SPEED_MAX = 250;

export function readTickerSpeed(row: unknown): TickerSpeed {
  const t = (row as AppSettingsRow | undefined)?.tickerSpeed;
  const ok = (n: unknown) => typeof n === "number" && n >= TICKER_SPEED_MIN && n <= TICKER_SPEED_MAX;
  return {
    mobile: ok(t?.mobile) ? (t!.mobile as number) : DEFAULT_TICKER_SPEED.mobile,
    desktop: ok(t?.desktop) ? (t!.desktop as number) : DEFAULT_TICKER_SPEED.desktop,
  };
}
