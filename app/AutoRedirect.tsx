"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import { SPLASH_VISIBLE_MS, SPLASH_FADE_MS } from "@/lib/splash";

// If this device already has a saved personal link, skip the join screen
// and go straight to the dashboard - this is what makes the installed app
// "remember" the user across launches instead of asking for the code every time.
// The redirect waits for the splash screen's full duration so it doesn't get
// cut off by the navigation before the user ever sees it.
export default function AutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(MEMBER_TOKEN_KEY);
    if (!token) return;
    const timer = setTimeout(() => {
      router.replace(`/u/${token}`);
    }, SPLASH_VISIBLE_MS + SPLASH_FADE_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
