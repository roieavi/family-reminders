import { supabaseAdmin } from "./supabase";

export interface ChoreInput {
  title: string;
  recurrence: "daily" | "once";
  onceDate: string | null;
  memberIds: string[];
}

export function parseChoreInput(body: unknown): ChoreInput | { error: string } {
  const b = body as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  const recurrence =
    b.recurrence === "once" ? "once" : b.recurrence === "daily" ? "daily" : null;
  const onceDate = typeof b.once_date === "string" && b.once_date ? b.once_date : null;
  const memberIds: string[] = Array.isArray(b.member_ids) ? (b.member_ids as string[]) : [];

  if (!title) {
    return { error: "נדרשת כותרת" };
  }
  if (!recurrence) {
    return { error: "נדרש סוג חזרתיות" };
  }
  if (recurrence === "once" && !onceDate) {
    return { error: "משימה חד-פעמית דורשת תאריך" };
  }
  if (memberIds.length === 0) {
    return { error: "יש לבחור לפחות בן משפחה אחד" };
  }

  return { title, recurrence, onceDate, memberIds };
}

// Replaces a chore's assigned members with a fresh set, matching the fields
// just submitted (used by both create and edit) — mirrors setEventRelations.
export async function setChoreMembers(
  choreId: string,
  memberIds: string[]
): Promise<{ error: string } | null> {
  const { error: deleteError } = await supabaseAdmin
    .from("chore_members")
    .delete()
    .eq("chore_id", choreId);
  if (deleteError) return { error: deleteError.message };

  if (memberIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("chore_members")
      .insert(memberIds.map((member_id) => ({ chore_id: choreId, member_id })));
    if (error) return { error: error.message };
  }

  return null;
}
