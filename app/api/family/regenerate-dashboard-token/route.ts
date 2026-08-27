import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { generateMemberToken } from "@/lib/token";

// Immediately invalidates the household's current dashboard link and issues
// a new one - the old link stops working the moment this runs, matching
// members/[id]/regenerate-token's behavior.
export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const dashboardToken = generateMemberToken();
  const { data: family, error } = await supabaseAdmin
    .from("families")
    .update({ dashboard_token: dashboardToken })
    .eq("id", requester.family_id)
    .select("dashboard_token")
    .single();

  if (error || !family) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ dashboard_token: family.dashboard_token });
}
