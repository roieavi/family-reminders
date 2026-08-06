import { badgeClasses, type Countdown } from "@/lib/countdown";

const TILE_SIZE = {
  sm: "h-6 w-5 text-xs",
  md: "h-8 w-6 text-base",
  lg: "h-12 w-9 text-3xl",
};

const GAP = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

const CAPTION_SIZE = {
  sm: "text-[8px]",
  md: "text-[9px]",
  lg: "text-[11px]",
};

export default function CountdownBadge({
  countdown,
  size = "md",
}: {
  countdown: Countdown;
  size?: "sm" | "md" | "lg";
}) {
  const isNumeric = /^\d+$/.test(countdown.main);

  return (
    <div className="flex flex-col items-center">
      <div className={`flex ${GAP[size]}`} dir={isNumeric ? "ltr" : undefined}>
        {countdown.main.split("").map((char, i) => (
          <span
            key={i}
            className={`relative flex ${TILE_SIZE[size]} items-center justify-center overflow-hidden rounded-md font-extrabold shadow-md ${badgeClasses(countdown.tone)}`}
          >
            {char}
            <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/25" />
          </span>
        ))}
      </div>
      {countdown.caption && (
        <span
          className={`mt-1 font-semibold tracking-wide text-zinc-400 ${CAPTION_SIZE[size]}`}
        >
          {countdown.caption}
        </span>
      )}
    </div>
  );
}
