-- ============================================================================
-- PoolTipp – Neue Tipp-Sportart Tennis (Rene, 10.11.2026, Variante B)
-- ============================================================================
-- Tennis wird eine Tipp-Sportart wie Fußball (eigene Rangliste, Rangpunkte,
-- Rang-Icon, Lieblingsspieler). Getippt wird das Satzergebnis (z. B. 2:1),
-- gespeichert wie ein Ergebnis-Tipp. Die Auswertung bleibt unverändert:
-- exakt = +10, richtiger Sieger (Tendenz) = +5, falsch = −3.
--
-- Keine neue Tabelle, also kein grant nötig. Bestehende Tipps, Punkte und
-- Rangpunkte bleiben, wie sie sind.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

-- 1) Prüfregeln (Herzensverein, Rang-Icon): Tennis zulassen. Die gerade
--    gültige Regel wird gelesen und nur um Tennis ergänzt, so bleibt alles
--    andere (z. B. Prestige-Icons) genau wie es ist.
do $$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.conname in ('club_fans_sport_check', 'profiles_rank_icon_id_check')
      and c.connamespace = 'public'::regnamespace
  loop
    v_def := r.def;
    if v_def like '%Tennis%' then
      continue;
    end if;
    v_new := v_def;
    v_new := replace(v_new, '''NHL''::text', '''NHL''::text, ''Tennis''::text');
    v_new := replace(v_new, '''sport-NHL''::text', '''sport-NHL''::text, ''sport-Tennis''::text');
    v_new := replace(v_new, '''prestige-NHL''::text', '''prestige-NHL''::text, ''prestige-Tennis''::text');
    if v_new <> v_def then
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
      execute format('alter table %s add constraint %I %s', r.tbl, r.conname, v_new);
      raise notice 'Prüfregel % um Tennis ergänzt', r.conname;
    end if;
  end loop;
end $$;

-- 2) Neue Konten starten auch bei Tennis mit 0 Rangpunkten.
alter table public.profiles alter column rang_punkte
  set default '{"Fußball":0,"NFL":0,"NBA":0,"NHL":0,"Handball":0,"Tennis":0}'::jsonb;

-- 3) Datenbank-Funktionen mit fester Sportarten-Liste um Tennis ergänzen:
--    - Listen ('Fußball', 'NFL', 'NBA', 'NHL'[, 'Handball']) bekommen 'Tennis'
--      (Lieblingsverein setzen/anzeigen, Prestige usw.),
--    - Feed-Symbole (… when 'NHL' then '🏒' …) bekommen 🎾 statt ⚽.
--    Es wird jeweils die gerade laufende Fassung der Funktion genommen und
--    nur an diesen Stellen ergänzt; alles andere bleibt Wort für Wort gleich.
do $$
declare
  f record;
  v_def text;
  v_new text;
begin
  for f in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and (p.prosrc like '%''Fußball'', ''NFL'', ''NBA'', ''NHL''%'
           or p.prosrc like '%when ''NHL'' then ''🏒''%')
      and p.prosrc not like '%Tennis%'
  loop
    v_def := pg_get_functiondef(f.oid);
    v_new := regexp_replace(
      v_def,
      '''Fußball'', ''NFL'', ''NBA'', ''NHL''(, ''Handball'')?',
      '''Fußball'', ''NFL'', ''NBA'', ''NHL''\1, ''Tennis''',
      'g'
    );
    v_new := replace(v_new, 'when ''NHL'' then ''🏒''', 'when ''NHL'' then ''🏒'' when ''Tennis'' then ''🎾''');
    if v_new <> v_def then
      execute v_new;
      raise notice 'Funktion % um Tennis ergänzt', f.proname;
    end if;
  end loop;
end $$;

-- Kontrolle (optional): zeigt die Funktionen, die Tennis jetzt kennen.
-- select proname from pg_proc
-- where pronamespace = 'public'::regnamespace and prosrc like '%Tennis%';
