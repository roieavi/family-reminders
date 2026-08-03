import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { computeRemindAt } from "@/lib/reminders";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, event_at, applies_to_all, created_by, event_members(member_id), reminders(id, remind_at, sent)"
    )
    .eq("family_id", requester.family_id)
    .order("event_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const title = (body.title ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const eventAt = body.event_at;
  const appliesToAll = Boolean(body.applies_to_all);
  const memberIds: string[] = Array.isArray(body.member_ids) ? body.member_ids : [];
  const reminderOffsets: number[] = Array.isArray(body.reminder_minutes)
    ? body.reminder_minutes
    : [];

  if (!title || !eventAt) {
    return NextResponse.json({ error: "נדרשים כותרת ותאריך" }, { status: 400 });
  }
  if (!appliesToAll && memberIds.length === 0) {
    return NextResponse.json(
      { error: "יש לבחור למי המועד רלוונטי, או לסמן 'כולם'" },
      { status: 400 }
    );
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .insert({
      family_id: requester.family_id,
      title,
      description,
      event_at: eventAt,
      created_by: requester.id,
      applies_to_all: appliesToAll,
    })
    .select()
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: eventError?.message }, { status: 500 });
  }

  if (!appliesToAll && memberIds.length > 0) {
    const { error: memberLinkError } = await supabaseAdmin
      .from("event_members")
      .insert(memberIds.map((member_id) => ({ event_id: event.id, member_id })));
    if (memberLinkError) {
      return NextResponse.json({ error: memberLinkError.message }, { status: 500 });
    }
  }

  if (reminderOffsets.length > 0) {
    const { error: remindersError } = await supabaseAdmin.from("reminders").insert(
      reminderOffsets.map((minutes) => ({
        event_id: event.id,
        remind_at: computeRemindAt(eventAt, minutes),
      }))
    );
    if (remindersError) {
      return NextResponse.json({ error: remindersError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ event });
}
