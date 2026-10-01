-- ============================================================================
-- PoolTipp – Nutzernummer + echte Freunde
-- ============================================================================
-- 1) Jeder Spieler bekommt automatisch eine feste Nutzernummer (#1001,
--    #1002, ...). Bestehende Konten bekommen sie nachträglich, in der
--    Reihenfolge ihrer Registrierung. Die Nummer kann niemand ändern.
-- 2) Freundschaften werden in der Datenbank gespeichert: Anfrage senden,
--    annehmen, ablehnen, Freund entfernen.
-- 3) Spielersuche nach Nummer oder Name. Die Suche zeigt nur Nummer und
--    Anzeigename, nie die E-Mail-Adresse.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Nutzernummer
-- ----------------------------------------------------------------------------
create sequence if not exists public.profiles_user_number_seq start with 1001;

alter table public.profiles add column if not exists user_number integer;

-- Bestehende Konten ohne Nummer: nach Registrierungsdatum durchnummerieren.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where user_number is null order by created_at, id loop
    update public.profiles set user_number = nextval('public.profiles_user_number_seq') where id = r.id;
  end loop;
end $$;

-- Keine Spalten-Vorgabe: die Nummer setzt der Trigger unten (sonst würde
-- bei jedem neuen Konto eine Nummer übersprungen).
alter table public.profiles alter column user_number drop default;
alter table public.profiles alter column user_number set not null;
create unique index if not exists profiles_user_number_key on public.profiles(user_number);

-- Die Nummer vergibt immer die Datenbank, der Browser kann sie weder beim
-- Anlegen vorgeben noch später ändern.
create or replace function public.protect_user_number()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.user_number := nextval('public.profiles_user_number_seq');
  else
    new.user_number := old.user_number;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_user_number on public.profiles;
create trigger profiles_protect_user_number
  before insert or update on public.profiles
  for each row execute procedure public.protect_user_number();

-- ----------------------------------------------------------------------------
-- 2) Freundschaften
-- ----------------------------------------------------------------------------
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);
-- Pro Paar höchstens eine Zeile, egal wer wen angefragt hat.
create unique index if not exists friendships_pair_key on public.friendships(
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);

alter table public.friendships enable row level security;
drop policy if exists "Eigene Freundschaften lesen" on public.friendships;
create policy "Eigene Freundschaften lesen" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Lesen nur die eigenen Zeilen (RLS oben), ändern nur über die Funktionen
-- unten.
grant usage on schema public to anon, authenticated;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null;
end $$;

-- Spieler suchen: "#1042" oder "1042" findet die Nummer, sonst Suche im
-- Namen (mindestens 2 Zeichen). Gibt nur Nummer und Anzeigename zurück.
create or replace function public.search_players(p_query text)
returns table (id uuid, display_name text, user_number integer, relation text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_q text := btrim(coalesce(p_query, ''));
  v_digits text;
begin
  if v_me is null then
    return;
  end if;
  v_digits := ltrim(v_q, '#');
  if v_digits ~ '^[0-9]{1,9}$' then
    return query
      select p.id, p.display_name, p.user_number, public.friend_relation(v_me, p.id)
      from public.profiles p
      where p.user_number = v_digits::int and p.id <> v_me;
    return;
  end if;
  if char_length(v_q) < 2 then
    return;
  end if;
  return query
    select p.id, p.display_name, p.user_number, public.friend_relation(v_me, p.id)
    from public.profiles p
    where p.id <> v_me
      and p.display_name ilike '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by (lower(p.display_name) = lower(v_q)) desc, p.display_name, p.user_number
    limit 20;
end;
$$;

-- Verhältnis zwischen mir und einer anderen Person:
-- 'friend', 'outgoing' (ich habe angefragt), 'incoming' (wurde angefragt)
-- oder 'none'.
create or replace function public.friend_relation(p_me uuid, p_other uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select case
      when f.status = 'accepted' then 'friend'
      when f.requester_id = p_me then 'outgoing'
      else 'incoming'
    end
    from public.friendships f
    where least(f.requester_id, f.addressee_id) = least(p_me, p_other)
      and greatest(f.requester_id, f.addressee_id) = greatest(p_me, p_other)
  ), 'none');
$$;

-- Meine Freunde und offenen Anfragen, mit Name und Nummer der anderen Person.
create or replace function public.my_friends()
returns table (other_id uuid, display_name text, user_number integer, relation text, since timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select p.id,
         p.display_name,
         p.user_number,
         case
           when f.status = 'accepted' then 'friend'
           when f.requester_id = auth.uid() then 'outgoing'
           else 'incoming'
         end,
         coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() is not null
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by p.display_name;
$$;

-- Anfrage senden. Hat die andere Person mich schon angefragt, sind wir
-- sofort befreundet. Gibt das neue Verhältnis zurück.
create or replace function public.send_friend_request(p_other uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_rel text;
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'Du kannst dich nicht selbst als Freund hinzufügen.';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'Diesen Spieler gibt es nicht.';
  end if;

  v_rel := public.friend_relation(v_me, p_other);
  if v_rel = 'incoming' then
    update public.friendships
      set status = 'accepted', accepted_at = now()
      where requester_id = p_other and addressee_id = v_me;
    return 'friend';
  elsif v_rel = 'none' then
    insert into public.friendships (requester_id, addressee_id) values (v_me, p_other)
      on conflict do nothing;
    return 'outgoing';
  end if;
  return v_rel;
end;
$$;

-- Anfrage annehmen (p_accept = true) oder ablehnen (false).
create or replace function public.respond_friend_request(p_other uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  if p_accept then
    update public.friendships
      set status = 'accepted', accepted_at = now()
      where requester_id = p_other and addressee_id = v_me and status = 'pending';
    return public.friend_relation(v_me, p_other);
  end if;
  delete from public.friendships
    where requester_id = p_other and addressee_id = v_me and status = 'pending';
  return 'none';
end;
$$;

-- Freund entfernen oder eigene Anfrage zurückziehen.
create or replace function public.remove_friend(p_other uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  delete from public.friendships
    where least(requester_id, addressee_id) = least(auth.uid(), p_other)
      and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_other);
end;
$$;

revoke all on function public.search_players(text) from public, anon;
revoke all on function public.friend_relation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.my_friends() from public, anon;
revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Kontrolle: zeigt alle Spieler mit ihrer neuen Nummer.
select user_number as nummer, display_name as name
from public.profiles
order by user_number;
