import webpush from "web-push";
import { PushSubscriptionJSON } from "./types";

webpush.setVapidDetails(
  "mailto:reminders@example.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  subscription: PushSubscriptionJSON,
  payload: { title: string; body: string }
): Promise<boolean> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error("push send failed", err);
    return false;
  }
}
