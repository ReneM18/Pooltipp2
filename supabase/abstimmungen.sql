-- PoolTipp – Abstimmungen in den News (Rene, 12.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Der Admin hängt an eine News eine Frage mit 2–4 Antworten (steht in
-- news.data -> 'poll'). Jeder eingeloggte Spieler hat eine Stimme und kann
-- sie bis zum Ende ändern. Keine Coins, keine Punkte.
-- Einzelne Stimmen sieht nur man selbst; für alle sichtbar ist nur die
-- Summe je Antwort (news_poll_results), die per Realtime live mitläuft.

begin;

create table if not exists public.news_poll_votes (
  news_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (news_id, user_id)
);
alter table public.news_poll_votes enable row level security;
drop policy if exists "Eigene Stimme lesen" on public.news_poll_votes;
create policy "Eigene Stimme lesen" on public.news_poll_votes for select using (user_id = auth.uid());
revoke all on public.news_poll_votes from anon, authenticated;
grant select on public.news_poll_votes to authenticated;

create table if not exists public.news_poll_results (
  news_id text primary key,
  counts integer[] not null default '{0,0,0,0}',
  total integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.news_poll_results enable row level security;
drop policy if exists "Ergebnisse lesen" on public.news_poll_results;
create policy "Ergebnisse lesen" on public.news_poll_results for select using (true);
revoke all on public.news_poll_results from anon, authenticated;
grant select on public.news_poll_results to anon, authenticated;

-- Summe neu zählen (nur intern).
create or replace function public.refresh_news_poll(p_news_id text)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.news_poll_results (news_id, counts, total, updated_at)
  select p_news_id,
         array[
           count(*) filter (where option_index = 0)::int,
           count(*) filter (where option_index = 1)::int,
           count(*) filter (where option_index = 2)::int,
           count(*) filter (where option_index = 3)::int
         ],
         count(*)::int,
         now()
  from public.news_poll_votes where news_id = p_news_id
  on conflict (news_id) do update
    set counts = excluded.counts, total = excluded.total, updated_at = excluded.updated_at;
$$;

-- Abstimmen oder Stimme ändern.
create or replace function public.vote_news_poll(p_news_id text, p_option integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll jsonb;
  v_ends timestamptz;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select data -> 'poll' into v_poll from public.news where id = p_news_id;
  if v_poll is null or jsonb_typeof(v_poll) <> 'object' or jsonb_typeof(v_poll -> 'options') <> 'array' then
    raise exception 'Zu dieser News gibt es keine Abstimmung';
  end if;
  if p_option is null or p_option < 0 or p_option >= least(jsonb_array_length(v_poll -> 'options'), 4) then
    raise exception 'Ungültige Antwort';
  end if;
  v_ends := public.try_timestamptz(v_poll ->> 'endsAt');
  if v_ends is not null and now() >= v_ends then
    raise exception 'Die Abstimmung ist schon beendet';
  end if;

  insert into public.news_poll_votes (news_id, user_id, option_index, updated_at)
  values (p_news_id, v_uid, p_option, now())
  on conflict (news_id, user_id) do update set option_index = excluded.option_index, updated_at = now();

  perform public.refresh_news_poll(p_news_id);
end;
$$;

-- Wird eine News gelöscht, verschwinden auch ihre Stimmen.
create or replace function public.news_poll_cleanup()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.news_poll_votes where news_id = old.id;
  delete from public.news_poll_results where news_id = old.id;
  return old;
end;
$$;
drop trigger if exists news_poll_cleanup on public.news;
create trigger news_poll_cleanup after delete on public.news
  for each row execute function public.news_poll_cleanup();

revoke all on function public.refresh_news_poll(text) from public, anon, authenticated;
revoke all on function public.news_poll_cleanup() from public, anon, authenticated;
revoke all on function public.vote_news_poll(text, integer) from public, anon;
grant execute on function public.vote_news_poll(text, integer) to authenticated;

commit;

-- Live-Ergebnisse per Realtime (Fehler "already member" ist egal).
do $$
begin
  alter publication supabase_realtime add table public.news_poll_results;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.news_poll_votes;
exception when duplicate_object then null;
end $$;
