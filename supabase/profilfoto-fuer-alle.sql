-- ============================================================================
-- PoolTipp – Profilfoto auch bei anderen anzeigen
-- ============================================================================
-- Wer ein Profilfoto hat, wird damit überall gezeigt: Chat, Rangliste,
-- Spielerseite, Freunde, "wer hat getippt" usw.
-- Die Fotos liegen weiter privat in profile_extras (nur der Besitzer darf die
-- Zeile lesen). Andere bekommen nur das ERSTE Foto (Profilbild) und nur, wenn
-- der Besitzer es erlaubt: Sichtbarkeit "Öffentlich" = alle, "Nur für
-- Freunde" = nur bestätigte Freunde.
--
-- 1) photo_thumb: kleine Vorschau (ca. 128 px) des Profilbilds, legt die App
--    selbst an. Hält Rangliste und Chat schnell.
-- 2) player_photos(ids): liefert die erlaubten Profilbilder.
-- 3) player_photo_stamps: winzige Tabelle "Foto von X hat sich geändert",
--    damit alle offenen Geräte ein neues Foto sofort ohne Neuladen zeigen.
--
-- Voraussetzung: profil-extras.sql. Darf beliebig oft ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".
-- ============================================================================

alter table public.profile_extras add column if not exists photo_thumb text;
alter table public.profile_extras drop constraint if exists profile_extras_photo_thumb_check;
alter table public.profile_extras add constraint profile_extras_photo_thumb_check
  check (photo_thumb is null or (photo_thumb like 'data:image/%' and octet_length(photo_thumb) <= 40000));

-- Änderungs-Stempel (für alle lesbar, schreibt nur die Datenbank selbst).
create table if not exists public.player_photo_stamps (
  id uuid primary key references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now()
);
alter table public.player_photo_stamps enable row level security;
drop policy if exists "Foto-Stempel lesen" on public.player_photo_stamps;
create policy "Foto-Stempel lesen" on public.player_photo_stamps
  for select to anon, authenticated using (true);
revoke all on public.player_photo_stamps from anon, authenticated;
grant select on public.player_photo_stamps to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.player_photo_stamps;
exception when duplicate_object then null;
end $$;

-- Neues Profilbild: alte Vorschau verwerfen (die App legt gleich eine neue an)
-- und den Stempel setzen.
create or replace function public.profile_extras_photo_changed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Speichern läuft als "upsert": der INSERT-Teil sieht nur die mitgeschickten
  -- Spalten. Ohne Foto/Sichtbarkeit darin ist nichts zu melden.
  if tg_op = 'INSERT' and (new.photos -> 0) is null and new.photo_visibility is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if (new.photos -> 0) is distinct from (old.photos -> 0)
       and new.photo_thumb is not distinct from old.photo_thumb then
      new.photo_thumb := null;
    end if;
    if (new.photos -> 0) is not distinct from (old.photos -> 0)
       and new.photo_thumb is not distinct from old.photo_thumb
       and new.photo_visibility is not distinct from old.photo_visibility then
      return new;
    end if;
  end if;
  insert into public.player_photo_stamps (id, changed_at) values (new.id, now())
  on conflict (id) do update set changed_at = excluded.changed_at;
  return new;
end;
$$;

drop trigger if exists profile_extras_photo_changed on public.profile_extras;
create trigger profile_extras_photo_changed
  before insert or update on public.profile_extras
  for each row execute function public.profile_extras_photo_changed();

-- Eigene Vorschau speichern (nur ein kleines Bild, nur fürs eigene Konto).
create or replace function public.set_my_photo_thumb(p_thumb text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if p_thumb is not null and (p_thumb not like 'data:image/%' or octet_length(p_thumb) > 40000) then
    raise exception 'Vorschau ungültig';
  end if;
  update public.profile_extras
     set photo_thumb = p_thumb
   where id = auth.uid()
     and photo_thumb is distinct from p_thumb
     and (photos -> 0) is not null
     and jsonb_typeof(photos -> 0) = 'string';
end;
$$;

-- Erlaubte Profilbilder (Vorschau, sonst das Foto selbst) für bis zu 300 IDs.
create or replace function public.player_photos(p_ids uuid[])
returns table (id uuid, photo text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_has_friends boolean := to_regclass('public.friendships') is not null;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return; end if;
  if cardinality(p_ids) > 300 then p_ids := p_ids[1:300]; end if;
  return query
    select e.id, coalesce(e.photo_thumb, e.photos ->> 0)
    from public.profile_extras e
    where e.id = any(p_ids)
      and jsonb_typeof(e.photos -> 0) = 'string'
      and (
        e.id = v_me
        or e.photo_visibility = 'public'
        or (v_me is not null and v_has_friends and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and least(f.requester_id, f.addressee_id) = least(v_me, e.id)
            and greatest(f.requester_id, f.addressee_id) = greatest(v_me, e.id)
        ))
      );
end;
$$;

revoke all on function public.player_photos(uuid[]) from public;
grant execute on function public.player_photos(uuid[]) to anon, authenticated;
revoke all on function public.set_my_photo_thumb(text) from public, anon;
grant execute on function public.set_my_photo_thumb(text) to authenticated;
revoke all on function public.profile_extras_photo_changed() from public, anon, authenticated;

-- Kontrolle: sollte "player_photo_stamps | true" zeigen.
select relname as tabelle, relrowsecurity as rls_aktiv
from pg_class
where oid = 'public.player_photo_stamps'::regclass;
