-- Daily schedule: chores/tasks, per-member daily completions, sticky notes,
-- and the family-level fields needed for the tablet kiosk dashboard.

alter table families add column dashboard_token text unique;
alter table families add column latitude double precision;
alter table families add column longitude double precision;
alter table families add column location_label text;

create table chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  recurrence text not null check (recurrence in ('daily', 'once')),
  once_date date,
  active boolean not null default true,
  created_by uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table chore_members (
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (chore_id, member_id)
);

create table chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  completion_date date not null,
  completed_at timestamptz not null default now(),
  unique (chore_id, member_id, completion_date)
);

create table sticky_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  text text not null,
  note_date date not null,
  created_at timestamptz not null default now()
);

create index chores_family_idx on chores (family_id, active);
create index chore_completions_lookup_idx on chore_completions (chore_id, completion_date);
create index sticky_notes_family_date_idx on sticky_notes (family_id, note_date);
create index families_dashboard_token_idx on families (dashboard_token);

-- Same RLS posture as every other table in this app: enabled, no policies.
-- All access goes through server-side API routes using the service role key.
alter table chores enable row level security;
alter table chore_members enable row level security;
alter table chore_completions enable row level security;
alter table sticky_notes enable row level security;
