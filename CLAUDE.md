# Hinweise für Claude

## Neue Tabellen in Supabase: Rechte (grant) gleich mitschreiben

Ab dem 30.10.2026 bekommen neue Tabellen im Schema `public` keine
automatischen Rechte mehr für die App (Supabase-Mail vom 21.10.2026).
Bestehende Tabellen sind nicht betroffen.

Legt ein SQL-Skript in `supabase/` eine neue Tabelle an, gehören die
passenden Rechte ins selbe Skript, direkt nach `create table` und den
RLS-Regeln, z. B.:

```sql
grant select on public.meine_tabelle to anon, authenticated;
grant insert, update, delete on public.meine_tabelle to authenticated;
```

- Nur so viel freigeben, wie die App wirklich braucht. Wer was sehen oder
  ändern darf, regeln weiterhin die RLS-Regeln.
- Tabellen, auf die die App nur über Server-Funktionen zugreift, bleiben
  gesperrt (`revoke all ... from anon, authenticated`), wie
  `sport_bio_clubs` oder `ranking_weeks`.
- `service_role` wird in der App nicht benutzt, dafür braucht es kein
  `grant`.
- Ohne `grant` meldet die App „permission denied“. Die Fehlermeldung von
  Supabase enthält dann den passenden Befehl für den SQL Editor.
