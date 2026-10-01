-- ============================================================================
-- PoolTipp – Korrekturen für features40
-- ============================================================================
-- Behebt Fehler, die beim Komplett-Test (Tipp, Duell, Kommentar, Chat)
-- aufgefallen sind:
--   1) Sterne gehen nicht mehr verloren, wenn die Datenbank (Duell-Gewinn,
--      abgelehntes Duell) und die App gleichzeitig Sterne verändern.
--   2) Jeder Tipp merkt sich, mit welchem Endstand er ausgewertet wurde, damit
--      eine spätere Endstand-Korrektur im Admin-Bereich bei ALLEN Spielern
--      ankommt (nicht nur beim Admin).
--   3) Sicherheit: Duelle kann nur noch der Admin auswerten, Duelle können nur
--      noch als "pending" angelegt und nur über accept_duel angenommen
--      werden, fremde Kommentare können nicht mehr umgeschrieben werden.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> Neues Query -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach ausgeführt
-- werden. Am besten VOR dem Hochladen von features40 ausführen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Sterne nur noch als Änderung (+/-) statt als fester Wert speichern.
--    Vorher schrieb die App immer ihren eigenen, lokalen Sterne-Stand in die
--    Datenbank – und überschrieb damit Gutschriften, die die Datenbank in der
--    Zwischenzeit selbst gebucht hatte (z. B. Duell-Gewinn). Gibt den neuen,
--    echten Stand zurück, damit die App ihn übernehmen kann.
-- ----------------------------------------------------------------------------
create or replace function public.add_stars(p_delta int)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_stars int;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  update public.profiles
  set free_stars = greatest(0, free_stars + p_delta), updated_at = now()
  where id = auth.uid()
  returning free_stars into v_stars;
  return v_stars;
end;
$$;

grant execute on function public.add_stars(int) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Endstand, mit dem ein Tipp ausgewertet wurde.
-- ----------------------------------------------------------------------------
alter table public.tips
  add column if not exists evaluated_home_score integer,
  add column if not exists evaluated_away_score integer;

-- ----------------------------------------------------------------------------
-- 3a) Duelle auswerten darf nur noch der Admin. Vorher konnte jeder
--     eingeloggte User die Funktion mit einem erfundenen Endstand aufrufen
--     und so Duelle (auch fremde) für sich entscheiden.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_duels_for_match(p_match_id text, p_actual_home int, p_actual_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
  v_challenger_home int;
  v_challenger_away int;
  v_opponent_home int;
  v_opponent_away int;
  v_challenger_tier text;
  v_opponent_tier text;
  v_result text;
  v_credit_challenger int;
  v_credit_opponent int;
begin
  if not public.is_admin() then
    raise exception 'Nur der Admin kann Duelle auswerten';
  end if;

  for v_duel in
    select * from public.duels
    where match_id = p_match_id and status in ('offen', 'pending')
    for update
  loop
    if v_duel.status = 'pending' then
      update public.duels set status = 'verfallen', resolved_at = now() where id = v_duel.id;
      update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now()
      where id = v_duel.challenger_id;
      continue;
    end if;

    v_challenger_home := null;
    v_challenger_away := null;
    v_opponent_home := null;
    v_opponent_away := null;

    select predicted_home_score, predicted_away_score into v_challenger_home, v_challenger_away
    from public.tips where user_id = v_duel.challenger_id and match_id = p_match_id
    order by submitted_at desc limit 1;

    select predicted_home_score, predicted_away_score into v_opponent_home, v_opponent_away
    from public.tips where user_id = v_duel.opponent_id and match_id = p_match_id
    order by submitted_at desc limit 1;

    v_challenger_tier := case when v_challenger_home is null then 'falsch'
      else public.classify_tip(v_challenger_home, v_challenger_away, p_actual_home, p_actual_away) end;
    v_opponent_tier := case when v_opponent_home is null then 'falsch'
      else public.classify_tip(v_opponent_home, v_opponent_away, p_actual_home, p_actual_away) end;

    v_credit_challenger := 0;
    v_credit_opponent := 0;

    if public.tier_order(v_challenger_tier) > public.tier_order(v_opponent_tier) then
      v_result := 'challenger';
      v_credit_challenger := v_duel.stake * 2;
    elsif public.tier_order(v_opponent_tier) > public.tier_order(v_challenger_tier) then
      v_result := 'opponent';
      v_credit_opponent := v_duel.stake * 2;
    else
      v_result := 'unentschieden';
      v_credit_challenger := v_duel.stake;
      v_credit_opponent := v_duel.stake;
    end if;

    update public.duels
    set status = 'ausgewertet',
        my_tier = v_challenger_tier,
        opponent_tier = v_opponent_tier,
        result = v_result,
        stars_credited = greatest(v_credit_challenger, v_credit_opponent),
        resolved_at = now()
    where id = v_duel.id;

    if v_credit_challenger > 0 then
      update public.profiles set free_stars = free_stars + v_credit_challenger, updated_at = now()
      where id = v_duel.challenger_id;
    end if;
    if v_credit_opponent > 0 then
      update public.profiles set free_stars = free_stars + v_credit_opponent, updated_at = now()
      where id = v_duel.opponent_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.resolve_duels_for_match(text, int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 3b) Duelle nur noch als "pending" anlegen (vorher ging auch direkt
--     "offen" mit beliebigem Einsatz – ohne dass der Gegner je zugestimmt
--     oder bezahlt hatte) und nicht mehr direkt ändern. Annehmen läuft jetzt
--     über accept_duel, Ablehnen wie bisher über decline_duel.
-- ----------------------------------------------------------------------------
drop policy if exists "Duell herausfordern" on public.duels;
create policy "Duell herausfordern" on public.duels
  for insert with check (
    auth.uid() = challenger_id
    and challenger_id <> opponent_id
    and status = 'pending'
    and stake > 0
    and result is null
    and stars_credited is null
    and resolved_at is null
  );

drop policy if exists "Duell annehmen" on public.duels;

create or replace function public.accept_duel(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  if v_duel.opponent_id <> auth.uid() then
    raise exception 'Nur der Herausgeforderte kann annehmen';
  end if;
  if v_duel.status <> 'pending' then
    raise exception 'Duell ist nicht mehr offen';
  end if;
  update public.duels set status = 'offen' where id = p_duel_id;
end;
$$;

grant execute on function public.accept_duel(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3c) Kommentare: Liken darf weiterhin jeder, aber Text/Autor/Spiel eines
--     Kommentars kann niemand mehr nachträglich ändern (vorher konnte jeder
--     eingeloggte User fremde Kommentare umschreiben).
-- ----------------------------------------------------------------------------
create or replace function public.protect_comment_fields()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.match_id is distinct from old.match_id
    or new.user_id is distinct from old.user_id
    or new.author_name is distinct from old.author_name
    or new.text is distinct from old.text
    or new.created_at is distinct from old.created_at then
    raise exception 'Kommentare können nicht bearbeitet werden, nur geliked';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_comment_fields on public.match_comments;
create trigger protect_comment_fields
  before update on public.match_comments
  for each row execute procedure public.protect_comment_fields();

-- ----------------------------------------------------------------------------
-- 4) Eine Tipp-Auswertung kann nicht mehr von einem veralteten Browser-Tab
--    "zurückgedreht" werden. Die App speichert immer alle eigenen Tipps auf
--    einmal; ist dasselbe Konto in zwei Tabs/Geräten offen, konnte der eine
--    Tab die frische Auswertung des anderen mit seinem alten Stand ("noch
--    offen") überschreiben – der Tipp wäre dann beim nächsten Laden ein
--    zweites Mal ausgewertet worden.
-- ----------------------------------------------------------------------------
create or replace function public.keep_tip_evaluation()
returns trigger
language plpgsql
as $$
begin
  if old.evaluated and not new.evaluated then
    new.evaluated := old.evaluated;
    new.result_tier := old.result_tier;
    new.rang_delta := old.rang_delta;
    new.stars_delta := old.stars_delta;
    new.beat_percent := old.beat_percent;
    new.narration := old.narration;
    new.evaluated_home_score := old.evaluated_home_score;
    new.evaluated_away_score := old.evaluated_away_score;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_tip_evaluation on public.tips;
create trigger keep_tip_evaluation
  before update on public.tips
  for each row execute procedure public.keep_tip_evaluation();
