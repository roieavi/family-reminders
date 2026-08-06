import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ReminderEmailData {
  eventTitle: string;
  eventTime: string;
  description: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildReminderEmailHtml({ eventTitle, eventTime, description }: ReminderEmailData): string {
  return `
<div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f5; padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px;">
    <p style="margin:0 0 8px;font-size:12px;color:#71717a;letter-spacing:0.5px;">תזכורת</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">${escapeHtml(eventTitle)}</h1>
    <p style="margin:0;font-size:15px;color:#3f3f46;">${escapeHtml(eventTime)}</p>
    ${description ? `<p style="margin:16px 0 0;font-size:14px;color:#52525b;white-space:pre-wrap;">${escapeHtml(description)}</p>` : ""}
  </div>
  <p style="text-align:center;font-size:12px;color:#a1a1aa;margin-top:16px;">נשלח אוטומטית מ"תזכיר לי"</p>
</div>`;
}

export async function sendReminderEmail(
  to: string,
  data: ReminderEmailData
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: "תזכיר לי <onboarding@resend.dev>",
      to,
      subject: `תזכורת: ${data.eventTitle}`,
      html: buildReminderEmailHtml(data),
      text: `${data.eventTitle} - ${data.eventTime}${data.description ? "\n" + data.description : ""}`,
    });
    return true;
  } catch (err) {
    console.error("email send failed", err);
    return false;
  }
}
