-- ============================================================================
-- PoolTipp – echter Chat: private Nachrichten unter Freunden
-- ============================================================================
-- 1) Private Nachrichten zwischen zwei Spielern. Schreiben kann man nur
--    Freunden (angenommene Freundschaft). Lesen kann jede Nachricht nur, wer
--    sie geschickt oder bekommen hat.
-- 2) "Gelesen"-Häkchen und Zähler für ungelesene Nachrichten.
-- 3) Blockieren: beendet die Freundschaft, danach kann die Person weder
--    schreiben noch eine neue Freundschaftsanfrage schicken.
-- 4) Community-Chat: die zwei Beispiel-Nachrichten ("Marco T.", "Sabine K.")
--    werden gelöscht, und der Name einer Nachricht kommt ab jetzt immer aus
--    dem Profil (niemand kann unter fremdem Namen schreiben).
--
-- Bestehende Daten (Tipps, Sterne, Freunde, Community-Nachrichten echter
-- Spieler) bleiben unverändert.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- Braucht vorher freunde.sql (ist schon ausgeführt).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Private Nachrichten
-- ----------------------------------------------------------------------------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists direct_messages_pair_idx on public.direct_messages(
  least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc
);
create index if not exists direct_messages_unread_idx on public.direct_messages(recipient_id)
  where read_at is null;
create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id, created_at desc);

alter table public.direct_messages enable row level security;
drop policy if exists "Eigene Nachrichten lesen" on public.direct_messages;
create policy "Eigene Nachrichten lesen" on public.direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Lesen nur die eigenen (RLS oben), schreiben nur über die Funktionen unten.
revoke all on public.direct_messages from anon, authenticated;
grant select on public.direct_messages to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Blockieren
-- ----------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "Eigene Blockierungen lesen" on public.user_blocks;
create policy "Eigene Blockierungen lesen" on public.user_blocks
  for select using (auth.uid() = blocker_id);
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;

-- Hat einer der beiden den anderen blockiert?
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- Person blockieren: Freundschaft (oder offene Anfrage) endet sofort.
create or replace function public.block_user(p_other uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'Du kannst dich nicht selbst blockieren.';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_me, p_other)
    on conflict do nothing;
  delete from public.friendships
    where least(requester_id, addressee_id) = least(v_me, p_other)
      and greatest(requester_id, addressee_id) = greatest(v_me, p_other);
end;
$$;

-- Blockierung aufheben (Freundschaft muss danach neu angefragt werden).
create or replace function public.unblock_user(p_other uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_other;
end;
$$;

-- Wen habe ich blockiert? (mit Name und Nummer)
create or replace function public.my_blocked()
returns table (other_id uuid, display_name text, user_number integer)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.display_name, p.user_number
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by p.display_name;
$$;

-- Freundschaftsanfrage wie bisher (freunde.sql), nur jetzt gesperrt, wenn
-- einer den anderen blockiert hat.
create or replace function public.send_friend_request(p_other uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_rel text;
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'Du kannst dich nicht selbst als Freund hinzufügen.';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'Diesen Spieler gibt es nicht.';
  end if;
  if public.is_blocked_between(v_me, p_other) then
    raise exception 'Mit diesem Spieler ist keine Freundschaft möglich.';
  end if;

  v_rel := public.friend_relation(v_me, p_other);
  if v_rel = 'incoming' then
    update public.friendships
      set status = 'accepted', accepted_at = now()
      where requester_id = p_other and addressee_id = v_me;
    return 'friend';
  elsif v_rel = 'none' then
    insert into public.friendships (requester_id, addressee_id) values (v_me, p_other)
      on conflict do nothing;
    return 'outgoing';
  end if;
  return v_rel;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Nachrichten senden, lesen, Übersicht
-- ----------------------------------------------------------------------------
-- Nachricht an einen Freund schicken. Gibt die gespeicherte Nachricht zurück.
create or replace function public.send_direct_message(p_to uuid, p_text text)
returns setof public.direct_messages
language plpgsql
security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
begin
  if v_me is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  if v_text = '' then
    raise exception 'Die Nachricht ist leer.';
  end if;
  if char_length(v_text) > 1000 then
    raise exception 'Die Nachricht ist zu lang (höchstens 1000 Zeichen).';
  end if;
  if p_to is null or public.friend_relation(v_me, p_to) <> 'friend' or public.is_blocked_between(v_me, p_to) then
    raise exception 'Du kannst nur deinen Freunden schreiben.';
  end if;
  -- Schutz gegen Spam: höchstens 30 Nachrichten pro Minute.
  if (select count(*) from public.direct_messages
      where sender_id = v_me and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Du schreibst gerade sehr schnell. Warte kurz und versuch es dann nochmal.';
  end if;

  return query
    insert into public.direct_messages (sender_id, recipient_id, text)
    values (v_me, p_to, v_text)
    returning *;
end;
$$;

-- Alle Nachrichten von p_other an mich als gelesen markieren.
create or replace function public.mark_chat_read(p_other uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update public.direct_messages
    set read_at = now()
    where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Chat-Übersicht: alle Freunde mit letzter Nachricht und Zahl ungelesener
-- Nachrichten, die neuesten Unterhaltungen zuerst.
create or replace function public.my_chats()
returns table (
  other_id uuid,
  display_name text,
  user_number integer,
  last_text text,
  last_at timestamptz,
  last_from_me boolean,
  unread integer
)
language sql
stable
security definer set search_path = public
as $$
  select p.id,
         p.display_name,
         p.user_number,
         last_msg.text,
         last_msg.created_at,
         last_msg.sender_id = auth.uid(),
         (select count(*)::int from public.direct_messages u
            where u.recipient_id = auth.uid() and u.sender_id = p.id and u.read_at is null)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join lateral (
    select m.text, m.created_at, m.sender_id
    from public.direct_messages m
    where least(m.sender_id, m.recipient_id) = least(auth.uid(), p.id)
      and greatest(m.sender_id, m.recipient_id) = greatest(auth.uid(), p.id)
    order by m.created_at desc
    limit 1
  ) last_msg on true
  where auth.uid() is not null
    and f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by last_msg.created_at desc nulls last, p.display_name;
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.my_blocked() from public, anon;
revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.send_direct_message(uuid, text) from public, anon;
revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.my_chats() from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocked() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.my_chats() to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Community-Chat aufräumen
-- ----------------------------------------------------------------------------
-- Nur die zwei Beispiel-Nachrichten ohne echten Absender.
delete from public.chat_messages
where user_id is null and id in ('chat-1', 'chat-2');

-- Der angezeigte Name kommt immer aus dem eigenen Profil.
create or replace function public.chat_messages_set_author()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text;
begin
  select nullif(btrim(p.display_name), '') into v_name
    from public.profiles p
    where p.id = new.user_id;
  if v_name is not null then
    new.author_name := v_name;
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_set_author on public.chat_messages;
create trigger chat_messages_set_author
  before insert on public.chat_messages
  for each row execute procedure public.chat_messages_set_author();

-- Neue Community-Nachrichten: höchstens 1000 Zeichen (alte bleiben, wie sie sind).
drop policy if exists "Eigene Nachricht schreiben" on public.chat_messages;
create policy "Eigene Nachricht schreiben" on public.chat_messages
  for insert with check (auth.uid() = user_id and char_length(text) between 1 and 1000);

-- Kontrolle: 0 Beispiel-Nachrichten, Tabelle für private Nachrichten bereit.
select
  (select count(*) from public.chat_messages where id in ('chat-1', 'chat-2')) as beispiel_chat,
  (select count(*) from public.direct_messages) as private_nachrichten;
