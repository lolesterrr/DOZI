-- Deleting an account can be undone for 10 days (task 3.6, at the developer's request).
--
-- "Delete my account" in the app no longer removes anything straight away. It records the
-- request here; signing in again within 10 days offers "Keep my account", which cancels it.
-- Once the 10 days are over, the daily `purge-deleted-accounts` Edge Function removes the
-- student's pictures from Storage and deletes the auth user, and every row goes with it
-- (`on delete cascade`, see 20261103100000_user_tables.sql).
--
-- The daily job needs two Vault secrets (`project_url`, `purge_secret`) and the function's
-- PURGE_SECRET; docs/SETUP.md Part G sets them up. Without them the job runs but does nothing.

create table private.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null
);
revoke all on private.account_deletions from public;

-- ---------------------------------------------------------------------------------------------
-- What the signed-in student can call (supabase.rpc). Each acts only on their own account.
-- ---------------------------------------------------------------------------------------------

-- Asks for the account to be deleted. Returns when it will be. Asking twice keeps the first date.
create function public.request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result timestamptz;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  insert into private.account_deletions as d (user_id, purge_after)
  values (uid, now() + interval '10 days')
  on conflict (user_id) do update set requested_at = d.requested_at
  returning d.purge_after into result;
  return result;
end;
$$;

-- "Keep my account": cancels the request. True if there was one.
create function public.cancel_account_deletion() returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from private.account_deletions where user_id = uid;
  return found;
end;
$$;

-- When the account will be deleted, or null if it isn't going to be.
create function public.account_deletion_status() returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select purge_after from private.account_deletions where user_id = (select auth.uid());
$$;

-- For the purge job only: accounts whose 10 days are over.
create function public.due_account_deletions() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select user_id from private.account_deletions where purge_after <= now() order by purge_after;
$$;

revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.account_deletion_status() from public, anon;
revoke execute on function public.due_account_deletions() from public, anon, authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.account_deletion_status() to authenticated;
grant execute on function public.due_account_deletions() to service_role;

-- ---------------------------------------------------------------------------------------------
-- The daily purge, at 04:00 in Kampala (01:00 UTC). Skipped where pg_cron and pg_net don't exist
-- (the plain PostgreSQL that cloud sessions test on).
-- ---------------------------------------------------------------------------------------------
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule(
      'purge-deleted-accounts',
      '0 1 * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/purge-deleted-accounts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-purge-secret',
            (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  end if;
end;
$outer$;
