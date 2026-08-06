import { badgeClasses, type Countdown } from "@/lib/countdown";

const SIZE_CLASSES = {
  sm: "min-w-10 px-2 py-1 text-sm",
  md: "min-w-12 px-3 py-1.5 text-lg",
  lg: "min-w-16 px-4 py-2 text-3xl",
};

export default function CountdownBadge({
  countdown,
  size = "md",
}: {
  countdown: Countdown;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center rounded-xl leading-none ${badgeClasses(countdown.tone)} ${SIZE_CLASSES[size]}`}
    >
      <span className="font-extrabold">{countdown.main}</span>
      {countdown.caption && (
        <span className="mt-0.5 text-[9px] font-semibold opacity-90">{countdown.caption}</span>
      )}
    </div>
  );
}
