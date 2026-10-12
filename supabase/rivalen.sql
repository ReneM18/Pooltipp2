-- PoolTipp – Rivalen-Vergleich (Rene, 12.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Jeder kann seine Statistik mit einem anderen Spieler vergleichen (Suche
-- nach Name oder #Nummer). Wer sieht wessen Statistik, entscheidet jeder
-- selbst: "public" (Alle, Standard), "friends" (nur Freunde) oder "private"
-- (niemand). Die eigene Statistik sieht man immer.
-- Gerechnet wird nur hier in der Datenbank; ohne Freigabe kommt nichts heraus.
-- Bestehende Tipps, Punkte und Coins werden nicht verändert.

begin;

alter table public.profile_extras add column if not exists stats_visibility text;

-- Darf p_viewer die Statistik von p_owner sehen?
create or replace function public.stats_visible(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_viewer is not null and (
    p_viewer = p_owner
    or coalesce((select e.stats_visibility from public.profile_extras e where e.id = p_owner), 'public') = 'public'
    or (
      coalesce((select e.stats_visibility from public.profile_extras e where e.id = p_owner), 'public') = 'friends'
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and least(f.requester_id, f.addressee_id) = least(p_viewer, p_owner)
          and greatest(f.requester_id, f.addressee_id) = greatest(p_viewer, p_owner)
      )
    )
  );
$$;

-- Eigene Einstellung lesen / speichern (Speichern-Knopf im Profil).
create or replace function public.my_stats_visibility()
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select stats_visibility from public.profile_extras where id = auth.uid()), 'public');
$$;

create or replace function public.set_stats_visibility(p_value text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if p_value not in ('public', 'friends', 'private') then
    raise exception 'Ungültige Auswahl';
  end if;
  insert into public.profile_extras (id, stats_visibility, updated_at)
  values (v_uid, p_value, now())
  on conflict (id) do update set stats_visibility = excluded.stats_visibility, updated_at = now();
  return p_value;
end;
$$;

-- Spieler suchen ("#1002" / "1002" = Nummer, sonst Name ab 2 Zeichen) –
-- mit Hinweis, ob man die Statistik sehen darf.
create or replace function public.search_rivals(p_query text)
returns table (id uuid, display_name text, user_number integer, is_friend boolean, visible boolean)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_q text := btrim(coalesce(p_query, ''));
  v_digits text := ltrim(btrim(coalesce(p_query, '')), '#');
begin
  if v_me is null then
    return;
  end if;
  return query
    select p.id, p.display_name, p.user_number,
           exists (
             select 1 from public.friendships f
             where f.status = 'accepted'
               and least(f.requester_id, f.addressee_id) = least(v_me, p.id)
               and greatest(f.requester_id, f.addressee_id) = greatest(v_me, p.id)
           ),
           public.stats_visible(v_me, p.id)
    from public.profiles p
    where p.id <> v_me
      and (
        (v_digits ~ '^[0-9]{1,9}$' and p.user_number = v_digits::int)
        or (not v_digits ~ '^[0-9]{1,9}$' and char_length(v_q) >= 2
            and p.display_name ilike '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      )
    order by (lower(p.display_name) = lower(v_q)) desc, p.display_name, p.user_number
    limit 20;
end;
$$;

-- Statistik eines Spielers (nur intern, ohne Sichtbarkeits-Prüfung).
create or replace function public.rival_stats_internal(p_user uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_profile record;
  v_rang int := 0;
  v_best text;
  v_tips int;
  v_eval int;
  v_exakt int;
  v_richtig int;
  v_streak int := 0;
  v_last date;
begin
  select display_name, user_number, rang_punkte, streak_count, last_tip_date into v_profile
  from public.profiles where id = p_user;
  if not found then
    return null;
  end if;

  select coalesce(sum(case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else 0 end), 0)::int
  into v_rang
  from jsonb_each(case when jsonb_typeof(v_profile.rang_punkte) = 'object' then v_profile.rang_punkte else '{}'::jsonb end) as e(k, v);

  select k into v_best
  from jsonb_each(case when jsonb_typeof(v_profile.rang_punkte) = 'object' then v_profile.rang_punkte else '{}'::jsonb end) as e(k, v)
  where jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric > 0
  order by (v #>> '{}')::numeric desc
  limit 1;

  select count(*)::int,
         count(*) filter (where t.evaluated and t.result_tier is not null)::int,
         count(*) filter (where t.evaluated and t.result_tier = 'exakt')::int,
         count(*) filter (where t.evaluated and t.result_tier in ('exakt', 'differenz', 'tendenz'))::int
  into v_tips, v_eval, v_exakt, v_richtig
  from public.tips t
  where t.user_id = p_user and t.refunded_at is null and not coalesce(t.ranking_legacy, false);

  -- Serie zählt nur, wenn heute oder gestern getippt wurde.
  v_last := public.pooltipp_day(public.try_timestamptz(v_profile.last_tip_date::text));
  if v_last is not null and v_last >= public.pooltipp_day(now()) - 1 then
    v_streak := coalesce(v_profile.streak_count, 0);
  end if;

  return jsonb_build_object(
    'name', v_profile.display_name,
    'number', v_profile.user_number,
    'visible', true,
    'rang', v_rang,
    'bestSport', v_best,
    'tips', v_tips,
    'evaluated', v_eval,
    'exakt', v_exakt,
    'richtig', v_richtig,
    'streak', v_streak
  );
end;
$$;

-- Vergleich: ich gegen p_other. Ohne Freigabe nur Name + "visible": false.
create or replace function public.rival_compare(p_other uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_other jsonb;
  v_me_wins int := 0;
  v_other_wins int := 0;
  v_games int := 0;
begin
  if v_me is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if not public.stats_visible(v_me, p_other) then
    select jsonb_build_object('name', display_name, 'number', user_number, 'visible', false)
    into v_other from public.profiles where id = p_other;
    return jsonb_build_object('me', public.rival_stats_internal(v_me), 'other', v_other, 'h2h', null);
  end if;

  v_other := public.rival_stats_internal(p_other);

  -- Direkt gegeneinander: gleiche Spiele, beide ausgewertet – wer war besser?
  select count(*)::int,
         count(*) filter (where a_rank > b_rank)::int,
         count(*) filter (where b_rank > a_rank)::int
  into v_games, v_me_wins, v_other_wins
  from (
    select
      case a.result_tier when 'exakt' then 3 when 'differenz' then 2 when 'tendenz' then 1 else 0 end as a_rank,
      case b.result_tier when 'exakt' then 3 when 'differenz' then 2 when 'tendenz' then 1 else 0 end as b_rank
    from public.tips a
    join public.tips b on b.match_id = a.match_id and b.user_id = p_other
    where a.user_id = v_me
      and a.evaluated and a.result_tier is not null and a.refunded_at is null
      and b.evaluated and b.result_tier is not null and b.refunded_at is null
  ) x;

  return jsonb_build_object(
    'me', public.rival_stats_internal(v_me),
    'other', v_other,
    'h2h', jsonb_build_object('games', v_games, 'me', v_me_wins, 'other', v_other_wins)
  );
end;
$$;

revoke all on function public.stats_visible(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rival_stats_internal(uuid) from public, anon, authenticated;
revoke all on function public.my_stats_visibility() from public, anon;
revoke all on function public.set_stats_visibility(text) from public, anon;
revoke all on function public.search_rivals(text) from public, anon;
revoke all on function public.rival_compare(uuid) from public, anon;
grant execute on function public.my_stats_visibility() to authenticated;
grant execute on function public.set_stats_visibility(text) to authenticated;
grant execute on function public.search_rivals(text) to authenticated;
grant execute on function public.rival_compare(uuid) to authenticated;

commit;
