create table event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index event_attachments_event_idx on event_attachments (event_id);

-- Same RLS posture as every other table in this app: enabled, no policies.
-- All access goes through server-side API routes using the service role key.
alter table event_attachments enable row level security;

-- Private bucket - never publicly readable. All access goes through
-- short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values ('event-attachments', 'event-attachments', false)
on conflict (id) do nothing;
