import { toIsraelDateTimeParts } from "./israelTime";

export interface Countdown {
  label: string;
  tone: "today" | "tomorrow" | "soon" | "later";
}

const TONE_CLASSES: Record<Countdown["tone"], string> = {
  today: "bg-rose-100 text-rose-700",
  tomorrow: "bg-amber-100 text-amber-700",
  soon: "bg-amber-100 text-amber-700",
  later: "bg-blue-100 text-blue-700",
};

export function formatCountdown(eventAtIso: string): Countdown {
  const eventDay = toIsraelDateTimeParts(eventAtIso).date;
  const todayDay = toIsraelDateTimeParts(new Date().toISOString()).date;
  const diffDays = Math.round(
    (new Date(eventDay).getTime() - new Date(todayDay).getTime()) / 86_400_000
  );

  if (diffDays <= 0) return { label: "היום", tone: "today" };
  if (diffDays === 1) return { label: "מחר", tone: "tomorrow" };
  if (diffDays <= 6) return { label: `בעוד ${diffDays} ימים`, tone: "soon" };
  return { label: `בעוד ${diffDays} ימים`, tone: "later" };
}

export function countdownClasses(tone: Countdown["tone"]): string {
  return TONE_CLASSES[tone];
}
