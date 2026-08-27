import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseEventInput, setEventRelations } from "@/lib/events";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, event_at, applies_to_all, created_by, owner_member_id, event_members(member_id), reminders(id, remind_at, sent), event_attachments(id, file_name, content_type, size_bytes)"
    )
    .eq("family_id", requester.family_id)
    .gte("event_at", new Date().toISOString())
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

  const input = parseEventInput(await req.json());
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .insert({
      family_id: requester.family_id,
      title: input.title,
      description: input.description,
      event_at: input.eventAt,
      created_by: requester.id,
      applies_to_all: input.appliesToAll,
      owner_member_id: input.ownerMemberId,
    })
    .select()
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: eventError?.message }, { status: 500 });
  }

  const relationsError = await setEventRelations(event.id, input);
  if (relationsError) {
    return NextResponse.json(relationsError, { status: 500 });
  }

  return NextResponse.json({ event });
}
