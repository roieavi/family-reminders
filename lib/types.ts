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
  created_at: string;
}

export interface ReminderRow {
  id: string;
  event_id: string;
  remind_at: string;
  sent: boolean;
  created_at: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
