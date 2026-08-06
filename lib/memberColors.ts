// Full literal class names (not interpolated) so Tailwind's scanner picks them up.
export const MEMBER_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-300" },
  { bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-300" },
  { bg: "bg-rose-500", light: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-300" },
  { bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300" },
  { bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-300" },
  { bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-700", ring: "ring-cyan-300" },
  { bg: "bg-orange-500", light: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300" },
  { bg: "bg-fuchsia-500", light: "bg-fuchsia-100", text: "text-fuchsia-700", ring: "ring-fuchsia-300" },
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
