-- Discord Points Manager — schema
-- Run this once in the Supabase SQL editor for a fresh project.

create extension if not exists pgcrypto;

-- discord_id is derived deterministically from discord_username (see lib/users.ts,
-- resolveDiscordId) — it is NOT a real Discord snowflake, since users are only ever
-- created via CSV/Excel bulk import, which supplies a username and nothing else.
create table users (
  discord_id       text primary key,
  -- Length limits match lib/validation.ts; the API also strips invisible
  -- characters and rejects < > { } ` \ before anything reaches the table.
  discord_username text not null unique check (char_length(discord_username) between 1 and 32),
  created_at       timestamptz not null default now()
);

create table events (
  event_id    uuid primary key default gen_random_uuid(),
  event_name  text not null check (char_length(event_name) between 1 and 60),
  -- Keep in sync with EVENT_TYPES in types/index.ts.
  event_type  text not null default 'other'
    check (event_type in ('game_night', 'tournament', 'challenge', 'giveaway', 'community', 'other')),
  description text check (char_length(description) <= 500),
  created_at  timestamptz not null default now(),
  month       text generated always as (to_char(created_at, 'YYYY-MM')) stored
);
create index idx_events_month on events (month);

create table points (
  point_id     uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events (event_id) on delete cascade,
  discord_id   text not null references users (discord_id) on delete cascade,
  monday       integer not null default 0,
  tuesday      integer not null default 0,
  wednesday    integer not null default 0,
  thursday     integer not null default 0,
  friday       integer not null default 0,
  saturday     integer not null default 0,
  sunday       integer not null default 0,
  total_points integer generated always as
    (monday + tuesday + wednesday + thursday + friday + saturday + sunday) stored,
  week_date    date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint points_nonnegative check (
    monday >= 0 and tuesday >= 0 and wednesday >= 0 and thursday >= 0 and
    friday >= 0 and saturday >= 0 and sunday >= 0
  ),
  -- week_date always stores the Monday of its week (see lib/week.ts) — enforced
  -- here too as a backstop against any future write path that skips normalization.
  constraint points_week_is_monday check (extract(isodow from week_date) = 1),
  constraint points_unique_event_user_week unique (event_id, discord_id, week_date)
);
create index idx_points_event_id on points (event_id);
create index idx_points_discord_id on points (discord_id);
create index idx_points_event_week on points (event_id, week_date);

-- Weeks an admin has added to an event. A week also counts once it has points,
-- so this mainly keeps planned weeks that have no scores yet (see
-- lib/eventData.ts, loadEventWeeks).
create table event_weeks (
  event_id   uuid not null references events (event_id) on delete cascade,
  week_date  date not null,
  created_at timestamptz not null default now(),
  primary key (event_id, week_date),
  constraint event_weeks_week_is_monday check (extract(isodow from week_date) = 1)
);
alter table event_weeks enable row level security;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_points_updated_at
before update on points
for each row execute function set_updated_at();

-- Login roster — only emails listed here can sign in. Admins manage it on the
-- Team page (/dashboard/team); create the first admin with the SQL printed by
-- `npm run hash-password`. Removing a row takes effect immediately.
--   admin  — everything, plus managing this roster
--   editor — create, edit and delete events, weeks and points
--   viewer — read-only (can still download CSV exports)
-- Keep in sync with APP_USER_ROLES in lib/auth/roles.ts.
create table app_users (
  email         text primary key check (email = lower(email)),
  password_hash text not null,
  role          text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at    timestamptz not null default now()
);
-- RLS on with no policies: nothing but the service role can read password hashes.
alter table app_users enable row level security;

-- Admin audit log (see AUDIT_LOG.md). Written only by the app's API routes
-- through lib/audit.ts; read only by admins on /dashboard/audit.
create table audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  -- Snapshots, not foreign keys: removing someone from the team or changing
  -- their role keeps their history as it was. Viewers appear only for exports.
  actor_email text not null,
  actor_role  text not null check (actor_role in ('admin', 'editor', 'viewer')),
  -- Keep in sync with AuditAction in types/index.ts.
  action      text not null check (action in (
    'score.set', 'score.update', 'score.delete',
    'week.add', 'week.remove',
    'import', 'participants.add',
    'event.create', 'event.update', 'event.delete',
    'team.add', 'team.role', 'team.password', 'team.remove',
    'export.week', 'export.leaderboard'
  )),
  -- No foreign key on purpose: deleting an event must not cascade-delete its
  -- history. Empty for team actions. The name is a snapshot.
  event_id    uuid,
  event_name  text,
  target      text,                       -- player name, week date, member email or file name
  details     jsonb not null default '{}' -- before/after values, counts, week label. Never passwords
);
create index idx_audit_log_created on audit_log (created_at desc);
create index idx_audit_log_actor on audit_log (actor_email, created_at desc);
create index idx_audit_log_event on audit_log (event_id, created_at desc);
-- RLS on with no policies, like app_users: only the service role can touch it.
alter table audit_log enable row level security;

-- Append-only. The app never updates or deletes log rows; this blocks it in
-- the database too. The owner can still drop the triggers, so it prevents
-- accidents, not a determined Supabase admin. To prune old rows, drop
-- trg_audit_log_no_edit first.
create or replace function audit_log_append_only()
returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

create trigger trg_audit_log_no_edit
before update or delete on audit_log
for each row execute function audit_log_append_only();

create trigger trg_audit_log_no_truncate
before truncate on audit_log
for each statement execute function audit_log_append_only();

-- All access is mediated by this app's own API routes, which require a signed-in
-- roster member and use the service-role key server-side — the browser never
-- talks to Supabase directly.

-- Migration for projects created before events had a type and description
-- (2026-09-27). Safe to run once on an existing database:
--
--   alter table events
--     add column event_type text not null default 'other'
--       check (event_type in ('game_night', 'tournament', 'challenge', 'giveaway', 'community', 'other')),
--     add column description text check (char_length(description) <= 500);

-- Migration for projects created before the text limits (2026-09-27). `not
-- valid` skips checking existing rows, so older, longer names don't block it;
-- every new insert and update is checked. Safe to run once:
--
--   alter table events
--     add constraint events_event_name_length check (char_length(event_name) between 1 and 60) not valid;
--   alter table users
--     add constraint users_discord_username_length check (char_length(discord_username) between 1 and 32) not valid;

-- Migration for projects created before added weeks were saved (2026-09-27).
-- Until it runs, weeks without scores disappear on reload. Safe to run once:
--
--   create table event_weeks (
--     event_id   uuid not null references events (event_id) on delete cascade,
--     week_date  date not null,
--     created_at timestamptz not null default now(),
--     primary key (event_id, week_date),
--     constraint event_weeks_week_is_monday check (extract(isodow from week_date) = 1)
--   );
--   alter table event_weeks enable row level security;

-- Migration for projects created before editor/viewer roles (2026-09-27).
-- Existing 'member' rows become editors, so nobody loses access. Safe to run once:
--
--   alter table app_users drop constraint app_users_role_check;
--   update app_users set role = 'editor' where role = 'member';
--   alter table app_users alter column role set default 'viewer';
--   alter table app_users add constraint app_users_role_check check (role in ('admin', 'editor', 'viewer'));

-- Migration for projects created before the audit log (2026-09-28). Until it
-- runs, actions still work but nothing is logged ("[audit]" errors in the
-- server log) and /dashboard/audit shows an error. Safe to run once:
--
--   create table audit_log (
--     id          bigint generated always as identity primary key,
--     created_at  timestamptz not null default now(),
--     actor_email text not null,
--     actor_role  text not null check (actor_role in ('admin', 'editor', 'viewer')),
--     action      text not null check (action in (
--       'score.set', 'score.update', 'score.delete',
--       'week.add', 'week.remove',
--       'import', 'participants.add',
--       'event.create', 'event.update', 'event.delete',
--       'team.add', 'team.role', 'team.password', 'team.remove',
--       'export.week', 'export.leaderboard'
--     )),
--     event_id    uuid,
--     event_name  text,
--     target      text,
--     details     jsonb not null default '{}'
--   );
--   create index idx_audit_log_created on audit_log (created_at desc);
--   create index idx_audit_log_actor on audit_log (actor_email, created_at desc);
--   create index idx_audit_log_event on audit_log (event_id, created_at desc);
--   alter table audit_log enable row level security;
--
--   create or replace function audit_log_append_only()
--   returns trigger as $$
--   begin
--     raise exception 'audit_log is append-only';
--   end;
--   $$ language plpgsql;
--   create trigger trg_audit_log_no_edit
--   before update or delete on audit_log
--   for each row execute function audit_log_append_only();
--   create trigger trg_audit_log_no_truncate
--   before truncate on audit_log
--   for each statement execute function audit_log_append_only();
