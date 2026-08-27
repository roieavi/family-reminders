import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFamilyByDashboardToken } from "@/lib/auth";
import { todayIsraelDate, toIsraelDateTimeParts } from "@/lib/israelTime";
import { fetchWeather } from "@/lib/weather";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dashboardToken: string }> }
) {
  const { dashboardToken } = await params;
  const family = await getFamilyByDashboardToken(dashboardToken);
  if (!family) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const today = todayIsraelDate();

  const [membersRes, eventsRes, choresRes] = await Promise.all([
    supabaseAdmin.from("members").select("id, name").eq("family_id", family.id).order("name"),
    supabaseAdmin
      .from("events")
      .select("id, title, event_at, applies_to_all, event_members(member_id)")
      .eq("family_id", family.id)
      .order("event_at"),
    supabaseAdmin
      .from("chores")
      .select("id, title, recurrence, once_date, chore_members(member_id)")
      .eq("family_id", family.id)
      .eq("active", true),
  ]);

  // Filtered in JS against the Israel calendar date rather than a UTC
  // timestamp range, so this doesn't drift by an hour across the DST
  // transition (a fixed "+03:00" offset would be wrong for half the year —
  // Israel is UTC+2 in winter).
  const todaysEvents = (eventsRes.data ?? []).filter(
    (e) => toIsraelDateTimeParts(e.event_at).date === today
  );

  const todaysChores = (choresRes.data ?? []).filter(
    (c) => c.recurrence === "daily" || c.once_date === today
  );
  const choreIds = todaysChores.map((c) => c.id);

  const [completionsRes, notesRes] = await Promise.all([
    choreIds.length > 0
      ? supabaseAdmin
          .from("chore_completions")
          .select("chore_id, member_id")
          .in("chore_id", choreIds)
          .eq("completion_date", today)
      : Promise.resolve({ data: [] as { chore_id: string; member_id: string }[], error: null }),
    supabaseAdmin
      .from("sticky_notes")
      .select("id, text, member_id")
      .eq("family_id", family.id)
      .eq("note_date", today)
      .order("created_at"),
  ]);

  const chores = todaysChores.map((c) => ({
    ...c,
    completed_member_ids: (completionsRes.data ?? [])
      .filter((comp) => comp.chore_id === c.id)
      .map((comp) => comp.member_id),
  }));

  const weather =
    family.latitude !== null && family.longitude !== null
      ? await fetchWeather(family.latitude, family.longitude)
      : null;

  return NextResponse.json({
    family: { name: family.name, location_label: family.location_label },
    members: membersRes.data ?? [],
    events: todaysEvents,
    chores,
    notes: notesRes.data ?? [],
    weather,
  });
}
