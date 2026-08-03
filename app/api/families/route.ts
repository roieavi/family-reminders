import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateMemberToken } from "@/lib/token";

// One-time setup: creates the household's single family plus its first
// member. Only allowed while no family exists yet, so this can't be used to
// spin up duplicate households by accident.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const familyName = (body.familyName ?? "המשפחה שלנו").trim();
  const memberName = (body.memberName ?? "").trim();

  if (!memberName) {
    return NextResponse.json({ error: "נדרש שם" }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("families")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) {
    return NextResponse.json(
      { error: "כבר קיימת משפחה במערכת" },
      { status: 409 }
    );
  }

  const { data: family, error: familyError } = await supabaseAdmin
    .from("families")
    .insert({ name: familyName })
    .select()
    .single();

  if (familyError || !family) {
    return NextResponse.json({ error: familyError?.message }, { status: 500 });
  }

  const token = generateMemberToken();
  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .insert({ family_id: family.id, name: memberName, token })
    .select()
    .single();

  if (memberError || !member) {
    return NextResponse.json({ error: memberError?.message }, { status: 500 });
  }

  return NextResponse.json({ token: member.token });
}
