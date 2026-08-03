export function computeRemindAt(eventAt: string | Date, offsetMinutes: number): string {
  const eventDate = typeof eventAt === "string" ? new Date(eventAt) : eventAt;
  return new Date(eventDate.getTime() - offsetMinutes * 60_000).toISOString();
}

export const REMINDER_PRESETS = [
  { label: "15 דקות לפני", minutes: 15 },
  { label: "שעה לפני", minutes: 60 },
  { label: "3 שעות לפני", minutes: 180 },
  { label: "יום לפני", minutes: 60 * 24 },
  { label: "שבוע לפני", minutes: 60 * 24 * 7 },
];
