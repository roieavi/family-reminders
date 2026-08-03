import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const subscription = body.subscription;
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "מנוי לא תקין" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({ push_subscription: subscription })
    .eq("id", requester.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
