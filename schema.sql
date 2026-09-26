-- Discord Points Manager — schema
-- Run this once in the Supabase SQL editor for a fresh project.

create extension if not exists pgcrypto;

-- discord_id is derived deterministically from discord_username (see lib/users.ts,
-- resolveDiscordId) — it is NOT a real Discord snowflake, since users are only ever
-- created via CSV/Excel bulk import, which supplies a username and nothing else.
create table users (
  discord_id       text primary key,
  discord_username text not null unique,
  created_at       timestamptz not null default now()
);

create table events (
  event_id   uuid primary key default gen_random_uuid(),
  event_name text not null,
  created_at timestamptz not null default now(),
  month      text generated always as (to_char(created_at, 'YYYY-MM')) stored
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

-- Login roster — only emails listed here can sign in. Managed by hand: add
-- someone with the SQL printed by `npm run hash-password`, remove them with
-- `delete from app_users where email = '...';` (takes effect immediately).
create table app_users (
  email         text primary key check (email = lower(email)),
  password_hash text not null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  created_at    timestamptz not null default now()
);
-- RLS on with no policies: nothing but the service role can read password hashes.
alter table app_users enable row level security;

-- All access is mediated by this app's own API routes, which require a signed-in
-- roster member and use the service-role key server-side — the browser never
-- talks to Supabase directly.
