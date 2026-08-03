import { ImageResponse } from "next/og";
import { BellIcon } from "@/lib/bell-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BellIcon box={180} glyph={110} />, size);
}
