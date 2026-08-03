import { ImageResponse } from "next/og";
import { BellIcon } from "@/lib/bell-icon";

export async function GET() {
  return new ImageResponse(<BellIcon box={512} glyph={310} />, {
    width: 512,
    height: 512,
  });
}
