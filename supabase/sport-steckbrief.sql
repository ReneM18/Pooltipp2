-- ============================================================================
-- PoolTipp – Sport-Steckbrief / Sportlerkarte im Profil (Rene, 19./20.10.2026)
-- ============================================================================
-- Spieler zeigen im Profil, was sie selbst mit Sport zu tun haben:
-- Laufbahn aus Stationen (Rolle, Sportart, aktiv/ehemalig, wo, von–bis,
-- Position, höchste Klasse), Erfolge, Rückennummer, Fan seit.
-- 20.10.2026: Vereine stehen jetzt in data.stations (Liste); die erste
-- Version (data.roles) wird weiter unterstützt.
--
-- - Eigene Angabe, bringt keine Vorteile bei Punkten oder Rängen.
-- - "✓ bestätigt" kann nur der Admin setzen.
-- - Vereinsnamen: Vereine, die es in der App schon gibt (Tabelle teams),
--   werden sofort gezeigt; eingetippte erst, wenn der Admin sie freigibt.
-- - Wer den Steckbrief sehen darf, wählt jeder selbst: alle, nur Freunde,
--   niemand. Andere lesen ihn nur über die Funktion sport_bio_of, die das
--   prüft und nicht freigegebene Vereine weglässt.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- Ändert keine bestehenden Daten.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Tabellen
-- ----------------------------------------------------------------------------
create table if not exists public.sport_bios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  verified boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Eingetippte Vereinsnamen und ihr Status (vom Admin freigegeben oder nicht).
create table if not exists public.sport_bio_clubs (
  name_key text primary key,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  first_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sport_bios enable row level security;
alter table public.sport_bio_clubs enable row level security;

drop policy if exists "Eigenen Steckbrief lesen" on public.sport_bios;
create policy "Eigenen Steckbrief lesen" on public.sport_bios
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Eigenen Steckbrief anlegen" on public.sport_bios;
create policy "Eigenen Steckbrief anlegen" on public.sport_bios
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Eigenen Steckbrief ändern" on public.sport_bios;
create policy "Eigenen Steckbrief ändern" on public.sport_bios
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.sport_bios to authenticated;
revoke all on public.sport_bios from anon;
-- Vereinsliste nur über die Funktionen unten.
revoke all on public.sport_bio_clubs from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Schutz: "bestätigt" setzt nur der Admin; neue Vereinsnamen merken
-- ----------------------------------------------------------------------------
create or replace function public.sport_bio_key(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- Verein bekannt (Team in der App) oder vom Admin freigegeben?
create or replace function public.sport_bio_club_ok(p_club text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.teams t where public.sport_bio_key(t.data ->> 'name') = public.sport_bio_key(p_club))
      or exists (select 1 from public.sport_bio_clubs c where c.name_key = public.sport_bio_key(p_club) and c.status = 'approved');
$$;

-- Unbekannten Verein als "wartet auf Prüfung" merken.
create or replace function public.sport_bio_note_club(p_club text, p_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.teams t where public.sport_bio_key(t.data ->> 'name') = public.sport_bio_key(p_club)
  ) then
    insert into public.sport_bio_clubs (name_key, name, first_user)
    values (public.sport_bio_key(p_club), p_club, p_user)
    on conflict (name_key) do nothing;
  end if;
end;
$$;

create or replace function public.sport_bios_before_write()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role record;
  v_club text;
  v_idx int;
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
    else
      new.verified := old.verified;
    end if;
  end if;
  new.updated_at := now();

  -- Grenzen gegen Missbrauch: höchstens 15 Stationen, insgesamt klein.
  if jsonb_typeof(new.data -> 'stations') = 'array' and jsonb_array_length(new.data -> 'stations') > 15 then
    raise exception 'Höchstens 15 Stationen';
  end if;
  -- Kartenfoto (20.10.2026): nur ein eigenes JPEG als data-URL, max. ~150 KB.
  if new.data ? 'photo' then
    if jsonb_typeof(new.data -> 'photo') <> 'string'
       or left(new.data ->> 'photo', 23) <> 'data:image/jpeg;base64,'
       or length(new.data ->> 'photo') > 150000 then
      raise exception 'Kartenfoto ungültig oder zu groß';
    end if;
  end if;
  if octet_length((new.data - 'photo')::text) > 20000 then
    raise exception 'Steckbrief zu groß';
  end if;

  -- Vereinsnamen kürzen (max. 30 Zeichen) und unbekannte als "wartet" merken.
  if jsonb_typeof(new.data -> 'stations') = 'array' then
    for v_idx in 0 .. jsonb_array_length(new.data -> 'stations') - 1 loop
      v_club := left(trim(coalesce(new.data -> 'stations' -> v_idx ->> 'club', '')), 30);
      if v_club <> '' then
        new.data := jsonb_set(new.data, array['stations', v_idx::text, 'club'], to_jsonb(v_club));
        perform public.sport_bio_note_club(v_club, new.user_id);
      end if;
    end loop;
  end if;
  if jsonb_typeof(new.data -> 'roles') = 'object' then
    for v_role in select key, value from jsonb_each(new.data -> 'roles') loop
      v_club := left(trim(coalesce(v_role.value ->> 'club', '')), 30);
      if v_club <> '' then
        new.data := jsonb_set(new.data, array['roles', v_role.key, 'club'], to_jsonb(v_club));
        perform public.sport_bio_note_club(v_club, new.user_id);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sport_bios_before_write on public.sport_bios;
create trigger sport_bios_before_write
  before insert or update on public.sport_bios
  for each row execute function public.sport_bios_before_write();

-- ----------------------------------------------------------------------------
-- 3) Steckbrief eines Spielers lesen (prüft Sichtbarkeit, filtert Vereine)
-- ----------------------------------------------------------------------------
create or replace function public.sport_bio_of(p_user uuid)
returns table (data jsonb, verified boolean, visibility text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.sport_bios%rowtype;
  v_data jsonb;
  v_role record;
  v_club text;
  v_ok boolean;
  v_idx int;
begin
  select * into v_row from public.sport_bios b where b.user_id = p_user;
  if not found then return; end if;

  if not (
    v_row.user_id = v_me
    or v_row.visibility = 'public'
    or (v_row.visibility = 'friends' and v_me is not null and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(v_me, p_user)
        and greatest(f.requester_id, f.addressee_id) = greatest(v_me, p_user)
    ))
  ) then
    return;
  end if;

  v_data := v_row.data;
  -- Der Besitzer sieht seinen Verein immer (mit Hinweis "wird geprüft"),
  -- alle anderen nur freigegebene bzw. bekannte.
  if jsonb_typeof(v_data -> 'stations') = 'array' then
    for v_idx in 0 .. jsonb_array_length(v_data -> 'stations') - 1 loop
      v_club := coalesce(v_data -> 'stations' -> v_idx ->> 'club', '');
      if v_club <> '' then
        v_ok := public.sport_bio_club_ok(v_club);
        if v_row.user_id = v_me then
          v_data := jsonb_set(v_data, array['stations', v_idx::text, 'clubApproved'], to_jsonb(v_ok));
        elsif not v_ok then
          v_data := v_data #- array['stations', v_idx::text, 'club'];
        end if;
      end if;
    end loop;
  end if;
  if jsonb_typeof(v_data -> 'roles') = 'object' then
    for v_role in select key, value from jsonb_each(v_data -> 'roles') loop
      v_club := coalesce(v_role.value ->> 'club', '');
      if v_club <> '' then
        v_ok := public.sport_bio_club_ok(v_club);
        if v_row.user_id = v_me then
          v_data := jsonb_set(v_data, array['roles', v_role.key, 'clubApproved'], to_jsonb(v_ok));
        elsif not v_ok then
          v_data := v_data #- array['roles', v_role.key, 'club'];
        end if;
      end if;
    end loop;
  end if;

  return query select v_data, v_row.verified, v_row.visibility;
end;
$$;

revoke all on function public.sport_bio_of(uuid) from public;
grant execute on function public.sport_bio_of(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Admin: Vereine freigeben, Steckbriefe bestätigen
-- ----------------------------------------------------------------------------
create or replace function public.admin_sport_bio_overview()
returns table (kind text, key text, label text, detail text, status text)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nur für den Admin';
  end if;
  return query
    select 'club'::text, c.name_key, c.name, coalesce(p.display_name, '–'), c.status
    from public.sport_bio_clubs c
    left join public.profiles p on p.id = c.first_user
    union all
    select 'bio'::text, b.user_id::text, coalesce(p.display_name, '–'), b.data::text,
           case when b.verified then 'verified' else 'own' end
    from public.sport_bios b
    left join public.profiles p on p.id = b.user_id
    where b.data <> '{}'::jsonb;
end;
$$;

create or replace function public.admin_set_sport_club(p_key text, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Nur für den Admin'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'Ungültiger Status'; end if;
  update public.sport_bio_clubs set status = p_status where name_key = p_key;
end;
$$;

create or replace function public.admin_set_sport_bio_verified(p_user uuid, p_verified boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Nur für den Admin'; end if;
  update public.sport_bios set verified = p_verified where user_id = p_user;
end;
$$;

revoke all on function public.admin_sport_bio_overview() from public, anon;
revoke all on function public.admin_set_sport_club(text, text) from public, anon;
revoke all on function public.admin_set_sport_bio_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_sport_bio_overview() to authenticated;
grant execute on function public.admin_set_sport_club(text, text) to authenticated;
grant execute on function public.admin_set_sport_bio_verified(uuid, boolean) to authenticated;
revoke all on function public.sport_bios_before_write() from public, anon, authenticated;
revoke all on function public.sport_bio_note_club(text, uuid) from public, anon, authenticated;
revoke all on function public.sport_bio_club_ok(text) from public, anon, authenticated;

commit;

-- Kontrolle: sollte zwei Zeilen mit "true" zeigen.
select relname as tabelle, relrowsecurity as rls_aktiv
from pg_class
where oid in ('public.sport_bios'::regclass, 'public.sport_bio_clubs'::regclass);
