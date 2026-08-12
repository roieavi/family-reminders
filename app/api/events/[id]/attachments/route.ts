import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { isAllowedAttachmentType, MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/attachments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id: eventId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const body = await req.json();
  const path = String(body.path ?? "");
  const fileName = String(body.fileName ?? "").trim();
  const contentType = String(body.contentType ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (
    !path ||
    !fileName ||
    !isAllowedAttachmentType(contentType) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_ATTACHMENT_SIZE_BYTES
  ) {
    return NextResponse.json({ error: "פרטי קובץ לא תקינים" }, { status: 400 });
  }

  const { data: attachment, error } = await supabaseAdmin
    .from("event_attachments")
    .insert({
      event_id: eventId,
      storage_path: path,
      file_name: fileName,
      content_type: contentType,
      size_bytes: sizeBytes,
      uploaded_by: requester.id,
    })
    .select()
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: error?.message ?? "שגיאה בשמירת הקובץ" }, { status: 500 });
  }

  return NextResponse.json({ attachment });
}
