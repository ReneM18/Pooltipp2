-- Konto löschen: Ein Spieler löscht sein EIGENES Konto (Knopf im Profil).
--
-- Was dieses Skript einrichtet:
--  delete_my_account(): löscht ausschließlich das Konto der Person, die
--  gerade eingeloggt ist. Niemand kann damit ein fremdes Konto löschen, und
--  das Admin-Konto lässt sich damit gar nicht löschen (schützt alles, was der
--  Admin angelegt hat). Die Funktion läuft nur, wenn der Spieler im Profil
--  "LÖSCHEN" eintippt und bestätigt, nie automatisch.
--
-- Was beim Löschen passiert:
--  - Weg: Profil (Name, Sterne, Rangpunkte, Saison-XP), Fotos/Profil-Extras,
--    die eigenen Tipps, Freundschaften, Herzensvereine, Mitgliedschaften in
--    Tipprunden samt Tipps dort, eigene Feed-Einträge und das Login selbst.
--  - Offene Duelle: Wer gegen den gelöschten Spieler gewettet hat, bekommt
--    seinen Einsatz zurück. Danach verschwinden die Duelle.
--  - Tipprunden, die der Spieler gegründet hat: gehen an das Mitglied über,
--    das am längsten dabei ist. Ist niemand sonst drin, wird die Runde
--    gelöscht.
--  - Chat-Nachrichten und Spiel-Kommentare bleiben stehen (sonst ergeben
--    Gespräche keinen Sinn mehr), zeigen aber "Gelöschter Spieler" statt
--    des Namens.
--  - Nicht berührt: Spiele, Teams, News, Turniere und alle Tipps, Sterne und
--    Daten anderer Spieler.
--
-- Darf beliebig oft ausgeführt werden. Löscht beim Ausführen NICHTS – es
-- richtet nur die Funktion für den Knopf ein.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".

-- Kommentar-Schutz (aus fixes-features40.sql) um eine Ausnahme ergänzt:
-- Spieler im Browser können Kommentare weiterhin nur liken, nie umschreiben.
-- Datenbank-Funktionen wie das Konto-Löschen dürfen den Autor aber auf
-- "Gelöschter Spieler" setzen. Ohne diese Ausnahme würde das Löschen jedes
-- Kontos, das je einen Kommentar geschrieben hat, mit einem Fehler abbrechen.
create or replace function public.protect_comment_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
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

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league record;
  v_new_owner uuid;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if public.is_admin() then
    raise exception 'Das Admin-Konto kann nicht gelöscht werden';
  end if;

  -- Offene Duelle: Einsatz der Gegenseite zurück. "pending" = nur der
  -- Herausforderer hat bezahlt, "offen" = beide.
  if to_regclass('public.duels') is not null then
    update public.profiles p
    set free_stars = p.free_stars + r.refund, updated_at = now()
    from (
      select case when d.challenger_id = v_uid then d.opponent_id else d.challenger_id end as user_id,
             sum(d.stake) as refund
      from public.duels d
      where (d.challenger_id = v_uid or d.opponent_id = v_uid)
        and d.challenger_id <> d.opponent_id
        and (d.status = 'offen' or (d.status = 'pending' and d.opponent_id = v_uid))
      group by 1
    ) r
    where p.id = r.user_id;
  end if;

  -- Selbst gegründete Tipprunden an das dienstälteste Mitglied übergeben.
  if to_regclass('public.leagues') is not null then
    for v_league in
      select id from public.leagues where creator_id = v_uid for update
    loop
      select m.user_id into v_new_owner
      from public.league_members m
      where m.league_id = v_league.id and m.user_id <> v_uid
      order by m.joined_at, m.user_id
      limit 1;
      if v_new_owner is not null then
        update public.leagues set creator_id = v_new_owner where id = v_league.id;
      end if;
      -- Ohne weitere Mitglieder löscht das Löschen des Kontos die Runde mit.
    end loop;
  end if;

  if to_regclass('public.chat_messages') is not null then
    update public.chat_messages set author_name = 'Gelöschter Spieler' where user_id = v_uid;
  end if;
  if to_regclass('public.match_comments') is not null then
    update public.match_comments set author_name = 'Gelöschter Spieler' where user_id = v_uid;
  end if;
  if to_regclass('public.activity_feed') is not null then
    delete from public.activity_feed where user_id = v_uid;
  end if;

  -- Das Login selbst. Alles, was per "on delete cascade" daran hängt
  -- (Profil, Tipps, Freundschaften, Duelle, Tipprunden-Mitgliedschaften,
  -- Vereine, Profil-Extras), verschwindet damit automatisch mit.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
