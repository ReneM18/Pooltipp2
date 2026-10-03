-- Tests für supabase/chat.sql (nur Test-Datenbank). Aufruf siehe chat-test.sh.
\set ON_ERROR_STOP 1
\set rita '00000000-0000-0000-0000-0000000000c1'
\set dani '00000000-0000-0000-0000-0000000000c2'
\set fremd '00000000-0000-0000-0000-0000000000c3'

create schema if not exists t;
grant usage on schema t to authenticated, anon;
create or replace function t.eq(p_actual anyelement, p_expected anyelement, p_label text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: ist %, erwartet %', p_label, p_actual, p_expected;
  end if;
  raise notice 'ok   %', p_label;
end $$;
create or replace function t.expect_error(p_sql text, p_label text)
returns void language plpgsql as $$
declare
  v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    raise notice 'ok   % (Fehler: %)', p_label, sqlerrm;
  end;
  if not v_failed then
    raise exception 'FAIL %: kein Fehler', p_label;
  end if;
end $$;
create or replace function t.login(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
end $$;
grant execute on all functions in schema t to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  (:'rita', 'rita@test.at', '{"display_name":"Rita"}'),
  (:'dani', 'dani@test.at', '{"display_name":"Dani"}'),
  (:'fremd', 'fremd@test.at', '{"display_name":"Fremder"}');
update public.profiles set display_name = 'Rita' where id = :'rita';
update public.profiles set display_name = 'Dani' where id = :'dani';
update public.profiles set display_name = 'Fremder' where id = :'fremd';

-- Bestehender Stand vor chat.sql: Freundschaft Rita–Dani, Community-Chat
-- mit Beispiel- und echter Nachricht.
insert into public.friendships (requester_id, addressee_id, status, accepted_at) values (:'rita', :'dani', 'accepted', now());
insert into public.chat_messages (id, user_id, author_name, text) values
  ('chat-1', null, 'Marco T.', 'Beispiel'),
  ('chat-echt', :'rita', 'Rita', 'Echte Nachricht')
on conflict (id) do nothing;
create table t.snap_friends as select requester_id, addressee_id, status from public.friendships;

\o /dev/null
\i supabase/chat.sql
\i supabase/chat.sql
\o

select t.eq((select count(*)::int from public.chat_messages where id = 'chat-1'), 0, 'A1 Beispiel-Nachricht gelöscht');
select t.eq((select count(*)::int from public.chat_messages where id = 'chat-echt'), 1, 'A2 echte Community-Nachricht bleibt');
select t.eq((select count(*)::int from (select * from t.snap_friends except
  select requester_id, addressee_id, status from public.friendships) x), 0, 'A3 Freundschaften unverändert');

-- ---------------------------------------------------------------------------
-- B) Schreiben unter Freunden
-- ---------------------------------------------------------------------------
begin;
select t.login(:'rita');
set local role authenticated;
select t.eq((select count(*)::int from public.send_direct_message(:'dani', '  Hallo Dani!  ')), 1, 'B1 Rita schreibt Dani');
select t.eq((select text from public.direct_messages order by created_at desc limit 1), 'Hallo Dani!', 'B2 Leerzeichen abgeschnitten');
select t.expect_error($$select public.send_direct_message('00000000-0000-0000-0000-0000000000c3', 'Hi')$$, 'B3 Fremden schreiben verboten');
select t.expect_error($$select public.send_direct_message('00000000-0000-0000-0000-0000000000c2', '   ')$$, 'B4 leere Nachricht verboten');
select t.expect_error($$select public.send_direct_message('00000000-0000-0000-0000-0000000000c2', repeat('x', 1001))$$, 'B5 zu lange Nachricht verboten');
select t.expect_error($$insert into public.direct_messages (sender_id, recipient_id, text) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', 'direkt')$$, 'B6 direktes Einfügen verboten');
select t.expect_error($$insert into public.direct_messages (sender_id, recipient_id, text) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'gefälscht')$$, 'B7 Nachricht im fremden Namen verboten');
select t.expect_error($$update public.direct_messages set read_at = now()$$, 'B8 direktes Ändern verboten');
select t.eq((select unread from public.my_chats() where other_id = :'dani'), 0, 'B9 Rita: nichts ungelesen');
select t.eq((select last_from_me from public.my_chats() where other_id = :'dani'), true, 'B10 Rita: letzte Nachricht von mir');
commit;

begin;
select t.login(:'dani');
set local role authenticated;
select t.eq((select count(*)::int from public.direct_messages), 1, 'C1 Dani sieht die Nachricht');
select t.eq((select unread from public.my_chats() where other_id = :'rita'), 1, 'C2 Dani: 1 ungelesen');
select t.eq((select last_text from public.my_chats() where other_id = :'rita'), 'Hallo Dani!', 'C3 Dani: Vorschau');
select t.eq(public.mark_chat_read(:'rita'), 1, 'C4 Dani liest');
select t.eq((select unread from public.my_chats() where other_id = :'rita'), 0, 'C5 Dani: 0 ungelesen');
select t.eq((select count(*)::int from public.send_direct_message(:'rita', 'Servus!')), 1, 'C6 Dani antwortet');
commit;

begin;
select t.login(:'fremd');
set local role authenticated;
select t.eq((select count(*)::int from public.direct_messages), 0, 'D1 Fremder sieht keine fremden Nachrichten');
select t.eq((select count(*)::int from public.my_chats()), 0, 'D2 Fremder hat keine Chats');
select t.eq(public.mark_chat_read(:'rita'), 0, 'D3 Fremder kann nichts als gelesen markieren');
commit;

begin;
set local role anon;
select t.expect_error($$select count(*) from public.direct_messages$$, 'D4 Gäste lesen nichts');
select t.expect_error($$select public.send_direct_message('00000000-0000-0000-0000-0000000000c2', 'Hi')$$, 'D5 Gäste schreiben nichts');
commit;

begin;
select t.login(:'rita');
set local role authenticated;
select t.eq((select read_at is not null from public.direct_messages where text = 'Hallo Dani!'), true, 'E1 Rita sieht "gelesen"');
select t.eq((select unread from public.my_chats() where other_id = :'dani'), 1, 'E2 Rita: Antwort ungelesen');
-- Spam-Schutz: 30 pro Minute
\o /dev/null
select public.send_direct_message(:'dani', 'spam ' || g) from generate_series(1, 29) g;
\o
select t.expect_error($$select public.send_direct_message('00000000-0000-0000-0000-0000000000c2', 'eine zu viel')$$, 'E3 Spam-Schutz greift');
rollback;

-- Community-Chat: Name kommt aus dem Profil
begin;
select t.login(:'fremd');
set local role authenticated;
insert into public.chat_messages (id, user_id, author_name, text) values ('chat-x', :'fremd', 'Rene', 'Ich bin Rene');
select t.eq((select author_name from public.chat_messages where id = 'chat-x'), 'Fremder', 'F1 fremder Name wird ersetzt');
select t.expect_error($$insert into public.chat_messages (id, user_id, author_name, text) values ('chat-y', '00000000-0000-0000-0000-0000000000c3', 'F', repeat('x', 1001))$$, 'F2 zu lange Community-Nachricht verboten');
rollback;

-- ---------------------------------------------------------------------------
-- G) Blockieren
-- ---------------------------------------------------------------------------
begin;
select t.login(:'dani');
set local role authenticated;
select public.block_user(:'rita');
select t.eq((select count(*)::int from public.my_blocked()), 1, 'G1 Dani hat Rita blockiert');
select t.eq((select count(*)::int from public.my_chats()), 0, 'G2 Chat verschwindet');
commit;

begin;
select t.login(:'rita');
set local role authenticated;
select t.expect_error($$select public.send_direct_message('00000000-0000-0000-0000-0000000000c2', 'Hallo?')$$, 'G3 Rita kann nicht mehr schreiben');
select t.expect_error($$select public.send_friend_request('00000000-0000-0000-0000-0000000000c2')$$, 'G4 Rita kann keine neue Anfrage schicken');
select t.eq((select count(*)::int from public.user_blocks), 0, 'G5 Rita sieht Danis Blockliste nicht');
select t.eq(public.send_friend_request(:'fremd'), 'outgoing', 'G6 andere Anfragen gehen weiter');
commit;

begin;
select t.login(:'dani');
set local role authenticated;
select public.unblock_user(:'rita');
select t.eq((select count(*)::int from public.my_blocked()), 0, 'G7 Blockierung aufgehoben');
select t.eq(public.send_friend_request(:'rita'), 'outgoing', 'G8 Freundschaft wieder möglich');
commit;
