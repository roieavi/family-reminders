import fs from "fs";
import path from "path";

// Shared JSX for the app icon (browser tab, apple touch icon, manifest icons,
// push notification icon) - rendered via next/og's ImageResponse. Embeds the
// logo as a base64 data URI since ImageResponse/satori can't resolve
// relative "/public" paths at render time.
const iconBuffer = fs.readFileSync(
  path.join(process.cwd(), "public", "logo-icon-white.png")
);
const iconDataUri = `data:image/png;base64,${iconBuffer.toString("base64")}`;

export function BellIcon({ box, glyph }: { box: number; glyph: number }) {
  return (
    <div
      style={{
        width: box,
        height: box,
        background: "#4f46e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconDataUri} width={glyph} height={glyph} alt="" />
    </div>
  );
}
