-- ============================================================================
-- PoolTipp – Saison-Pass gibt nie Coins
-- ============================================================================
-- Regel (Rene, 06.10.2026): Kein Pass gibt Coins, weder gratis noch Premium.
-- Premium soll später Geld kosten; gäbe der Pass Coins, käme man mit Geld an
-- Coins und damit an die zufälligen Trainingstaschen (Glücksspiel).
-- Level 10 im Herbst gibt deshalb statt 50 Coins den Profil-Rahmen
-- "Saison-Meister" (zeigt die App, kein SQL nötig).
--
-- Nimmt niemandem etwas weg: Wer Level 10 schon hatte, behält seine Coins.
-- Darf beliebig oft ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> einfügen -> Run.
-- ============================================================================

begin;

update public.season_pass_levels set stars_reward = 0 where stars_reward <> 0;

-- Sperre für später: eine neue Saison kann gar keine Coins mehr eintragen.
alter table public.season_pass_levels drop constraint if exists season_pass_ohne_coins;
alter table public.season_pass_levels add constraint season_pass_ohne_coins check (stars_reward = 0);

commit;
