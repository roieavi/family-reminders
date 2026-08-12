import { supabaseBrowser } from "./supabaseClient";
import { ATTACHMENTS_BUCKET } from "./attachments";

export async function uploadAttachment(
  token: string,
  eventId: string,
  file: File
): Promise<{ error?: string }> {
  const headers = { "Content-Type": "application/json", "x-member-token": token };

  const signRes = await fetch(`/api/events/${eventId}/attachments/sign`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  const signData = await signRes.json();
  if (!signRes.ok) return { error: signData.error ?? "שגיאה בהעלאה" };

  const { error: uploadError } = await supabaseBrowser.storage
    .from(ATTACHMENTS_BUCKET)
    .uploadToSignedUrl(signData.path, signData.token, file);
  if (uploadError) return { error: uploadError.message };

  const registerRes = await fetch(`/api/events/${eventId}/attachments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      path: signData.path,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  const registerData = await registerRes.json();
  if (!registerRes.ok) return { error: registerData.error ?? "שגיאה בשמירת הקובץ" };

  return {};
}
