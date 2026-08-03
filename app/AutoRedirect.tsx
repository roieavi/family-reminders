"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";

// If this device already has a saved personal link, skip the join screen
// and go straight to the dashboard - this is what makes the installed app
// "remember" the user across launches instead of asking for the code every time.
export default function AutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(MEMBER_TOKEN_KEY);
    if (token) router.replace(`/u/${token}`);
  }, [router]);

  return null;
}
