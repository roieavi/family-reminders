import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";
import { sendReminderEmail } from "@/lib/email";
import { Member } from "@/lib/types";

interface DueReminder {
  id: string;
  event_id: string;
  events: {
    id: string;
    title: string;
    description: string | null;
    event_at: string;
    family_id: string;
    applies_to_all: boolean;
  } | null;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: dueReminders, error } = await supabaseAdmin
    .from("reminders")
    .select("id, event_id, events(id, title, description, event_at, family_id, applies_to_all)")
    .eq("sent", false)
    .lte("remind_at", new Date().toISOString())
    .returns<DueReminder[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  for (const reminder of dueReminders ?? []) {
    const event = reminder.events;
    if (!event) continue;

    const members = await resolveRelevantMembers(event.family_id, event.id, event.applies_to_all);
    const eventTime = new Date(event.event_at).toLocaleString("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    });
    const pushBody = `${event.title} - ${eventTime}${event.description ? "\n" + event.description : ""}`;

    for (const member of members) {
      if (member.push_subscription) {
        await sendPushNotification(member.push_subscription, {
          title: "תזכורת",
          body: pushBody,
        });
      }
      if (member.email) {
        await sendReminderEmail(member.email, {
          eventTitle: event.title,
          eventTime,
          description: event.description,
        });
      }
    }

    await supabaseAdmin.from("reminders").update({ sent: true }).eq("id", reminder.id);
    processed += 1;
  }

  return NextResponse.json({ processed });
}

async function resolveRelevantMembers(
  familyId: string,
  eventId: string,
  appliesToAll: boolean
): Promise<Member[]> {
  if (appliesToAll) {
    const { data } = await supabaseAdmin
      .from("members")
      .select("*")
      .eq("family_id", familyId);
    return (data as Member[]) ?? [];
  }

  const { data } = await supabaseAdmin
    .from("event_members")
    .select("members(*)")
    .eq("event_id", eventId);

  return ((data ?? []) as unknown as { members: Member }[])
    .map((row) => row.members)
    .filter(Boolean);
}
