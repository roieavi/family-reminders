import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseChoreInput, setChoreMembers } from "@/lib/chores";
import { todayIsraelDate } from "@/lib/israelTime";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data: chores, error } = await supabaseAdmin
    .from("chores")
    .select("id, title, recurrence, once_date, active, chore_members(member_id)")
    .eq("family_id", requester.family_id)
    .eq("active", true)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const choreIds = (chores ?? []).map((c) => c.id);
  let completions: { chore_id: string; member_id: string }[] = [];
  if (choreIds.length > 0) {
    const { data: completionsData, error: completionsError } = await supabaseAdmin
      .from("chore_completions")
      .select("chore_id, member_id")
      .in("chore_id", choreIds)
      .eq("completion_date", todayIsraelDate());
    if (completionsError) {
      return NextResponse.json({ error: completionsError.message }, { status: 500 });
    }
    completions = completionsData ?? [];
  }

  const choresWithCompletions = (chores ?? []).map((c) => ({
    ...c,
    completed_member_ids: completions
      .filter((comp) => comp.chore_id === c.id)
      .map((comp) => comp.member_id),
  }));

  return NextResponse.json({ chores: choresWithCompletions });
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const input = parseChoreInput(await req.json());
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const { data: chore, error } = await supabaseAdmin
    .from("chores")
    .insert({
      family_id: requester.family_id,
      title: input.title,
      recurrence: input.recurrence,
      once_date: input.onceDate,
      created_by: requester.id,
    })
    .select()
    .single();

  if (error || !chore) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  const membersError = await setChoreMembers(chore.id, input.memberIds);
  if (membersError) {
    return NextResponse.json(membersError, { status: 500 });
  }

  return NextResponse.json({ chore });
}
