# PoolTipp

Kostenloses Social-Sport-Tippspiel als Web-App: Fußball, NFL, NBA und NHL tippen,
mit virtuellen **Sternen** statt Echtgeld. Komplett auf Deutsch, Dark Theme,
für das Handy gebaut (funktioniert auch am Desktop). Keine App-Store-App: die
Seite lässt sich im Browser „zum Startbildschirm hinzufügen“.

## Technik

| Teil | Was |
| --- | --- |
| Oberfläche | [Next.js 14](https://nextjs.org) (App Router), React 18, TypeScript, Tailwind CSS |
| Datenbank, Login, Live-Chat | [Supabase](https://supabase.com) (Postgres, Auth, Realtime) |
| Hosting | [Vercel](https://vercel.com), baut automatisch bei jedem Push auf `main` |
| Echte Sportdaten | [TheSportsDB](https://www.thesportsdb.com) (kostenloser Schlüssel, kein eigener Key nötig) |

## Funktionen

- **Tipps:** offene und geschlossene Spiele, Ergebnis- oder 1X2-Tipp mit Sterne-Einsatz, Kommentare
- **Matchcenter:** echte Tabellen und Ergebnisse
- **Saison-Pass:** Levels und Belohnungen, XP nur durch tägliches Einloggen
- **Rangliste:** echte Spielerwertung (gesamt, Spieltag, pro Sportart) und **Vereinswertung** (Herzensverein pro Sportart)
- **Duelle:** Freunde zu einem Spiel herausfordern, Sterne werden automatisch verrechnet
- **Tipprunden:** private Runden mit Einladungscode, eigene Spiele und eigene Rangliste
- **Turniere, Feed, Freunde, Chat** (live über Supabase Realtime)
- **Profil:** Fotos, Rang (Bronze bis Diamant), Statistik, Herzensvereine
- **Admin-Bereich** (nur für den Admin-Account): Teams, Spiele, Endstände, News

Drei getrennte Zähler: **Rangliste-Punkte** (Elo-ähnlich), **Saison-Pass-XP**
und **Sterne** (Einsatz-Währung).

## Ordner

```
app/          Seiten (eine Datei pro Seite, z. B. app/rangliste/page.tsx)
components/   wiederverwendbare Bausteine (Karten, Navigation, Chat, …)
lib/          Logik und Datenzugriff (Supabase-Anbindung, Punkte, Sportdaten)
public/       Bilder und App-Icons
supabase/     SQL-Skripte für die Datenbank
```

## Datenbank einrichten (Supabase)

Die Skripte im Ordner `supabase/` legen Tabellen, Regeln und Funktionen an.
Ausführen jeweils im Supabase-Dashboard unter **SQL Editor → New query →
Skript einfügen → Run**. Die Skripte sind so geschrieben, dass ein zweiter Durchlauf nichts kaputt macht.

Bei einer **neuen, leeren Datenbank** in dieser Reihenfolge:

1. `profiles.sql` – Spielerprofile
2. `tips.sql` – Tipps
3. `social-features.sql` – Spiele, Teams, News, Kommentare, Feed, Chat, Duelle, Turniere
4. `fix-rechte-tabellen.sql` – Grundrechte für die App-Tabellen
5. `fixes-features40.sql` – Korrekturen (Sterne, Endstand-Korrektur, Sicherheit)
6. `tipprunden.sql` – private Tipprunden
7. `vereinswertung.sql` – Herzensverein und Vereinstabellen

Die Live-Datenbank hat alle sieben Skripte bereits. Kommt später ein neues
Skript dazu, wird nur dieses eine ausgeführt.

Wichtig: Die Admin-E-Mail ist in der SQL-Funktion `is_admin()` hinterlegt
(`social-features.sql`). Neue Tabellen brauchen immer RLS-Regeln **und**
`grant`-Rechte für `anon`/`authenticated`.

## Umgebungsvariablen

Die App braucht zwei Werte aus Supabase (**Project Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

- **Auf Vercel:** unter Project Settings → Environment Variables (sind bereits gesetzt).
- **Lokal:** `.env.example` nach `.env.local` kopieren und die Werte eintragen.
  `.env.local` wird nie auf GitHub hochgeladen.

Der „anon“-Key darf öffentlich sein, die Daten schützen die RLS-Regeln in Supabase.

### Live-Spielstände (API-Sports)

Für Live-Stände auf den Tippkarten (Rene, 15.10.2026) braucht die App einen
Schlüssel von [API-Sports](https://api-sports.io) (Gratis-Plan: 100 Abfragen
pro Tag je Sportart):

```
API_SPORTS_KEY=
```

- **Auf Vercel:** Vercel → Settings → Environment Variables. Ohne `NEXT_PUBLIC_`,
  der Schlüssel bleibt auf dem Server (Route `app/api/live/route.ts`).
- Ohne Schlüssel zeigen die Karten einfach keine Live-Stände.
- Abgefragt wird nur, während ein angezeigtes Spiel läuft. Der Server merkt
  sich jeden Abruf mit fester Ablaufzeit (live 3 Min., Tagesliste 15 Min.,
  vergangene Tage 1 h, nie länger) und das CDN teilt die Antwort für alle
  Nutzer. Reine Anzeige, gewertet wird weiter der Endstand aus dem Admin-Bereich.
- Jede Antwort sagt ehrlich, wie aktuell sie ist (`source`, `fetchedAt`,
  `liveError`, `quota`). Hängen die Daten, steht im Matchcenter „Live-Daten
  verzögert“ und auf der Tippkarte „verzögert“ am LIVE-Pill. Der Admin-Bereich
  zeigt in der Kachel „Live-Daten“ Anbieter, letzten Abruf, Fehler und die
  Abfragen von heute (ohne zusätzliche Abfrage).

### Live-Anbieter wechseln oder neu ergänzen

Der Anbieter ist austauschbar (Rene, 16.10.2026). Gewählt wird er über die
Umgebungsvariable `LIVE_PROVIDER` (Standard `api-sports`):

```
LIVE_PROVIDER=api-sports
```

Aufbau:

| Datei | Was |
| --- | --- |
| `lib/live/types.ts` | anbieterneutrale Typen (`LiveGame`, `LiveSnapshot`, `LiveProvider` …) – nur davon hängen Route und Browser ab |
| `lib/live/cache.ts` | Server-Cache mit festen Ablaufzeiten, fasst gleichzeitige Abrufe zusammen |
| `lib/live/providers/apiSports.ts` | alles API-Sports-Spezifische (URLs, Schlüssel, Umwandlung, Fehler, Quote) |
| `lib/live/index.ts` | wählt den Anbieter über `LIVE_PROVIDER` |

Neuen Anbieter ergänzen:

1. Datei `lib/live/providers/<name>.ts` anlegen, die ein `LiveProvider`-Objekt
   exportiert (Vorlage: `apiSports.ts`): `id`, `name`, `url`,
   `configError()` (fehlender Schlüssel), `getDay({ sport, date, league })`
   und `diagnostics()`.
2. In `getDay` die Spiele des Tages (Wiener Zeit) abrufen – mit
   `cachedLoad` aus `lib/live/cache.ts` und `cache: "no-store"` – und in
   `LiveGame` umwandeln. Status auf `NS/LIVE/HT/BREAK/FT/AET/PEN/OTHER`
   abbilden, für die mitlaufende Minute `statusShort` „1H“/„2H“/„HT“ setzen.
   Nur eingeschaltete Ligen liefern (`isLiveLeagueEnabled` aus `lib/liveConfig.ts`).
3. `source` ehrlich setzen: `live` (frischer Live-Stand), `day` (nur
   Tagesliste) oder `stale` (alter Live-Stand nach Fehler), Fehler beim
   Live-Abruf in `liveError`, Quote in `quota`, falls der Anbieter sie mitschickt.
4. In `lib/live/index.ts` in `PROVIDERS` eintragen, Schlüssel und
   `LIVE_PROVIDER=<id>` bei Vercel setzen.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) 18.17 oder neuer (empfohlen 20 oder 22).

```bash
npm install      # einmalig, installiert genau die Versionen aus package-lock.json
npm run dev      # startet die App auf http://localhost:3000
```

Weitere Befehle:

```bash
npm run build    # Produktions-Build (prüft auch alle TypeScript-Typen)
npm run start    # startet den fertigen Build
```

## Veröffentlichen (Deploy)

Jede Änderung auf dem Branch `main` wird von Vercel automatisch gebaut und
veröffentlicht, das dauert ein bis zwei Minuten.

- **Über einen Pull Request:** auf GitHub den PR öffnen → „Squash and merge“ → „Confirm“.
- **Über GitHub Desktop:** Änderungen committen → „Push origin“.

Ändert sich die Datenbank, muss das neue SQL-Skript zusätzlich einmal im
Supabase SQL Editor ausgeführt werden (siehe oben).

Hinweis: Vorschau-Deployments von Vercel für Pull Requests schlagen derzeit
oft fehl, obwohl der Code in Ordnung ist. Entscheidend ist der Deploy nach dem
Merge auf `main`.
