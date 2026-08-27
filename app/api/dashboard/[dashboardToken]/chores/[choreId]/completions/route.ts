import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFamilyByDashboardToken } from "@/lib/auth";
import { todayIsraelDate } from "@/lib/israelTime";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dashboardToken: string; choreId: string }> }
) {
  const { dashboardToken, choreId } = await params;
  const family = await getFamilyByDashboardToken(dashboardToken);
  if (!family) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const memberId = String(body.member_id ?? "");
  if (!memberId) {
    return NextResponse.json({ error: "נדרש בן משפחה" }, { status: 400 });
  }

  const { data: chore } = await supabaseAdmin
    .from("chores")
    .select("id")
    .eq("id", choreId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (!chore) {
    return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  }

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "בן משפחה לא נמצא" }, { status: 404 });
  }

  const today = todayIsraelDate();
  const { data: existing } = await supabaseAdmin
    .from("chore_completions")
    .select("id")
    .eq("chore_id", choreId)
    .eq("member_id", memberId)
    .eq("completion_date", today)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from("chore_completions").delete().eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ completed: false });
  }

  const { error } = await supabaseAdmin.from("chore_completions").insert({
    chore_id: choreId,
    member_id: memberId,
    completion_date: today,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ completed: true });
}
