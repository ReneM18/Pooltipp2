-- ============================================================================
-- PoolTipp – "Social"-Grundlage auf Supabase
-- ============================================================================
-- Macht aus bisher rein lokalen (nur im eigenen Browser sichtbaren, nach
-- Reload wieder verschwundenen) Daten echte, für ALLE User sichtbare und
-- dauerhafte Daten: Spiele, Teams, News, Kommentare, Feed, Chat, Duelle,
-- Turniere. Außerdem werden Rang-Punkte/Pass-XP/Streak im Profil gesichert
-- (bisher nur Name + Sterne).
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> Neues Query -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach ausgeführt
-- werden (alles ist "if not exists" / "or replace" / "drop policy if exists").
--
-- WICHTIG: Der Admin-Bereich ist nur für den Admin-Account sichtbar (die App
-- fragt dafür is_admin() unten ab). Damit das Anlegen/Bearbeiten von
-- Spielen/Teams/News auch in der Datenbank nur dir erlaubt ist, prüft dieses
-- Skript zusätzlich deine Login-E-Mail. Falls deine PoolTipp-Registrierung
-- (auf /registrieren) NICHT mit rene.cr7@gmx.at läuft, trag unten bei
-- ADMIN_EMAIL deine tatsächliche Login-E-Mail ein, bevor du das Skript
-- ausführst – sonst kann der Admin-Bereich nichts mehr speichern.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'rene.cr7@gmx.at'; -- <- ADMIN_EMAIL, bei Bedarf anpassen
$$;

-- ----------------------------------------------------------------------------
-- 1) Profil erweitern: Rang-Punkte je Sportart, Saison-Pass-XP, Tipp-Streak.
--    Bisher gingen diese Werte bei jedem Neuladen der Seite verloren.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists rang_punkte jsonb not null default '{"Fußball":0,"NFL":0,"NBA":0,"NHL":0}'::jsonb,
  add column if not exists pass_xp integer not null default 0,
  add column if not exists streak_count integer not null default 0,
  add column if not exists last_tip_date text,
  add column if not exists claimed_milestones jsonb not null default '[]'::jsonb,
  add column if not exists last_claimed_at text;

-- Für Rangliste/Duelle/Turniere/Kommentare/Feed müssen alle eingeloggten
-- User die Profile ANDERER User lesen können (zumindest Name + Werte),
-- nicht nur ihr eigenes. Ergänzt die bestehende "nur eigenes Profil"-Regel.
drop policy if exists "Alle Profile lesen" on public.profiles;
create policy "Alle Profile lesen" on public.profiles
  for select using (true);

-- Gleicher Grund: Tipps müssen für Duell-/Turnier-Auswertung und eine echte
-- Rangliste über alle User hinweg lesbar sein (ändern darf weiterhin nur
-- jeder seine eigenen – siehe bestehende "Eigene Tipps anlegen/aktualisieren").
drop policy if exists "Alle Tipps lesen" on public.tips;
create policy "Alle Tipps lesen" on public.tips
  for select using (true);

-- ----------------------------------------------------------------------------
-- 2) Admin-Inhalte: Teams, Spiele, News, Turniere.
--    Jeweils eine Zeile pro Eintrag, der komplette Datensatz als JSON in
--    "data" (statt einer Spalte pro Feld) – so muss dieses Skript nicht bei
--    jeder künftigen neuen Eigenschaft (z. B. einem weiteren Spiel-Feld)
--    erneut angepasst werden. Lesen darf jeder (auch ohne Login), ändern nur
--    der Admin-Account.
-- ----------------------------------------------------------------------------
create table if not exists public.teams (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.teams enable row level security;
drop policy if exists "Teams lesen" on public.teams;
create policy "Teams lesen" on public.teams for select using (true);
drop policy if exists "Teams verwalten" on public.teams;
create policy "Teams verwalten" on public.teams for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.matches (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.matches enable row level security;
drop policy if exists "Spiele lesen" on public.matches;
create policy "Spiele lesen" on public.matches for select using (true);
drop policy if exists "Spiele verwalten" on public.matches;
create policy "Spiele verwalten" on public.matches for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.news (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.news enable row level security;
drop policy if exists "News lesen" on public.news;
create policy "News lesen" on public.news for select using (true);
drop policy if exists "News verwalten" on public.news;
create policy "News verwalten" on public.news for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.tournaments (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.tournaments enable row level security;
drop policy if exists "Turniere lesen" on public.tournaments;
create policy "Turniere lesen" on public.tournaments for select using (true);
drop policy if exists "Turniere verwalten" on public.tournaments;
create policy "Turniere verwalten" on public.tournaments for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) Kommentare zu Spielen – jeder darf lesen/kommentieren, nur eigene
--    Kommentare löschen. Liken darf jeder eingeloggte User (die App schreibt
--    dabei ausschließlich die liked_by-Liste, nie Text/Autor anderer).
-- ----------------------------------------------------------------------------
create table if not exists public.match_comments (
  id text primary key,
  match_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  text text not null,
  liked_by jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists match_comments_match_id_idx on public.match_comments(match_id);
alter table public.match_comments enable row level security;
drop policy if exists "Kommentare lesen" on public.match_comments;
create policy "Kommentare lesen" on public.match_comments for select using (true);
drop policy if exists "Eigene Kommentare schreiben" on public.match_comments;
create policy "Eigene Kommentare schreiben" on public.match_comments for insert with check (auth.uid() = user_id);
drop policy if exists "Eigene Kommentare löschen" on public.match_comments;
create policy "Eigene Kommentare löschen" on public.match_comments for delete using (auth.uid() = user_id);
drop policy if exists "Kommentare liken" on public.match_comments;
create policy "Kommentare liken" on public.match_comments for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- 4) Aktivitäts-Feed – echte, geteilte Chronik (statt nur eigener Aktivität
--    + erfundener "Community"-Einträge). Jeder darf lesen, nur eigene Zeilen
--    schreiben.
-- ----------------------------------------------------------------------------
create table if not exists public.activity_feed (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  author_name text,
  icon text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_feed_created_at_idx on public.activity_feed(created_at desc);
alter table public.activity_feed enable row level security;
drop policy if exists "Feed lesen" on public.activity_feed;
create policy "Feed lesen" on public.activity_feed for select using (true);
drop policy if exists "Eigene Aktivität schreiben" on public.activity_feed;
create policy "Eigene Aktivität schreiben" on public.activity_feed for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5) Chat – ein gemeinsamer Community-Chat-Raum, live über Supabase Realtime.
-- ----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at);
alter table public.chat_messages enable row level security;
drop policy if exists "Chat lesen" on public.chat_messages;
create policy "Chat lesen" on public.chat_messages for select using (true);
drop policy if exists "Eigene Nachricht schreiben" on public.chat_messages;
create policy "Eigene Nachricht schreiben" on public.chat_messages for insert with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

-- Live-Updates braucht es auch für Kommentare, den Feed und Duelle (z. B.
-- damit eine Duell-Annahme sofort im Browser der Gegenseite ankommt).
do $$
begin
  alter publication supabase_realtime add table public.match_comments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.activity_feed;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 6) Duelle – Kopf-an-Kopf gegen einen echten, registrierten User.
--    Ablauf: Herausforderer legt an (status "pending", eigener Einsatz ist
--    sofort weg) -> Gegner nimmt an (status "offen", jetzt ist auch dessen
--    Einsatz weg) oder lehnt ab (Einsatz geht zurück) -> sobald der Admin das
--    Spiel beendet, wertet resolve_duels_for_match() alle offenen Duelle
--    dieses Spiels anhand der ECHTEN, normal abgegebenen Tipps beider Seiten
--    aus und schreibt Sterne auf BEIDEN Konten gut – das kann aus dem Browser
--    einer einzelnen Person heraus nicht sicher gehen (RLS erlaubt niemandem,
--    das Sterne-Guthaben einer anderen Person direkt zu ändern), deshalb läuft
--    das über diese Funktion mit erweiterten Rechten (SECURITY DEFINER).
-- ----------------------------------------------------------------------------
create table if not exists public.duels (
  id text primary key,
  challenger_id uuid not null references auth.users(id) on delete cascade,
  challenger_name text not null,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  opponent_name text not null,
  match_id text not null,
  stake integer not null,
  status text not null default 'pending', -- pending | offen | abgelehnt | verfallen | ausgewertet
  my_tier text,
  opponent_tier text,
  result text, -- challenger | opponent | unentschieden
  stars_credited integer,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists duels_match_id_idx on public.duels(match_id);
create index if not exists duels_challenger_idx on public.duels(challenger_id);
create index if not exists duels_opponent_idx on public.duels(opponent_id);
alter table public.duels enable row level security;
drop policy if exists "Eigene Duelle lesen" on public.duels;
create policy "Eigene Duelle lesen" on public.duels
  for select using (auth.uid() = challenger_id or auth.uid() = opponent_id);
drop policy if exists "Duell herausfordern" on public.duels;
create policy "Duell herausfordern" on public.duels
  for insert with check (auth.uid() = challenger_id);
drop policy if exists "Duell annehmen" on public.duels;
create policy "Duell annehmen" on public.duels
  for update using (auth.uid() = challenger_id or auth.uid() = opponent_id)
  with check (auth.uid() = challenger_id or auth.uid() = opponent_id);

do $$
begin
  alter publication supabase_realtime add table public.duels;
exception when duplicate_object then null;
end $$;

-- Gleiche Tipp-Bewertung wie in lib/poolScore.ts (classifyTip), nur als
-- SQL-Funktion, damit die Auswertungs-Funktion unten sie nutzen kann.
create or replace function public.classify_tip(p_home int, p_away int, p_actual_home int, p_actual_away int)
returns text
language sql
immutable
as $$
  select case
    when p_home = p_actual_home and p_away = p_actual_away then 'exakt'
    when sign(p_home - p_away) = sign(p_actual_home - p_actual_away) then 'tendenz'
    else 'falsch'
  end;
$$;

create or replace function public.tier_order(p_tier text)
returns int
language sql
immutable
as $$
  select case p_tier when 'exakt' then 2 when 'tendenz' then 1 else 0 end;
$$;

-- Gegner lehnt eine Herausforderung ab -> Einsatz geht an den Herausforderer
-- zurück. Nur der Gegner selbst darf das auslösen.
create or replace function public.decline_duel(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  if v_duel.opponent_id <> auth.uid() then
    raise exception 'Nur der Herausgeforderte kann ablehnen';
  end if;
  if v_duel.status <> 'pending' then
    raise exception 'Duell ist nicht mehr offen';
  end if;

  update public.duels set status = 'abgelehnt', resolved_at = now() where id = p_duel_id;
  update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now()
  where id = v_duel.challenger_id;
end;
$$;

-- Wird vom Admin-Bereich aufgerufen, direkt nachdem ein Spiel auf "beendet"
-- gesetzt wurde (siehe app/admin/page.tsx). Wertet alle offenen Duelle dieses
-- Spiels aus. Noch nicht angenommene ("pending") Duelle verfallen dabei
-- automatisch (Einsatz des Herausforderers zurück) statt für immer offen zu
-- bleiben. Bereits ausgewertete Duelle werden nicht erneut angefasst, auch
-- wenn der Endstand später korrigiert wird.
create or replace function public.resolve_duels_for_match(p_match_id text, p_actual_home int, p_actual_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
  v_challenger_home int;
  v_challenger_away int;
  v_opponent_home int;
  v_opponent_away int;
  v_challenger_tier text;
  v_opponent_tier text;
  v_result text;
  v_credit_challenger int;
  v_credit_opponent int;
begin
  for v_duel in
    select * from public.duels
    where match_id = p_match_id and status in ('offen', 'pending')
    for update
  loop
    if v_duel.status = 'pending' then
      update public.duels set status = 'verfallen', resolved_at = now() where id = v_duel.id;
      update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now()
      where id = v_duel.challenger_id;
      continue;
    end if;

    select predicted_home_score, predicted_away_score into v_challenger_home, v_challenger_away
    from public.tips where user_id = v_duel.challenger_id and match_id = p_match_id limit 1;

    select predicted_home_score, predicted_away_score into v_opponent_home, v_opponent_away
    from public.tips where user_id = v_duel.opponent_id and match_id = p_match_id limit 1;

    v_challenger_tier := case when v_challenger_home is null then 'falsch'
      else public.classify_tip(v_challenger_home, v_challenger_away, p_actual_home, p_actual_away) end;
    v_opponent_tier := case when v_opponent_home is null then 'falsch'
      else public.classify_tip(v_opponent_home, v_opponent_away, p_actual_home, p_actual_away) end;

    v_credit_challenger := 0;
    v_credit_opponent := 0;

    if public.tier_order(v_challenger_tier) > public.tier_order(v_opponent_tier) then
      v_result := 'challenger';
      v_credit_challenger := v_duel.stake * 2;
    elsif public.tier_order(v_opponent_tier) > public.tier_order(v_challenger_tier) then
      v_result := 'opponent';
      v_credit_opponent := v_duel.stake * 2;
    else
      v_result := 'unentschieden';
      v_credit_challenger := v_duel.stake;
      v_credit_opponent := v_duel.stake;
    end if;

    update public.duels
    set status = 'ausgewertet',
        my_tier = v_challenger_tier,
        opponent_tier = v_opponent_tier,
        result = v_result,
        stars_credited = greatest(v_credit_challenger, v_credit_opponent),
        resolved_at = now()
    where id = v_duel.id;

    if v_credit_challenger > 0 then
      update public.profiles set free_stars = free_stars + v_credit_challenger, updated_at = now()
      where id = v_duel.challenger_id;
    end if;
    if v_credit_opponent > 0 then
      update public.profiles set free_stars = free_stars + v_credit_opponent, updated_at = now()
      where id = v_duel.opponent_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.decline_duel(text) to authenticated;
grant execute on function public.resolve_duels_for_match(text, int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Erstbefüllung: die bisherigen, bis jetzt nur hart im Code stehenden
--    Beispiel-Daten (Teams/Spiele/News/Turnier/Kommentare/Feed/Chat) einmalig
--    in die neuen Tabellen übernehmen, damit nichts verschwindet, was schon
--    live ist (z. B. eure bisherigen Tipps hängen an genau diesen Spiel-IDs).
--    "on conflict do nothing" -> beliebig oft ausführbar, überschreibt nichts,
--    was du im Admin-Bereich danach schon geändert hast.
-- ----------------------------------------------------------------------------
insert into public.teams (id, data) values
  ('team-fcb', '{"id":"team-fcb","name":"Bayern München","sport":"Fußball","countryCode":"DE","primaryColor":"#DC052D","secondaryColor":"#FFFFFF","jerseyStyle":"solid"}'),
  ('team-bvb', '{"id":"team-bvb","name":"Borussia Dortmund","sport":"Fußball","countryCode":"DE","primaryColor":"#FDE100","secondaryColor":"#000000","jerseyStyle":"streifen"}'),
  ('team-rbl', '{"id":"team-rbl","name":"RB Leipzig","sport":"Fußball","countryCode":"DE","primaryColor":"#DD0741","secondaryColor":"#FFFFFF","jerseyStyle":"solid"}'),
  ('team-b04', '{"id":"team-b04","name":"Bayer Leverkusen","sport":"Fußball","countryCode":"DE","primaryColor":"#E32221","secondaryColor":"#000000","jerseyStyle":"aermel"}'),
  ('team-sge', '{"id":"team-sge","name":"Eintracht Frankfurt","sport":"Fußball","countryCode":"DE","primaryColor":"#E1000F","secondaryColor":"#000000","jerseyStyle":"solid"}'),
  ('team-vfb', '{"id":"team-vfb","name":"VfB Stuttgart","sport":"Fußball","countryCode":"DE","primaryColor":"#FFFFFF","secondaryColor":"#E32219","jerseyStyle":"aermel"}'),
  ('team-bills', '{"id":"team-bills","name":"Buffalo Bills","sport":"NFL","countryCode":"US","primaryColor":"#00338D","secondaryColor":"#C60C30"}'),
  ('team-chiefs', '{"id":"team-chiefs","name":"Kansas City Chiefs","sport":"NFL","countryCode":"US","primaryColor":"#E31837","secondaryColor":"#FFB81C"}'),
  ('team-bulls', '{"id":"team-bulls","name":"Chicago Bulls","sport":"NBA","countryCode":"US","primaryColor":"#CE1141","secondaryColor":"#000000","jerseyStyle":"solid"}'),
  ('team-knicks', '{"id":"team-knicks","name":"New York Knicks","sport":"NBA","countryCode":"US","primaryColor":"#006BB6","secondaryColor":"#F58426","jerseyStyle":"aermel"}'),
  ('team-bruins', '{"id":"team-bruins","name":"Boston Bruins","sport":"NHL","countryCode":"US","primaryColor":"#FFB81C","secondaryColor":"#000000"}'),
  ('team-rangers', '{"id":"team-rangers","name":"New York Rangers","sport":"NHL","countryCode":"US","primaryColor":"#0038A8","secondaryColor":"#CE1126"}')
on conflict (id) do nothing;

insert into public.matches (id, data) values
  ('match-1', '{"id":"match-1","sport":"Fußball","competition":"Bundesliga","matchday":7,"kickoff":"2026-09-20T15:30:00+02:00","tipDeadline":"2026-09-20T15:00:00+02:00","homeTeamId":"team-fcb","awayTeamId":"team-bvb","fixedStake":20,"status":"finished","liveHomeScore":2,"liveAwayScore":1,"summaryVideoUrl":"https://www.youtube.com/results?search_query=bayern+dortmund+highlights","tvChannel":"Sky Sport Bundesliga","tipMode":"score"}'),
  ('match-2', '{"id":"match-2","sport":"Fußball","competition":"Bundesliga","matchday":7,"kickoff":"2026-10-01T18:30:00+02:00","tipDeadline":"2026-10-01T18:00:00+02:00","homeTeamId":"team-rbl","awayTeamId":"team-b04","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"score"}'),
  ('match-3', '{"id":"match-3","sport":"Fußball","competition":"Bundesliga","matchday":7,"kickoff":"2026-10-02T17:30:00+02:00","tipDeadline":"2026-10-02T17:00:00+02:00","homeTeamId":"team-sge","awayTeamId":"team-vfb","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"score"}'),
  ('match-4', '{"id":"match-4","sport":"NFL","competition":"NFL","kickoff":"2026-10-02T19:00:00-04:00","tipDeadline":"2026-10-02T18:45:00-04:00","homeTeamId":"team-bills","awayTeamId":"team-chiefs","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"1x2"}'),
  ('match-5', '{"id":"match-5","sport":"NBA","competition":"NBA","kickoff":"2026-10-03T20:00:00-04:00","tipDeadline":"2026-10-03T19:45:00-04:00","homeTeamId":"team-bulls","awayTeamId":"team-knicks","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"score"}'),
  ('match-6', '{"id":"match-6","sport":"Fußball","competition":"Bundesliga","matchday":8,"kickoff":"2026-10-08T15:30:00+02:00","tipDeadline":"2026-10-08T15:00:00+02:00","homeTeamId":"team-b04","awayTeamId":"team-sge","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"score"}'),
  ('match-7', '{"id":"match-7","sport":"NFL","competition":"NFL","kickoff":"2026-10-09T19:00:00-04:00","tipDeadline":"2026-10-09T18:45:00-04:00","homeTeamId":"team-chiefs","awayTeamId":"team-bills","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"1x2"}'),
  ('match-8', '{"id":"match-8","sport":"NHL","competition":"NHL","kickoff":"2026-10-10T19:30:00-04:00","tipDeadline":"2026-10-10T19:15:00-04:00","homeTeamId":"team-bruins","awayTeamId":"team-rangers","fixedStake":20,"status":"upcoming","liveHomeScore":null,"liveAwayScore":null,"summaryVideoUrl":null,"tvChannel":null,"tipMode":"score"}')
on conflict (id) do nothing;

insert into public.news (id, data) values
  ('news-1', '{"id":"news-1","text":"Bayern führt weiter die Bundesliga-Tabelle an","article":"Nach dem Sieg im Topspiel gegen Dortmund bleibt Bayern München an der Tabellenspitze der Bundesliga. Die Mannschaft zeigte über weite Strecken eine starke Leistung und setzte sich verdient durch.","sport":"Fußball","createdAt":"2026-09-20T10:00:00+02:00"}'),
  ('news-2', '{"id":"news-2","text":"Neu im Prämien-Shop: der Titel „Tipp-König“","article":null,"sport":null,"createdAt":"2026-09-20T09:00:00+02:00"}'),
  ('news-3', '{"id":"news-3","text":"Sabine K. verteidigt Platz 1 in der Rangliste","article":null,"sport":null,"createdAt":"2026-09-19T09:00:00+02:00"}'),
  ('news-4', '{"id":"news-4","text":"Über 500.000 Sterne wurden diesen Spieltag verteilt","article":null,"sport":null,"createdAt":"2026-09-18T09:00:00+02:00"}'),
  ('news-5', '{"id":"news-5","text":"Perfekter Tipp bringt den größten Sterne-Gewinn","article":null,"sport":null,"createdAt":"2026-09-17T09:00:00+02:00"}')
on conflict (id) do nothing;

insert into public.tournaments (id, data) values
  ('tournament-demo', '{"id":"tournament-demo","name":"Spieltag-Spezial","description":"Alle aktuell angelegten Spiele in einem Turnier gebündelt – als Beispiel.","icon":"🏆","startDate":"2026-09-15T00:00:00+02:00","endDate":"2026-10-15T00:00:00+02:00","matchIds":["match-1","match-2","match-3","match-4","match-5","match-6","match-7","match-8"],"createdAt":"2026-09-15T00:00:00+02:00"}')
on conflict (id) do nothing;

insert into public.match_comments (id, match_id, user_id, author_name, text, liked_by, created_at) values
  ('comment-1', 'match-1', null, 'Marco T.', 'Bayern zuhause eigentlich immer sicher, 2:1 wie erwartet.', '["Sabine K."]', '2026-09-20T14:10:00+02:00'),
  ('comment-2', 'match-1', null, 'Sabine K.', 'Dortmund hätte da mehr draus machen müssen, verdiente Niederlage.', '[]', '2026-09-20T16:05:00+02:00'),
  ('comment-3', 'match-2', null, 'Jonas H.', 'Leverkusen ist gerade richtig stark drauf, ich tippe auf einen Auswärtssieg.', '["Marco T.", "Sabine K."]', '2026-09-19T20:30:00+02:00')
on conflict (id) do nothing;

insert into public.activity_feed (id, user_id, author_name, icon, text, created_at) values
  ('activity-1', null, null, '⚽', 'Marco T. hat beim Spiel Bayern München vs. Borussia Dortmund getippt.', '2026-09-20T14:12:00+02:00'),
  ('activity-2', null, null, '💬', 'Sabine K. hat einen Kommentar zu Bayern München vs. Borussia Dortmund geschrieben.', '2026-09-20T16:05:00+02:00'),
  ('activity-3', null, null, '🏆', 'Sabine K. verteidigt Platz 1 in der Gesamt-Rangliste.', '2026-09-19T09:00:00+02:00'),
  ('activity-4', null, null, '🏈', 'Jonas H. hat beim Spiel Buffalo Bills vs. Kansas City Chiefs getippt.', '2026-09-18T18:20:00+02:00'),
  ('activity-5', null, null, '⭐', 'Über 500.000 Sterne stecken diesen Spieltag im Tipp-Topf.', '2026-09-18T09:00:00+02:00')
on conflict (id) do nothing;

insert into public.chat_messages (id, user_id, author_name, text, created_at) values
  ('chat-1', null, 'Marco T.', 'Wer tippt heute auf Bayern?', '2026-09-20T12:00:00+02:00'),
  ('chat-2', null, 'Sabine K.', 'Ich setz alles auf ein 2:1 😄', '2026-09-20T12:01:00+02:00')
on conflict (id) do nothing;
