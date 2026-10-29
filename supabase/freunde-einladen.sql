-- ============================================================================
-- PoolTipp – Freunde per Link einladen
-- ============================================================================
-- Jeder Spieler hat einen eigenen Einladungslink (/einladung?code=...).
-- Wer ihn öffnet und eingeloggt ist (oder sich danach registriert), ist
-- sofort mit dem Einladenden befreundet, ohne Anfrage und Annehmen.
--
-- Der Code ist zufällig und nicht die Nutzernummer: Sonst könnte jeder mit
-- einer erfundenen Nummer ungefragt Freund von jedem werden.
--
-- Voraussetzung: freunde.sql und chat.sql sind schon gelaufen.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

create table if not exists public.friend_invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- Die App kommt nur über die Funktionen unten an die Codes, nie direkt an
-- die Tabelle (sonst könnte man alle Codes auslesen).
alter table public.friend_invite_codes enable row level security;
revoke all on public.friend_invite_codes from anon, authenticated;

-- Meinen Einladungscode holen, beim ersten Mal anlegen.
create or replace function public.my_friend_invite()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_code text;
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  select code into v_code from public.friend_invite_codes where user_id = v_me;
  if v_code is not null then
    return v_code;
  end if;
  loop
    -- 8 Zeichen ohne leicht verwechselbare (0/O, 1/I/L).
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code
      from generate_series(1, 8);
    begin
      insert into public.friend_invite_codes (user_id, code) values (v_me, v_code);
      return v_code;
    exception when unique_violation then
      -- Gleichzeitig schon angelegt? Dann den nehmen, sonst neuer Versuch.
      select code into v_code from public.friend_invite_codes where user_id = v_me;
      if v_code is not null then
        return v_code;
      end if;
    end;
  end loop;
end;
$$;

-- Wer lädt ein? Auch ohne Konto lesbar, damit die Einladungsseite schon vor
-- dem Registrieren den Namen zeigt. Gibt nur Name und Nummer zurück.
create or replace function public.friend_invite_info(p_code text)
returns table (inviter_id uuid, display_name text, user_number integer)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.display_name, p.user_number
  from public.friend_invite_codes c
  join public.profiles p on p.id = c.user_id
  where c.code = upper(btrim(coalesce(p_code, '')));
$$;

-- Einladung annehmen: sofort befreundet. Gibt zurück:
-- 'friend' (jetzt befreundet), 'already' (wart es schon) oder 'self'
-- (eigener Link).
create or replace function public.accept_friend_invite(p_code text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_rel text;
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  select user_id into v_inviter
    from public.friend_invite_codes
    where code = upper(btrim(coalesce(p_code, '')));
  if v_inviter is null then
    raise exception 'Dieser Einladungslink gilt nicht (mehr).';
  end if;
  if v_inviter = v_me then
    return 'self';
  end if;
  if public.is_blocked_between(v_me, v_inviter) then
    raise exception 'Diese Einladung kann nicht angenommen werden.';
  end if;

  v_rel := public.friend_relation(v_me, v_inviter);
  if v_rel = 'friend' then
    return 'already';
  elsif v_rel = 'none' then
    insert into public.friendships (requester_id, addressee_id, status, accepted_at)
      values (v_inviter, v_me, 'accepted', now())
      on conflict do nothing;
  end if;
  -- Offene Anfrage in eine der beiden Richtungen: gleich annehmen.
  update public.friendships
    set status = 'accepted', accepted_at = now()
    where status = 'pending'
      and least(requester_id, addressee_id) = least(v_me, v_inviter)
      and greatest(requester_id, addressee_id) = greatest(v_me, v_inviter);
  return 'friend';
end;
$$;

revoke all on function public.my_friend_invite() from public, anon;
revoke all on function public.friend_invite_info(text) from public;
revoke all on function public.accept_friend_invite(text) from public, anon;
grant execute on function public.my_friend_invite() to authenticated;
grant execute on function public.friend_invite_info(text) to anon, authenticated;
grant execute on function public.accept_friend_invite(text) to authenticated;
