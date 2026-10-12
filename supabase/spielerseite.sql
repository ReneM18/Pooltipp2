-- PoolTipp – Spielerseite mit echten Fotos (Rene, 12.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Die Seite eines anderen Spielers zeigte bisher Demo-Fotos. Jetzt liefert
-- player_gallery die echten Fotos (bis zu 3) – nur, wenn der Spieler sie
-- zeigt: "Öffentlich" für alle, "Nur für Freunde" nur für Freunde (gleiche
-- Regel wie beim Profilbild in supabase/profilfoto-fuer-alle.sql).
-- Bestehende Daten werden nicht verändert.

create or replace function public.player_gallery(p_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row record;
  v_allowed boolean;
begin
  select e.photos, coalesce(e.photo_visibility, 'friends') as visibility into v_row
  from public.profile_extras e where e.id = p_id;
  if not found then
    return jsonb_build_object('visibility', 'public', 'allowed', true, 'photos', '[]'::jsonb);
  end if;

  v_allowed := p_id = v_me
    or v_row.visibility = 'public'
    or (v_me is not null and to_regclass('public.friendships') is not null and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(v_me, p_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(v_me, p_id)
    ));

  return jsonb_build_object(
    'visibility', v_row.visibility,
    'allowed', v_allowed,
    'photos', case
      when v_allowed and jsonb_typeof(v_row.photos) = 'array' then (
        select coalesce(jsonb_agg(x), '[]'::jsonb)
        from jsonb_array_elements(v_row.photos) with ordinality as t(x, n)
        where jsonb_typeof(x) = 'string' and n <= 3
      )
      else '[]'::jsonb
    end
  );
end;
$$;

revoke all on function public.player_gallery(uuid) from public;
grant execute on function public.player_gallery(uuid) to anon, authenticated;
