-- Task 3.1 — the server copy of every syncable table on the phone (ARCHITECTURE §3, §4).
--
-- Each table mirrors its SQLite table in src/db/schema/ (minus the local-only `_dirty` and
-- `_synced_at`), plus `server_updated_at`, which the sync pull uses as its cursor.
--
-- Rules every table here follows:
--   * Row Level Security: a signed-in student can only see, add and change their own rows
--     (`owner_id = auth.uid()`). The anon key alone sees nothing.
--   * Last write wins: a push that is older than the row already here (`updated_at`) is ignored.
--   * No hard deletes from the app: rows are soft-deleted (`deleted_at`) so the delete can sync.
--     Deleting the account (task 3.6) removes the rows through `on delete cascade`.
--   * No foreign keys between user tables and no CHECK on enum-like columns, like the phone:
--     sync may deliver a child before its parent, and a newer app may add a new value.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------------------------
-- Sync trigger: runs before every insert and update on the tables below.
-- ---------------------------------------------------------------------------------------------
create or replace function private.sync_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A phone with its clock set ahead must not win every future conflict.
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;

  -- Last write wins: keep the row that is already here if the incoming one is older.
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;

  -- The pull cursor. Always set here, whatever the app sent.
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- A student can't make themselves a reviewer or admin; only the service role can change `role`.
create or replace function private.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.role := 'student';
    else
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Profile (ARCHITECTURE §3.2). One row per account; `id` is the auth user id.
-- The phone's `profiles.auth_user_id` points here; `settings` and `note_versions` stay local.
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  year_of_study smallint,
  semester smallint,
  cohort_code text,
  timezone text not null default 'Africa/Kampala',
  daily_goal_xp integer not null default 50,
  reminder_time text,
  exam_date date,
  role text not null default 'student' check (role in ('student', 'reviewer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function private.protect_profile_role();

-- ---------------------------------------------------------------------------------------------
-- Library (§3.3): folders, tags, item_tags
-- ---------------------------------------------------------------------------------------------
create table public.folders (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  parent_id text,
  name text not null,
  kind text not null,
  sort_order integer not null default 0
);

create table public.tags (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  name text not null,
  colour text not null default 'teal'
);

create table public.item_tags (
  item_type text not null,
  item_id text not null,
  tag_id text not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (item_type, item_id, tag_id)
);

-- ---------------------------------------------------------------------------------------------
-- Media (§3.3, §5). The file itself goes to Storage bucket `user-media` (next migration).
-- `local_uri` and `upload_status` are about one phone's files, so they stay on the phone; another
-- phone knows it can download the image when `remote_path` is set.
-- ---------------------------------------------------------------------------------------------
create table public.media (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  remote_path text,
  mime text not null,
  width integer not null,
  height integer not null,
  bytes integer not null,
  derived_from text,
  annotation_json jsonb
);

-- ---------------------------------------------------------------------------------------------
-- Notes (§3.3). `note_versions` and the search index stay on the phone.
-- ---------------------------------------------------------------------------------------------
create table public.notes (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  folder_id text,
  title text not null default '',
  content_json jsonb not null,
  content_text text not null default '',
  word_count integer not null default 0,
  topic_id text,
  drug_id text,
  pinned boolean not null default false,
  template text
);

-- ---------------------------------------------------------------------------------------------
-- Decks and cards (§3.3)
-- ---------------------------------------------------------------------------------------------
create table public.decks (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  folder_id text,
  title text not null,
  description text not null default '',
  topic_id text,
  source text not null default 'user',
  forked_from text,
  official_deck_id text,
  visibility text not null default 'private',
  share_code text,
  pinned boolean not null default false,
  new_per_day integer not null default 15,
  max_reviews_per_day integer not null default 200,
  desired_retention double precision not null default 0.9
);

create table public.cards (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  deck_id text not null,
  type text not null,
  front_json jsonb not null,
  back_json jsonb not null,
  extra_json jsonb,
  front_text text not null default '',
  back_text text not null default '',
  occlusion_json jsonb,
  topic_id text,
  drug_id text,
  source_note_id text,
  suspended boolean not null default false
);

-- (card_id, sub_key) is deliberately not unique, as on the phone (Decisions log 2026-10-09).
create table public.card_instances (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  card_id text not null,
  sub_key text not null
);

create index card_instances_card_idx on public.card_instances (card_id);

-- ---------------------------------------------------------------------------------------------
-- FSRS state and review history (§3.3). `card_state` can be rebuilt from `review_logs` (task 3.4).
-- ---------------------------------------------------------------------------------------------
create table public.card_state (
  card_instance_id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state text not null default 'new',
  last_review timestamptz,
  buried_until date
);

create table public.review_logs (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  card_instance_id text not null,
  rating smallint not null,
  state text not null,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null,
  scheduled_days integer not null,
  learning_steps integer not null default 0,
  review_duration_ms integer,
  reviewed_at timestamptz not null
);

create index review_logs_instance_idx on public.review_logs (card_instance_id, reviewed_at);

-- ---------------------------------------------------------------------------------------------
-- Question bank, quizzes and attempts (§3.3). Only the student's own questions live here;
-- official questions come with the content tables in Phase 4.
-- ---------------------------------------------------------------------------------------------
create table public.questions (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  source text not null default 'user',
  official_id text,
  type text not null,
  stem_json jsonb not null,
  stem_text text not null default '',
  payload_json jsonb not null,
  explanation_json jsonb,
  difficulty smallint not null default 2,
  topic_id text,
  drug_ids_json jsonb not null default '[]'::jsonb
);

create table public.quizzes (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  folder_id text,
  title text not null,
  description text not null default '',
  topic_id text,
  settings_json jsonb not null,
  visibility text not null default 'private',
  share_code text,
  pinned boolean not null default false
);

create table public.quiz_questions (
  quiz_id text not null,
  question_id text not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  position integer not null default 0,
  points integer not null default 1,
  primary key (quiz_id, question_id)
);

create table public.quiz_attempts (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  quiz_id text,
  context text not null default 'quiz',
  context_id text,
  mode text not null,
  settings_json jsonb not null,
  retry_of text,
  started_at timestamptz not null,
  finished_at timestamptz,
  score double precision not null default 0,
  max_score double precision not null default 0
);

create table public.question_responses (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  attempt_id text not null,
  question_id text not null,
  position integer not null default 0,
  response_json jsonb,
  score double precision not null default 0,
  max_score double precision not null default 0,
  is_correct boolean not null default false,
  time_ms integer not null default 0,
  flagged boolean not null default false
);

create index question_responses_attempt_idx on public.question_responses (attempt_id);

-- ---------------------------------------------------------------------------------------------
-- XP, streak and badges (§3.4). `streak_state` can be rebuilt from `xp_events` (task 3.4).
-- `achievements` has no unique (owner_id, key): two offline phones may each unlock the same
-- badge with different ids, and the push must not fail on that (sync keeps the earliest).
-- ---------------------------------------------------------------------------------------------
create table public.xp_events (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  study_day date not null,
  source text not null,
  source_id text,
  amount integer not null
);

create table public.streak_state (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  current integer not null default 0,
  longest integer not null default 0,
  last_counted_day date,
  freezes_held integer not null default 0,
  repair_available_until date,
  last_repair_day date
);

create table public.achievements (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  key text not null,
  unlocked_at timestamptz not null
);

-- ---------------------------------------------------------------------------------------------
-- Lecture timetable (§3.4a). Which timetable is in use stays a local setting on each phone.
-- ---------------------------------------------------------------------------------------------
create table public.timetables (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  name text not null
);

create table public.timetable_classes (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  timetable_id text not null,
  title text not null,
  code text not null default '',
  kind text not null default 'lecture',
  weekday smallint not null,
  start_time text not null,
  end_time text not null,
  location text not null default '',
  lecturer text not null default '',
  colour text not null default 'teal',
  reminders_json jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------------------------
-- The same rules on every table: RLS, policies, sync trigger, pull index, privileges.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('profiles', 'id'),
      ('folders', 'owner_id'),
      ('tags', 'owner_id'),
      ('item_tags', 'owner_id'),
      ('media', 'owner_id'),
      ('notes', 'owner_id'),
      ('decks', 'owner_id'),
      ('cards', 'owner_id'),
      ('card_instances', 'owner_id'),
      ('card_state', 'owner_id'),
      ('review_logs', 'owner_id'),
      ('questions', 'owner_id'),
      ('quizzes', 'owner_id'),
      ('quiz_questions', 'owner_id'),
      ('quiz_attempts', 'owner_id'),
      ('question_responses', 'owner_id'),
      ('xp_events', 'owner_id'),
      ('streak_state', 'owner_id'),
      ('achievements', 'owner_id'),
      ('timetables', 'owner_id'),
      ('timetable_classes', 'owner_id')
    ) as v(name, owner_col)
  loop
    execute format('alter table public.%I enable row level security', t.name);

    execute format(
      'create policy "Students read their own rows" on public.%I for select to authenticated '
      'using (%I = (select auth.uid()))', t.name, t.owner_col);
    execute format(
      'create policy "Students add their own rows" on public.%I for insert to authenticated '
      'with check (%I = (select auth.uid()))', t.name, t.owner_col);
    execute format(
      'create policy "Students change their own rows" on public.%I for update to authenticated '
      'using (%I = (select auth.uid())) with check (%I = (select auth.uid()))',
      t.name, t.owner_col, t.owner_col);

    execute format(
      'create trigger sync_before_write before insert or update on public.%I '
      'for each row execute function private.sync_before_write()', t.name);

    -- The pull asks "what changed for me since my cursor?"
    execute format(
      'create index %I on public.%I (%I, server_updated_at)',
      t.name || '_pull_idx', t.name, t.owner_col);

    -- No DELETE for the app: deletes are soft, so they can sync.
    execute format('revoke all on table public.%I from anon, authenticated', t.name);
    execute format('grant select, insert, update on table public.%I to authenticated', t.name);
    execute format('grant all on table public.%I to service_role', t.name);
  end loop;
end;
$$;
