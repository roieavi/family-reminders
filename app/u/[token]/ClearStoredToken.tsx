"use client";

import { useEffect } from "react";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";

// If this page is shown, the token in the URL is invalid - clear whatever
// was saved locally so the root page doesn't just bounce back here.
export default function ClearStoredToken() {
  useEffect(() => {
    localStorage.removeItem(MEMBER_TOKEN_KEY);
  }, []);

  return null;
}
