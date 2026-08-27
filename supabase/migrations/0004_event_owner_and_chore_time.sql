-- Event "ownership" (who the event is about, for kiosk display) is a
-- separate concept from event_members/applies_to_all (who gets reminded) —
-- confirmed those two are still exactly what powers app/api/cron/reminders.
alter table events add column owner_member_id uuid references members(id) on delete set null;

-- Optional time-of-day a chore should be done, shown on the kiosk dashboard.
alter table chores add column scheduled_time time;
