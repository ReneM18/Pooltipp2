-- ============================================================================
-- Name ändern nur 1× pro Quartal (Rene, 04.11.2026)
--
-- Der Name auf der Sportlerkarte ist der normale App-Name (profiles.display_name).
-- - 1× pro Quartal (3 Monate) gratis ändern.
-- - Früher geht es nur gegen Coins (Preis: name_change_price()).
-- - Anfrage beim Support: der Admin ändert den Namen jederzeit
--   (admin_set_display_name, /admin → Community → Namen).
-- Der Browser darf den Namen nicht mehr direkt schreiben, nur noch über
-- change_display_name(). Im Supabase SQL Editor einmal ausführen.
-- Braucht: auswertung-server.sql (take_stars, is_client_write),
-- social-features.sql (is_admin).
-- ============================================================================

-- 1) Wann der Name zuletzt geändert wurde (leer = noch nie, nächste Änderung gratis)
alter table public.profiles add column if not exists name_changed_at timestamptz;

-- 2) Preis einer vorzeitigen Änderung in Coins
create or replace function public.name_change_price()
returns int
language sql
immutable
as $$
  select 500
$$;

-- 3) Browser darf Name und Zeitpunkt nicht direkt ändern
create or replace function public.protect_profile_name()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_write() then
    return new;
  end if;
  new.name_changed_at := old.name_changed_at;
  if new.display_name is distinct from old.display_name then
    raise exception 'Name bitte über „Name ändern“ im Profil ändern.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_name on public.profiles;
create trigger protect_profile_name
  before update on public.profiles
  for each row execute procedure public.protect_profile_name();

-- 4) Stand für das Profil: wann wieder gratis, was es vorher kostet
create or replace function public.name_change_info()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select name_changed_at into v_at from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'next_free_at', case when v_at is null then null else v_at + interval '3 months' end,
    'price', public.name_change_price()
  );
end;
$$;

-- 5) Eigenen Namen ändern. p_pay = true: vorzeitig gegen Coins.
create or replace function public.change_display_name(p_name text, p_pay boolean default false)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_old text;
  v_at timestamptz;
  v_free boolean;
  v_paid int := 0;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'Der Name muss 1 bis 40 Zeichen haben.';
  end if;

  select display_name, name_changed_at into v_old, v_at
  from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Profil nicht gefunden';
  end if;
  if v_old = v_name then
    return jsonb_build_object('paid', 0, 'next_free_at', case when v_at is null then null else v_at + interval '3 months' end);
  end if;

  v_free := v_at is null or v_at + interval '3 months' <= now();
  if not v_free then
    if not coalesce(p_pay, false) then
      raise exception 'Name erst wieder gratis ab %', to_char(v_at + interval '3 months', 'DD.MM.YYYY');
    end if;
    v_paid := public.take_stars(v_uid, public.name_change_price(), false, true);
  end if;

  update public.profiles
  set display_name = v_name, name_changed_at = now(), updated_at = now()
  where id = v_uid;

  return jsonb_build_object('paid', v_paid, 'next_free_at', now() + interval '3 months');
end;
$$;

-- 6) Admin (Anfrage beim Support): Namen eines Spielers jederzeit ändern,
--    ohne Coins und ohne die Quartals-Frist des Spielers zu verbrauchen.
create or replace function public.admin_set_display_name(p_user uuid, p_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_admin() then
    raise exception 'Nur für den Admin';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'Der Name muss 1 bis 40 Zeichen haben.';
  end if;
  update public.profiles set display_name = v_name, updated_at = now() where id = p_user;
  if not found then
    raise exception 'Spieler nicht gefunden';
  end if;
end;
$$;

-- 7) Rechte: nur eingeloggte Spieler, die Funktionen prüfen selbst
revoke all on function public.name_change_info() from public, anon;
revoke all on function public.change_display_name(text, boolean) from public, anon;
revoke all on function public.admin_set_display_name(uuid, text) from public, anon;
grant execute on function public.name_change_info() to authenticated;
grant execute on function public.change_display_name(text, boolean) to authenticated;
grant execute on function public.admin_set_display_name(uuid, text) to authenticated;
