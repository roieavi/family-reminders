import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseEventInput, setEventRelations } from "@/lib/events";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const input = parseEventInput(await req.json());
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .update({
      title: input.title,
      description: input.description,
      event_at: input.eventAt,
      applies_to_all: input.appliesToAll,
      owner_member_id: input.ownerMemberId,
    })
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .select()
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: eventError?.message ?? "מועד לא נמצא" }, { status: 404 });
  }

  const relationsError = await setEventRelations(event.id, input);
  if (relationsError) {
    return NextResponse.json(relationsError, { status: 500 });
  }

  return NextResponse.json({ event });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const { data: attachments } = await supabaseAdmin
    .from("event_attachments")
    .select("storage_path")
    .eq("event_id", id);

  if (attachments && attachments.length > 0) {
    await supabaseAdmin.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((a) => a.storage_path));
  }

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", id)
    .eq("family_id", requester.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
