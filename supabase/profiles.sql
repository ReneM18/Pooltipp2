-- Legt die "profiles"-Tabelle an: eine Zeile pro registriertem User, mit
-- Anzeigename und Sternen-Guthaben. Wird von lib/UserContext.tsx gelesen
-- und beschrieben.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> Neues Query -> dieses
-- komplette Skript einfügen -> "Run".

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Spieler',
  free_stars integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: jeder darf NUR seine eigene Zeile lesen/ändern, nie
-- die von anderen Usern.
alter table public.profiles enable row level security;

drop policy if exists "Eigenes Profil lesen" on public.profiles;
create policy "Eigenes Profil lesen" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Eigenes Profil anlegen" on public.profiles;
create policy "Eigenes Profil anlegen" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Eigenes Profil aktualisieren" on public.profiles;
create policy "Eigenes Profil aktualisieren" on public.profiles
  for update using (auth.uid() = id);

-- Legt automatisch eine profiles-Zeile an, sobald sich jemand neu bei
-- Supabase registriert (Trigger auf auth.users) – so muss die App sich
-- darum nicht kümmern.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, free_stars)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Spieler'),
    100
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
