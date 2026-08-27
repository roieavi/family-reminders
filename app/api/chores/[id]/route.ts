import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseChoreInput, setChoreMembers } from "@/lib/chores";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const input = parseChoreInput(await req.json());
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const { data: chore, error } = await supabaseAdmin
    .from("chores")
    .update({
      title: input.title,
      recurrence: input.recurrence,
      once_date: input.onceDate,
    })
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .select()
    .single();

  if (error || !chore) {
    return NextResponse.json({ error: error?.message ?? "משימה לא נמצאה" }, { status: 404 });
  }

  const membersError = await setChoreMembers(chore.id, input.memberIds);
  if (membersError) {
    return NextResponse.json(membersError, { status: 500 });
  }

  return NextResponse.json({ chore });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const { data: chore } = await supabaseAdmin
    .from("chores")
    .select("id")
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!chore) {
    return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("chores")
    .delete()
    .eq("id", id)
    .eq("family_id", requester.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
