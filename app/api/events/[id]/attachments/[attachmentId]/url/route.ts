import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export async function GET(
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
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "קובץ לא נמצא" }, { status: 404 });
  }

  const forceDownload = new URL(req.url).searchParams.get("download") === "1";

  const { data, error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(
      attachment.storage_path,
      300,
      forceDownload ? { download: attachment.file_name } : undefined
    );

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "שגיאה ביצירת קישור" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
