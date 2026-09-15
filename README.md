# PoolTipp – MVP

**Version: 3 (Trikots/Helme + Ticker) – falls du das hier auf GitHub siehst, ist der Upload angekommen ✅**


## Setup

```bash
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen.

## Struktur

- `app/page.tsx` – Dashboard mit den 3 Beispiel-Spielen (Tipp-Ansicht)
- `app/layout.tsx` – Grundgerüst, Fonts (Rajdhani für Überschriften, Inter für Fließtext)
- `components/Navbar.tsx` – Header mit Sterne- und Punkte-Anzeige
- `components/MatchCard.tsx` – Einzelne Spiel-Karte mit Ergebnis-Tipp und Einsatz-Regler
- `lib/types.ts` – TypeScript-Typen für Match, Tip, UserProfile
- `lib/mockData.ts` – Beispieldaten für die Vorschau (ohne Backend)
- `lib/firebase.ts` – Platzhalter für die spätere Firestore-Anbindung

Aktuell läuft alles mit Mock-Daten im Frontend-State. Die Anbindung an
Firestore ist der nächste Schritt (siehe Erklärung zur Datenstruktur).
