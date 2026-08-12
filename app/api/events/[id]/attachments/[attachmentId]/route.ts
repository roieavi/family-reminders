import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id: eventId, attachmentId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const { data: attachment } = await supabaseAdmin
    .from("event_attachments")
    .select("id, storage_path")
    .eq("id", attachmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "קובץ לא נמצא" }, { status: 404 });
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from("event_attachments").delete().eq("id", attachmentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
