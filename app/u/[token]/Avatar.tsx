import { initials, type MemberColor } from "@/lib/memberColors";

export default function Avatar({
  name,
  color,
  size = "md",
  ring = false,
}: {
  name: string;
  color: MemberColor;
  size?: "sm" | "md";
  ring?: boolean;
}) {
  const dimensions = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <span
      title={name}
      className={`flex ${dimensions} shrink-0 items-center justify-center rounded-full font-semibold text-white ${color.bg} ${
        ring ? `ring-2 ring-white` : ""
      }`}
    >
      {initials(name)}
    </span>
  );
}
