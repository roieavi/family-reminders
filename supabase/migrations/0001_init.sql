-- Household reminders: core schema
create extension if not exists pgcrypto;

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  token text not null unique,
  email text,
  push_subscription jsonb,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  description text,
  event_at timestamptz not null,
  created_by uuid not null references members(id) on delete cascade,
  applies_to_all boolean not null default false,
  created_at timestamptz not null default now()
);

create table event_members (
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (event_id, member_id)
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  remind_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index reminders_due_idx on reminders (remind_at) where sent = false;
create index members_token_idx on members (token);
create index events_family_idx on events (family_id, event_at);

-- All access goes through server-side API routes using the Supabase service
-- role key, which bypasses RLS. RLS is enabled with no policies so the
-- anon/public key (if ever exposed to the browser) cannot read or write
-- anything directly.
alter table families enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table event_members enable row level security;
alter table reminders enable row level security;
