export interface Member {
  id: string;
  family_id: string;
  name: string;
  token: string;
  email: string | null;
  push_subscription: PushSubscriptionJSON | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  event_at: string;
  created_by: string;
  applies_to_all: boolean;
  owner_member_id: string | null;
  created_at: string;
}

export interface ReminderRow {
  id: string;
  event_id: string;
  remind_at: string;
  sent: boolean;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  dashboard_token: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  created_at: string;
}

export interface ChoreRow {
  id: string;
  family_id: string;
  title: string;
  recurrence: "daily" | "once";
  once_date: string | null;
  scheduled_time: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
}

export interface ChoreCompletionRow {
  id: string;
  chore_id: string;
  member_id: string;
  completion_date: string;
  completed_at: string;
}

export interface StickyNoteRow {
  id: string;
  family_id: string;
  member_id: string;
  text: string;
  note_date: string;
  created_at: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
