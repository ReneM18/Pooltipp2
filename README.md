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
