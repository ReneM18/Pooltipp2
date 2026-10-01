-- ============================================================================
-- PoolTipp – Lese-/Schreibrechte für die App-Tabellen wiederherstellen
-- ============================================================================
-- Behebt "permission denied for table profiles" (z. B. auf der Rangliste).
-- Der Fehler kommt nicht von den Sicherheitsregeln (RLS), sondern davon, dass
-- die Rollen der App ("anon" = nicht eingeloggt, "authenticated" =
-- eingeloggt) gar keine Grundrechte auf die Tabellen haben.
--
-- Sicher: WER was lesen/ändern darf, bestimmen weiterhin die RLS-Regeln, die
-- auf allen Tabellen aktiv sind (z. B. Spiele/Teams/News nur der Admin, das
-- eigene Profil nur man selbst). Dieses Skript schaltet nur die Grundrechte
-- frei, ohne die diese Regeln gar nicht erst greifen können.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

grant usage on schema public to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'tips', 'teams', 'matches', 'news', 'tournaments',
    'match_comments', 'activity_feed', 'chat_messages', 'duels'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      -- Lesen: alle (die RLS-Regeln filtern, was jeder sehen darf).
      execute format('grant select on public.%I to anon, authenticated', t);
      -- Schreiben: nur eingeloggte Nutzer, und auch die nur so weit, wie die
      -- RLS-Regeln es erlauben.
      execute format('grant insert, update, delete on public.%I to authenticated', t);
      -- Sicherheitsnetz: RLS muss an sein.
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- Kontrolle: sollte 10 Zeilen mit "true" in allen Spalten zeigen.
select c.relname as tabelle,
       has_table_privilege('anon', c.oid, 'select') as anon_lesen,
       has_table_privilege('authenticated', c.oid, 'select') as eingeloggt_lesen,
       c.relrowsecurity as rls_an
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'tips', 'teams', 'matches', 'news', 'tournaments',
                    'match_comments', 'activity_feed', 'chat_messages', 'duels')
order by 1;
