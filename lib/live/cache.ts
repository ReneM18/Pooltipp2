// Kleiner In-Memory-Cache für Abrufe beim Live-Anbieter (Rene, 16.10.2026:
// ohne stilles Festhängen). Ersetzt den Next.js Data Cache mit
// stale-while-revalidate: dort wurden am 15.10. ~15 Min. alte Einträge
// ausgeliefert, ohne dass man es sah.
//
// Regeln:
//  - Pro Server-Instanz, feste Ablaufzeit je Eintrag, KEIN Ausliefern nach
//    Ablauf ("stale"). Abgelaufen = neu abrufen.
//  - Zusätzlich: Sind die Daten (Zeitpunkt des echten Abrufs) älter als
//    maxAgeMs, wird IMMER neu abgerufen – auch wenn der Eintrag noch nicht
//    abgelaufen wäre.
//  - Gleichzeitige Anfragen derselben URL teilen sich einen laufenden Abruf.
//  - Fehler werden nur kurz gemerkt (errorTtlMs), damit z. B. bei
//    erreichtem Tageslimit nicht jede Anfrage erneut anklopft.

export interface CacheHit<T> {
  value: T;
  at: number; // Zeitpunkt des echten Abrufs (ms)
  expiresAt: number;
}

type Stored = { ok: true; hit: CacheHit<unknown> } | { ok: false; error: string; expiresAt: number };

const store = new Map<string, Stored>();
const inflight = new Map<string, Promise<Stored>>();
const MAX_ENTRIES = 200;

export type CacheResult<T> = { ok: true; hit: CacheHit<T> } | { ok: false; error: string; expiresAt: number };

export type LoadResult<T> = { ok: true; value: T; at: number } | { ok: false; error: string };

export async function cachedLoad<T>(
  key: string,
  opts: { ttlMs: number; maxAgeMs: number; errorTtlMs: number },
  loader: () => Promise<LoadResult<T>>,
): Promise<CacheResult<T>> {
  const now = Date.now();
  const cached = store.get(key);
  if (cached) {
    const fresh = cached.ok
      ? now < cached.hit.expiresAt && now - cached.hit.at < opts.maxAgeMs
      : now < cached.expiresAt;
    if (fresh) return cached as CacheResult<T>;
    store.delete(key);
  }
  let running = inflight.get(key);
  if (!running) {
    running = (async (): Promise<Stored> => {
      let result: LoadResult<T>;
      try {
        result = await loader();
      } catch {
        result = { ok: false, error: "Live-Daten nicht erreichbar" };
      }
      const done = Date.now();
      const stored: Stored = result.ok
        ? { ok: true, hit: { value: result.value, at: Math.min(result.at, done), expiresAt: done + opts.ttlMs } }
        : { ok: false, error: result.error, expiresAt: done + opts.errorTtlMs };
      store.set(key, stored);
      // Älteste Einträge (Einfügereihenfolge) wegwerfen.
      while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
      return stored;
    })().finally(() => inflight.delete(key));
    inflight.set(key, running);
  }
  return (await running) as CacheResult<T>;
}
