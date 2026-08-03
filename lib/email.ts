import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReminderEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: "תזכורות המשפחה <onboarding@resend.dev>",
      to,
      subject,
      text: body,
    });
    return true;
  } catch (err) {
    console.error("email send failed", err);
    return false;
  }
}
