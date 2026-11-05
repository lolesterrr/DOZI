-- Task 3.1 — proves that one student can never read or change another student's data.
--
-- Run against the linked project:   npx supabase@3.0.0 test db --remote
-- or paste the whole file into the dashboard's SQL Editor and press Run (docs/SETUP.md Part D).
-- Everything happens inside one transaction that is rolled back at the end, so the test users
-- and rows it creates never stay in the database. Any failed check stops it with an error.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Helpers (created in this transaction, so they vanish with the rollback)
-- ---------------------------------------------------------------------------------------------
create schema rls_test;
grant usage on schema rls_test to anon, authenticated;

-- Every table the phone syncs, and the column that says whose row it is.
create table rls_test.synced (name text primary key, owner_col text not null);
insert into rls_test.synced values
  ('profiles', 'id'), ('folders', 'owner_id'), ('tags', 'owner_id'), ('item_tags', 'owner_id'),
  ('media', 'owner_id'), ('notes', 'owner_id'), ('decks', 'owner_id'), ('cards', 'owner_id'),
  ('card_instances', 'owner_id'), ('card_state', 'owner_id'), ('review_logs', 'owner_id'),
  ('questions', 'owner_id'), ('quizzes', 'owner_id'), ('quiz_questions', 'owner_id'),
  ('quiz_attempts', 'owner_id'), ('question_responses', 'owner_id'), ('xp_events', 'owner_id'),
  ('streak_state', 'owner_id'), ('achievements', 'owner_id'), ('timetables', 'owner_id'),
  ('timetable_classes', 'owner_id');
grant select on rls_test.synced to anon, authenticated;

-- Act as a signed-in student, the way the API does for a request with their token.
create function rls_test.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Act as someone with only the anon key (not signed in).
create function rls_test.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

-- Back to the database owner (like the service role or the dashboard).
create function rls_test.act_as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- How many rows a statement changed.
create function rls_test.rows_changed(statement text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema rls_test to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Three test students
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'student-a@dozi-rls-test.invalid'),
  ('00000000-0000-4000-a000-00000000000b', 'student-b@dozi-rls-test.invalid'),
  ('00000000-0000-4000-a000-00000000000c', 'student-c@dozi-rls-test.invalid');

-- ---------------------------------------------------------------------------------------------
-- Student A writes one row in every synced table (owner_id defaults to the signed-in student).
-- ---------------------------------------------------------------------------------------------
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');

insert into public.profiles (display_name, role) values ('SAMPLE student A', 'admin');
insert into public.folders (id, name, kind) values ('t-folder-a', 'SAMPLE folder', 'note');
insert into public.tags (id, name) values ('t-tag-a', 'SAMPLE tag');
insert into public.item_tags (item_type, item_id, tag_id) values ('note', 't-note-a', 't-tag-a');
insert into public.media (id, mime, width, height, bytes, remote_path)
  values ('t-media-a', 'image/jpeg', 800, 600, 12345,
    '00000000-0000-4000-a000-00000000000a/t-media-a.jpg');
insert into public.notes (id, title, content_json, updated_at)
  values ('t-note-a', 'SAMPLE note', '{"type":"doc","content":[]}', '2026-01-01T00:00:00Z');
insert into public.decks (id, title) values ('t-deck-a', 'SAMPLE deck');
insert into public.cards (id, deck_id, type, front_json, back_json)
  values ('t-card-a', 't-deck-a', 'basic', '{"type":"doc"}', '{"type":"doc"}');
insert into public.card_instances (id, card_id, sub_key) values ('t-inst-a', 't-card-a', 'front');
insert into public.card_state (card_instance_id, due) values ('t-inst-a', now());
insert into public.review_logs (id, card_instance_id, rating, state, due, stability, difficulty,
  elapsed_days, scheduled_days, reviewed_at)
  values ('t-log-a', 't-inst-a', 3, 'new', now(), 0, 0, 0, 0, now());
insert into public.questions (id, type, stem_json, payload_json)
  values ('t-question-a', 'sba', '{"type":"doc"}', '{}');
insert into public.quizzes (id, title, settings_json) values ('t-quiz-a', 'SAMPLE quiz', '{}');
insert into public.quiz_questions (quiz_id, question_id) values ('t-quiz-a', 't-question-a');
insert into public.quiz_attempts (id, quiz_id, mode, settings_json, started_at)
  values ('t-attempt-a', 't-quiz-a', 'practice', '{}', now());
insert into public.question_responses (id, attempt_id, question_id)
  values ('t-response-a', 't-attempt-a', 't-question-a');
insert into public.xp_events (id, study_day, source, amount)
  values ('t-xp-a', '2026-11-03', 'review_card', 1);
insert into public.streak_state (current) values (1);
insert into public.achievements (id, key, unlocked_at) values ('t-badge-a', 'first_steps', now());
insert into public.timetables (id, name) values ('t-timetable-a', 'SAMPLE timetable');
insert into public.timetable_classes (id, timetable_id, title, weekday, start_time, end_time)
  values ('t-class-a', 't-timetable-a', 'SAMPLE class', 1, '08:00', '10:00');

-- Keep a copy of A's rows, to try writing them as B later.
select rls_test.act_as_owner();
create table rls_test.a_rows (name text primary key, row_json jsonb not null);
do $$
declare
  t record;
begin
  for t in select * from rls_test.synced loop
    execute format(
      'insert into rls_test.a_rows select %L, to_jsonb(x) from public.%I x', t.name, t.name);
  end loop;
end;
$$;
grant select on rls_test.a_rows to anon, authenticated;

-- Runs one check on every synced table. `check_sql` is a format() string: %1$I is the table name.
create function rls_test.each_table(check_sql text) returns setof text language plpgsql as $$
declare
  t record;
  line text;
begin
  for t in select s.name, a.row_json from rls_test.synced s left join rls_test.a_rows a using (name)
    order by s.name
  loop
    execute format(check_sql, t.name, t.row_json::text) into line;
    return next line;
  end loop;
end;
$$;
grant execute on function rls_test.each_table(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Every table in public has Row Level Security turned on (also tables added later).
-- ---------------------------------------------------------------------------------------------
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every table in public has row level security on'
);

-- ---------------------------------------------------------------------------------------------
-- Student A sees their own rows.
-- ---------------------------------------------------------------------------------------------
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
select * from rls_test.each_table(
  $$ select is((select count(*) from public.%1$I), 1::bigint, 'A sees their own row in %1$s') $$);

-- ---------------------------------------------------------------------------------------------
-- Student B can't see, change, take over or delete A's rows.
-- ---------------------------------------------------------------------------------------------
select rls_test.act_as('00000000-0000-4000-a000-00000000000b');

select * from rls_test.each_table(
  $$ select is((select count(*) from public.%1$I), 0::bigint, 'B cannot see A''s row in %1$s') $$);

select * from rls_test.each_table(
  $$ select is(rls_test.rows_changed('update public.%1$I set updated_at = now()'), 0::bigint,
       'B cannot change A''s row in %1$s') $$);

select * from rls_test.each_table(
  $$ select throws_ok(
       format('insert into public.%%1$I select * from jsonb_populate_record(null::public.%%1$I, %%2$L)',
         %1$L, %2$L),
       '42501', null, 'B cannot write a row owned by A into %1$s') $$);

select * from rls_test.each_table(
  $$ select throws_ok('delete from public.%1$I', '42501', null,
       'B cannot delete rows from %1$s') $$);

-- B's own rows can't claim A as their owner either.
select throws_ok(
  $$ insert into public.notes (id, owner_id, content_json)
     values ('t-note-b', '00000000-0000-4000-a000-00000000000a', '{}') $$,
  '42501', null, 'B cannot add a note owned by A');

-- ---------------------------------------------------------------------------------------------
-- The anon key alone (not signed in) can't read anything.
-- ---------------------------------------------------------------------------------------------
select rls_test.act_as_anon();
select * from rls_test.each_table(
  $$ select throws_ok('select * from public.%1$I', '42501', null,
       'the anon key cannot read %1$s') $$);

-- ---------------------------------------------------------------------------------------------
-- Student A's own writes: no hard deletes, last write wins, the server sets the pull cursor.
-- ---------------------------------------------------------------------------------------------
select rls_test.act_as('00000000-0000-4000-a000-00000000000a');

select throws_ok($$ delete from public.notes where id = 't-note-a' $$, '42501', null,
  'A cannot hard-delete their own note (deletes are soft, so they sync)');

update public.notes set title = 'stale edit', updated_at = '2025-12-31T00:00:00Z'
  where id = 't-note-a';
select is((select title from public.notes where id = 't-note-a'), 'SAMPLE note',
  'an older write is ignored (last write wins)');

update public.notes set title = 'newer edit', updated_at = '2026-01-02T00:00:00Z'
  where id = 't-note-a';
select is((select title from public.notes where id = 't-note-a'), 'newer edit',
  'a newer write is kept');

update public.notes set title = 'clock ahead', updated_at = now() + interval '30 days'
  where id = 't-note-a';
select ok((select updated_at <= now() + interval '5 minutes' from public.notes where id = 't-note-a'),
  'a timestamp from a phone clock far in the future is brought back to now');

insert into public.tags (id, name, server_updated_at) values ('t-tag-a2', 'SAMPLE', '2000-01-01');
select ok((select server_updated_at > '2001-01-01' from public.tags where id = 't-tag-a2'),
  'the server sets server_updated_at, whatever the phone sends');

-- ---------------------------------------------------------------------------------------------
-- A student can't make themselves a reviewer or admin.
-- ---------------------------------------------------------------------------------------------
select is((select role from public.profiles), 'student',
  'a new profile is always a student, even if the app asks for admin');

update public.profiles set role = 'admin', updated_at = now();
select is((select role from public.profiles), 'student', 'a student cannot change their own role');

select rls_test.act_as_owner();
update public.profiles set role = 'reviewer', updated_at = now()
  where id = '00000000-0000-4000-a000-00000000000a';
select is((select role from public.profiles where id = '00000000-0000-4000-a000-00000000000a'),
  'reviewer', 'the service role can make someone a reviewer');

-- ---------------------------------------------------------------------------------------------
-- Storage: the private user-media bucket, one folder per student.
-- ---------------------------------------------------------------------------------------------
select is((select public from storage.buckets where id = 'user-media'), false,
  'the user-media bucket is private');

select rls_test.act_as('00000000-0000-4000-a000-00000000000a');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('user-media', '00000000-0000-4000-a000-00000000000a/t-media-a.jpg') $$,
  'A can upload into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('user-media', '00000000-0000-4000-a000-00000000000b/sneaky.jpg') $$,
  '42501', null, 'A cannot upload into B''s folder');

select rls_test.act_as('00000000-0000-4000-a000-00000000000b');
select is((select count(*) from storage.objects where bucket_id = 'user-media'), 0::bigint,
  'B cannot see A''s files');
select is(rls_test.rows_changed($$ update storage.objects set name = name
  where bucket_id = 'user-media' $$), 0::bigint, 'B cannot change A''s files');

-- The public tutorials bucket (task 3.7): anyone can download, nobody with the app can upload.
select is((select public from storage.buckets where id = 'tutorials'), true,
  'the tutorials bucket is public');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('tutorials', 'sneaky.mp4') $$,
  '42501', null, 'a student cannot upload a tutorial video');
select rls_test.act_as_anon();
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('tutorials', 'sneaky.mp4') $$,
  '42501', null, 'the anon key cannot upload a tutorial video');

-- ---------------------------------------------------------------------------------------------
-- Deleting an account removes that student's rows (task 3.6 relies on this).
-- ---------------------------------------------------------------------------------------------
select rls_test.act_as('00000000-0000-4000-a000-00000000000c');
insert into public.profiles (display_name) values ('SAMPLE student C');
insert into public.notes (id, content_json) values ('t-note-c', '{}');
insert into public.xp_events (id, study_day, source, amount)
  values ('t-xp-c', '2026-11-03', 'note_created', 5);

select rls_test.act_as_owner();
delete from auth.users where id = '00000000-0000-4000-a000-00000000000c';
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-a000-00000000000c')
  + (select count(*) from public.notes where owner_id = '00000000-0000-4000-a000-00000000000c')
  + (select count(*) from public.xp_events where owner_id = '00000000-0000-4000-a000-00000000000c'),
  0::bigint, 'deleting a user removes their rows');

-- Stops with an error if any check above failed.
select * from finish(true);

rollback;
