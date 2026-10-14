-- ============================================================================
-- Wachstums-Übersicht im Admin-Bereich (Reiter "Wachstum", Rene 14.10.2026)
-- ============================================================================
-- Rechnet pro Woche (Montag bis Sonntag, österreichische Zeit) aus:
--   aktiv        – wie viele mindestens einen Tipp abgegeben haben
--                  (normale Tipps oder Tipps in einer Tipprunde)
--   neu          – wie viele sich in dieser Woche angemeldet haben
--   ueber_runde  – davon am Tag der Anmeldung einer Tipprunde beigetreten,
--                  also sehr wahrscheinlich über einen Einladungslink
--   wieder       – davon in der Woche danach (wieder) getippt haben;
--                  null für die laufende Woche
-- Der Admin selbst wird nirgends mitgezählt. Nur der Admin darf die Funktion
-- aufrufen. Es werden keine Tabellen angelegt oder geändert, nur gelesen.
-- Ein zweiter Durchlauf des Skripts schadet nicht.

create or replace function public.admin_wachstum(p_wochen int default 8)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_tz constant text := 'Europe/Vienna';
  v_wochen int := least(greatest(coalesce(p_wochen, 8), 1), 52);
  v_this_week date := date_trunc('week', now() at time zone v_tz)::date;
  v_first_week date := v_this_week - (v_wochen - 1) * 7;
  v_admin_ids uuid[];
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Nur der Admin';
  end if;

  -- Admin-Konto(s) wie in is_admin() über die E-Mail erkennen
  select coalesce(array_agg(id), '{}') into v_admin_ids
  from auth.users
  where email = 'rene.cr7@gmx.at'; -- <- ADMIN_EMAIL wie in is_admin()

  with weeks as (
    select generate_series(v_first_week, v_this_week, interval '7 days')::date as wk
  ),
  -- Jede Tipp-Aktivität mit Woche (normale Tipps + Tipprunden-Tipps)
  activity as (
    select t.user_id, date_trunc('week', t.submitted_at at time zone v_tz)::date as wk
    from tips t
    where t.submitted_at >= (v_first_week::timestamp at time zone v_tz) - interval '7 days'
    union
    select lt.user_id, date_trunc('week', lt.updated_at at time zone v_tz)::date as wk
    from league_tips lt
    where lt.updated_at >= (v_first_week::timestamp at time zone v_tz) - interval '7 days'
  ),
  active_users as (
    select distinct user_id, wk from activity
    where not (user_id = any(v_admin_ids))
  ),
  newcomers as (
    select p.id as user_id,
           date_trunc('week', p.created_at at time zone v_tz)::date as wk,
           exists (
             select 1 from league_members lm
             where lm.user_id = p.id
               and lm.joined_at < p.created_at + interval '1 day'
           ) as via_runde
    from profiles p
    where p.created_at >= (v_first_week::timestamp at time zone v_tz)
      and not (p.id = any(v_admin_ids))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'woche', w.wk,
           'aktiv', (select count(*) from active_users a where a.wk = w.wk),
           'neu', (select count(*) from newcomers n where n.wk = w.wk),
           'ueber_runde', (select count(*) from newcomers n where n.wk = w.wk and n.via_runde),
           'wieder', case when w.wk = v_this_week then null else (
             select count(*) from newcomers n
             where n.wk = w.wk
               and exists (select 1 from active_users a where a.user_id = n.user_id and a.wk = w.wk + 7)
           ) end
         ) order by w.wk), '[]'::jsonb)
  into v_out
  from weeks w;

  return v_out;
end;
$$;

revoke all on function public.admin_wachstum(int) from public, anon;
grant execute on function public.admin_wachstum(int) to authenticated;
