import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { todayIsraelDate } from "@/lib/israelTime";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("sticky_notes")
    .select("id, text, member_id, created_at")
    .eq("family_id", requester.family_id)
    .eq("note_date", todayIsraelDate())
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "נדרש טקסט לפתק" }, { status: 400 });
  }

  const { data: note, error } = await supabaseAdmin
    .from("sticky_notes")
    .insert({
      family_id: requester.family_id,
      member_id: requester.id,
      text,
      note_date: todayIsraelDate(),
    })
    .select()
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ note });
}
