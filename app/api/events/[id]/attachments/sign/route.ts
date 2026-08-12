import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_EVENT,
  buildStoragePath,
  isAllowedAttachmentType,
} from "@/lib/attachments";

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
  const fileName = String(body.fileName ?? "").trim();
  const contentType = String(body.contentType ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }
  if (!isAllowedAttachmentType(contentType)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 15MB)" }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("event_attachments")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_EVENT) {
    return NextResponse.json(
      { error: `ניתן לצרף עד ${MAX_ATTACHMENTS_PER_EVENT} קבצים למועד` },
      { status: 400 }
    );
  }

  const attachmentId = randomUUID();
  const path = buildStoragePath(requester.family_id, eventId, attachmentId, fileName);

  const { data, error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "שגיאה ביצירת קישור העלאה" },
      { status: 500 }
    );
  }

  return NextResponse.json({ path, token: data.token });
}
