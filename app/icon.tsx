import { ImageResponse } from "next/og";
import { BellIcon } from "@/lib/bell-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BellIcon box={32} glyph={20} />, size);
}
