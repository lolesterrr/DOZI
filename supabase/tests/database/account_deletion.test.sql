-- Task 3.6 — deleting an account can be undone for 10 days, and only by its owner.
--
-- Run against the linked project:   npx supabase@3.0.0 test db --remote
-- or paste the whole file into the dashboard's SQL Editor and press Run. Everything is rolled
-- back at the end; any failed check stops it with an error.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

create schema deletion_test;
grant usage on schema deletion_test to anon, authenticated;

create function deletion_test.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function deletion_test.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

create function deletion_test.act_as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-0000000000d1', 'sample-d1@example.com'),
  ('00000000-0000-4000-a000-0000000000d2', 'sample-d2@example.com');

-- Nothing pending to start with.
select deletion_test.act_as('00000000-0000-4000-a000-0000000000d1');
select is(public.account_deletion_status(), null, 'no deletion pending at first');

-- Asking schedules it 10 days ahead, and asking again keeps the first date.
select ok(
  public.request_account_deletion() between now() + interval '10 days' - interval '1 minute'
                                         and now() + interval '10 days' + interval '1 minute',
  'deletion is scheduled 10 days ahead');
select is(public.request_account_deletion(), public.account_deletion_status(),
  'asking twice keeps the same date');

-- The other student sees nothing and can't cancel it.
select deletion_test.act_as('00000000-0000-4000-a000-0000000000d2');
select is(public.account_deletion_status(), null, 'another student sees no pending deletion');
select is(public.cancel_account_deletion(), false, 'another student cancels nothing');
select deletion_test.act_as('00000000-0000-4000-a000-0000000000d1');
select isnt(public.account_deletion_status(), null, 'the request is still there');

-- The table itself and the purge list are out of reach for students and the anon key.
select throws_ok('select * from private.account_deletions', '42501', null,
  'students can''t read the deletions table');
select throws_ok('select * from public.due_account_deletions()', '42501', null,
  'students can''t list accounts due for deletion');
select deletion_test.act_as_anon();
select throws_ok('select public.request_account_deletion()', '42501', null,
  'the anon key can''t ask for a deletion');

-- "Keep my account" cancels it.
select deletion_test.act_as('00000000-0000-4000-a000-0000000000d1');
select is(public.cancel_account_deletion(), true, 'keeping the account cancels the request');
select is(public.account_deletion_status(), null, 'nothing pending after keeping it');

-- Only requests whose 10 days are over are due.
select public.request_account_deletion();
select deletion_test.act_as('00000000-0000-4000-a000-0000000000d2');
select public.request_account_deletion();
select deletion_test.act_as_owner();
update private.account_deletions set purge_after = now() - interval '1 minute'
  where user_id = '00000000-0000-4000-a000-0000000000d1';
select results_eq('select * from public.due_account_deletions()',
  $$values ('00000000-0000-4000-a000-0000000000d1'::uuid)$$,
  'only the account past its 10 days is due');

-- Deleting the user (what the purge does last) clears the request too.
delete from auth.users where id = '00000000-0000-4000-a000-0000000000d1';
select is((select count(*) from private.account_deletions
  where user_id = '00000000-0000-4000-a000-0000000000d1'), 0::bigint,
  'deleting the user removes the request');

select * from finish(true);

rollback;
