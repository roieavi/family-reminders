import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { generateMemberToken } from "@/lib/token";

// Lists household members without exposing their personal tokens - only the
// member who was just created gets their own token back (see POST below).
export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, name, email")
    .eq("family_id", requester.family_id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data });
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const name = (body.name ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;

  if (!name) {
    return NextResponse.json({ error: "נדרש שם" }, { status: 400 });
  }

  const token = generateMemberToken();
  const { data, error } = await supabaseAdmin
    .from("members")
    .insert({ family_id: requester.family_id, name, email, token })
    .select("id, name, token")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}
