import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SearchEventRow {
  title: string;
  description: string | null;
  event_at: string;
  applies_to_all: boolean;
  event_members: { members: { name: string } | null }[];
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "נדרשת שאלה" }, { status: 400 });
  }

  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 6);

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("title, description, event_at, applies_to_all, event_members(members(name))")
    .eq("family_id", requester.family_id)
    .gte("event_at", from.toISOString())
    .lte("event_at", to.toISOString())
    .order("event_at")
    .returns<SearchEventRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formatIsraelTime = (d: Date) =>
    d.toLocaleString("he-IL", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    });

  const context = (data ?? []).map((e) => ({
    title: e.title,
    description: e.description,
    date: formatIsraelTime(new Date(e.event_at)),
    relevant_to: e.applies_to_all
      ? "כולם"
      : e.event_members.map((em) => em.members?.name).filter(Boolean),
  }));

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system:
      `את/ה עוזר/ת שעונה בעברית על שאלות לגבי מועדים ותורים משפחתיים, ` +
      `אך ורק על סמך רשימת המועדים ב-JSON שמסופקת לך. כל התאריכים והשעות ` +
      `ברשימה כבר מנוסחים לפי שעון ישראל - ציין/י אותם כפי שהם, בלי להמיר ` +
      `אזורי זמן בעצמך. אל תמציא/י תאריכים או פרטים שלא מופיעים ברשימה. אם ` +
      `לא נמצא מידע רלוונטי, אמור/י זאת בפירוש במקום לנחש. השואל/ת נקרא/ת ` +
      `"${requester.name}" - כשהשאלה משתמשת במילים "אני"/"שלי" הכוונה אליו/ה. ` +
      `התאריך והשעה הנוכחיים (שעון ישראל): ${formatIsraelTime(now)}. ` +
      `ענה/י בתשובה קצרה וברורה, לא ברשימה טכנית.`,
    messages: [
      {
        role: "user",
        content: `רשימת מועדים:\n${JSON.stringify(context)}\n\nשאלה: ${question}`,
      },
    ],
  });

  const answer = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return NextResponse.json({ answer });
}
