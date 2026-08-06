import { toIsraelDateTimeParts } from "./israelTime";

export interface Countdown {
  main: string;
  caption: string;
  tone: "today" | "tomorrow" | "soon" | "later";
}

const BADGE_CLASSES: Record<Countdown["tone"], string> = {
  today: "bg-rose-500 text-white",
  tomorrow: "bg-amber-500 text-white",
  soon: "bg-indigo-500 text-white",
  later: "bg-blue-500 text-white",
};

export function formatCountdown(eventAtIso: string): Countdown {
  const eventDay = toIsraelDateTimeParts(eventAtIso).date;
  const todayDay = toIsraelDateTimeParts(new Date().toISOString()).date;
  const diffDays = Math.round(
    (new Date(eventDay).getTime() - new Date(todayDay).getTime()) / 86_400_000
  );

  if (diffDays <= 0) return { main: "היום", caption: "", tone: "today" };
  if (diffDays === 1) return { main: "מחר", caption: "", tone: "tomorrow" };
  if (diffDays <= 6) return { main: String(diffDays), caption: "ימים", tone: "soon" };
  return { main: String(diffDays), caption: "ימים", tone: "later" };
}

export function badgeClasses(tone: Countdown["tone"]): string {
  return BADGE_CLASSES[tone];
}
