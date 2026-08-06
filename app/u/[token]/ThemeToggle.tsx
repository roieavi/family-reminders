"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import ToggleSwitch from "./ToggleSwitch";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle(checked: boolean) {
    const next: Theme = checked ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="flex items-center justify-between rounded-xl border-2 border-black px-3 py-2.5 text-sm font-semibold dark:border-zinc-300">
      <span className="flex items-center gap-2">
        <span aria-hidden="true">{theme === "dark" ? "🌙" : "☀️"}</span>
        {theme === "dark" ? "מצב כהה" : "מצב בהיר"}
      </span>
      <ToggleSwitch checked={theme === "dark"} onChange={toggle} />
    </div>
  );
}
