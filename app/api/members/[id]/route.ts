import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const body = await req.json();
  const email = body.email ? String(body.email).trim() : null;

  const { data, error } = await supabaseAdmin
    .from("members")
    .update({ email })
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .select("id, name, email")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "בן משפחה לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({ member: data });
}
