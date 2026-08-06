"use client";

import { useEffect, useState } from "react";
import { SPLASH_VISIBLE_MS, SPLASH_FADE_MS } from "@/lib/splash";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_VISIBLE_MS);
    const removeTimer = setTimeout(
      () => setVisible(false),
      SPLASH_VISIBLE_MS + SPLASH_FADE_MS
    );
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-full-white.png" alt="תזכיר לי" className="w-56" />
    </div>
  );
}
