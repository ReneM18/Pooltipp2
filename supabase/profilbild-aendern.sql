-- ============================================================================
-- Profilbild ändern nur 1× pro Quartal (Rene, 04.11.2026), wie der Name
-- (name-aendern.sql).
--
-- Das Profilbild ist das erste Foto in profile_extras.photos.
-- - 1× pro Quartal (3 Monate) gratis ein neues Profilbild.
-- - Früher nur gegen Coins (Preis: photo_change_price()).
-- - Anfrage beim Support: der Admin gibt eine Änderung frei
--   (admin_grant_photo_change, /admin → Community → Spielernamen).
-- Ablauf: die App holt sich vor dem Hochladen eine Freigabe
-- (unlock_photo_change). Ohne Freigabe lehnt die Datenbank ein neues
-- Profilbild ab. Foto löschen geht immer. Coins werden nur abgebucht, nie
-- vergeben. Im Supabase SQL Editor einmal ausführen.
-- Braucht: profil-extras.sql, auswertung-server.sql (take_stars,
-- is_client_write), social-features.sql (is_admin).
-- ============================================================================

-- 1) Wann zuletzt gratis geändert, und ob gerade eine Änderung freigegeben ist
alter table public.profile_extras add column if not exists photo_changed_at timestamptz;
alter table public.profile_extras add column if not exists photo_change_credit boolean not null default false;

-- 2) Preis einer vorzeitigen Änderung in Coins
create or replace function public.photo_change_price()
returns int
language sql
immutable
as $$
  select 500
$$;

-- 3) Neues Profilbild aus dem Browser nur mit Freigabe; die Freigabe wird
--    dabei verbraucht. Zeitpunkt und Freigabe darf der Browser nicht setzen.
create or replace function public.protect_profile_photo()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_write() then
    return new;
  end if;
  new.photo_changed_at := old.photo_changed_at;
  new.photo_change_credit := old.photo_change_credit;
  if (new.photos -> 0) is distinct from (old.photos -> 0)
     and jsonb_typeof(new.photos -> 0) = 'string' then
    if old.photo_change_credit then
      new.photo_change_credit := false;
    else
      raise exception 'Profilbild-Änderung nicht freigegeben';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_photo on public.profile_extras;
create trigger protect_profile_photo
  before update on public.profile_extras
  for each row execute procedure public.protect_profile_photo();

-- 4) Stand für das Profil
create or replace function public.photo_change_info()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_at timestamptz;
  v_credit boolean;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select photo_changed_at, photo_change_credit into v_at, v_credit
  from public.profile_extras where id = auth.uid();
  return jsonb_build_object(
    'next_free_at', case when v_at is null then null else v_at + interval '3 months' end,
    'price', public.photo_change_price(),
    'credit', coalesce(v_credit, false)
  );
end;
$$;

-- 5) Freigabe holen: gratis, wenn das Quartal um ist, sonst mit p_pay = true
--    gegen Coins.
create or replace function public.unlock_photo_change(p_pay boolean default false)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
  v_credit boolean;
  v_paid int := 0;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  insert into public.profile_extras (id) values (v_uid) on conflict (id) do nothing;
  select photo_changed_at, photo_change_credit into v_at, v_credit
  from public.profile_extras where id = v_uid for update;

  if v_credit then
    return jsonb_build_object('paid', 0);
  end if;
  if v_at is null or v_at + interval '3 months' <= now() then
    update public.profile_extras set photo_changed_at = now(), photo_change_credit = true where id = v_uid;
    return jsonb_build_object('paid', 0);
  end if;
  if not coalesce(p_pay, false) then
    raise exception 'Profilbild erst wieder gratis ab %', to_char(v_at + interval '3 months', 'DD.MM.YYYY');
  end if;
  v_paid := public.take_stars(v_uid, public.photo_change_price(), false, true);
  update public.profile_extras set photo_change_credit = true where id = v_uid;
  return jsonb_build_object('paid', v_paid);
end;
$$;

-- 6) Admin (Anfrage beim Support): eine Änderung freigeben, ohne Coins
create or replace function public.admin_grant_photo_change(p_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nur für den Admin';
  end if;
  insert into public.profile_extras (id) values (p_user) on conflict (id) do nothing;
  update public.profile_extras set photo_change_credit = true where id = p_user;
end;
$$;

-- 7) Rechte: nur eingeloggte Spieler, die Funktionen prüfen selbst
revoke all on function public.photo_change_info() from public, anon;
revoke all on function public.unlock_photo_change(boolean) from public, anon;
revoke all on function public.admin_grant_photo_change(uuid) from public, anon;
grant execute on function public.photo_change_info() to authenticated;
grant execute on function public.unlock_photo_change(boolean) to authenticated;
grant execute on function public.admin_grant_photo_change(uuid) to authenticated;
