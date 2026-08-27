import { supabaseAdmin } from "./supabase";
import { computeRemindAt } from "./reminders";

export interface EventInput {
  title: string;
  description: string | null;
  eventAt: string;
  appliesToAll: boolean;
  memberIds: string[];
  reminderMinutes: number[];
  ownerMemberId: string | null;
}

export function parseEventInput(body: unknown): EventInput | { error: string } {
  const b = body as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  const description = b.description ? String(b.description).trim() : null;
  const eventAt = typeof b.event_at === "string" ? b.event_at : "";
  const appliesToAll = Boolean(b.applies_to_all);
  const memberIds: string[] = Array.isArray(b.member_ids) ? (b.member_ids as string[]) : [];
  const reminderMinutes: number[] = Array.isArray(b.reminder_minutes)
    ? (b.reminder_minutes as number[])
    : [];
  const ownerMemberId =
    typeof b.owner_member_id === "string" && b.owner_member_id ? b.owner_member_id : null;

  if (!title || !eventAt) {
    return { error: "נדרשים כותרת ותאריך" };
  }
  if (!appliesToAll && memberIds.length === 0) {
    return { error: "יש לבחור למי המועד רלוונטי, או לסמן 'כולם'" };
  }

  return { title, description, eventAt, appliesToAll, memberIds, reminderMinutes, ownerMemberId };
}

// Replaces an event's relevant-members and reminders with a fresh set,
// matching the fields just submitted (used by both create and edit).
export async function setEventRelations(
  eventId: string,
  input: EventInput
): Promise<{ error: string } | null> {
  const { error: deleteMembersError } = await supabaseAdmin
    .from("event_members")
    .delete()
    .eq("event_id", eventId);
  if (deleteMembersError) return { error: deleteMembersError.message };

  if (!input.appliesToAll && input.memberIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("event_members")
      .insert(input.memberIds.map((member_id) => ({ event_id: eventId, member_id })));
    if (error) return { error: error.message };
  }

  const { error: deleteRemindersError } = await supabaseAdmin
    .from("reminders")
    .delete()
    .eq("event_id", eventId);
  if (deleteRemindersError) return { error: deleteRemindersError.message };

  if (input.reminderMinutes.length > 0) {
    const { error } = await supabaseAdmin.from("reminders").insert(
      input.reminderMinutes.map((minutes) => ({
        event_id: eventId,
        remind_at: computeRemindAt(input.eventAt, minutes),
      }))
    );
    if (error) return { error: error.message };
  }

  return null;
}
