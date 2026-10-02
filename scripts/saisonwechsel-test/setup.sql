-- Minimaler Supabase-Nachbau
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table public.profiles (
  id uuid primary key,
  display_name text,
  free_stars int not null default 0,
  pass_xp integer not null default 0,
  claimed_milestones jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "lesen" on public.profiles for select using (true);
create policy "eigenes" on public.profiles for update using (auth.uid() = id);
grant select, insert, update on public.profiles to authenticated;
-- Spieler A: hat Herbst-XP und Abzeichen, B: hat XP, C: neuer Spieler (nach Migration angelegt)
insert into public.profiles(id, display_name, pass_xp, claimed_milestones) values
 ('00000000-0000-0000-0000-00000000000a','Anna',6200,'[3,7,"herbst-2026:1","herbst-2026:2","herbst-2026:10"]'),
 ('00000000-0000-0000-0000-00000000000b','Ben',450,'["herbst-2026:1","herbst-2026:2"]');
