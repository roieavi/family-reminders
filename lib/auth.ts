import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";
import { Member, Family } from "./types";

export const TOKEN_HEADER = "x-member-token";

export async function getMemberFromRequest(req: NextRequest): Promise<Member | null> {
  const token = req.headers.get(TOKEN_HEADER);
  if (!token) return null;
  return getMemberByToken(token);
}

export async function getMemberByToken(token: string): Promise<Member | null> {
  const { data } = await supabaseAdmin
    .from("members")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return data as Member | null;
}

export async function getFamilyByDashboardToken(token: string): Promise<Family | null> {
  const { data } = await supabaseAdmin
    .from("families")
    .select("*")
    .eq("dashboard_token", token)
    .maybeSingle();
  return data as Family | null;
}
