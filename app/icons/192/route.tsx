import { ImageResponse } from "next/og";
import { BellIcon } from "@/lib/bell-icon";

export async function GET() {
  return new ImageResponse(<BellIcon box={192} glyph={116} />, {
    width: 192,
    height: 192,
  });
}
