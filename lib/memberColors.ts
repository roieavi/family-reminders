// Full literal class names (not interpolated) so Tailwind's scanner picks them up.
// Kept within the app's cool indigo/blue/violet family for color harmony,
// rather than spanning into warm hues.
export const MEMBER_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-300" },
  { bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-300" },
  { bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-700", ring: "ring-cyan-300" },
  { bg: "bg-indigo-500", light: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-300" },
  { bg: "bg-sky-500", light: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-300" },
  { bg: "bg-teal-500", light: "bg-teal-100", text: "text-teal-700", ring: "ring-teal-300" },
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export function colorForMember(
  members: { id: string }[],
  memberId: string
): MemberColor {
  const idx = members.findIndex((m) => m.id === memberId);
  return MEMBER_COLORS[(idx >= 0 ? idx : 0) % MEMBER_COLORS.length];
}

export function initials(name: string): string {
  return name.trim().slice(0, 2);
}
