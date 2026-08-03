import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { generateMemberToken } from "@/lib/token";

// Immediately invalidates the member's current personal link and issues a
// new one - the old token stops working the moment this runs.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const newToken = generateMemberToken();
  const { data, error } = await supabaseAdmin
    .from("members")
    .update({ token: newToken })
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .select("id, token")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "בן משפחה לא נמצא" }, { status: 404 });
  }

  return NextResponse.json({ token: data.token });
}
