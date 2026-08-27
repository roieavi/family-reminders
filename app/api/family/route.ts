import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data: family, error } = await supabaseAdmin
    .from("families")
    .select("id, name, location_label, latitude, longitude, dashboard_token")
    .eq("id", requester.family_id)
    .single();

  if (error || !family) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ family });
}

export async function PATCH(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const locationLabel = body.location_label ? String(body.location_label).trim() : null;
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;

  if (locationLabel && (latitude === null || longitude === null)) {
    return NextResponse.json({ error: "נדרשות קואורדינטות תקינות למיקום" }, { status: 400 });
  }

  const { data: family, error } = await supabaseAdmin
    .from("families")
    .update({ location_label: locationLabel, latitude, longitude })
    .eq("id", requester.family_id)
    .select("id, name, location_label, latitude, longitude, dashboard_token")
    .single();

  if (error || !family) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ family });
}
