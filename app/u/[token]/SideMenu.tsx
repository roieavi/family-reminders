"use client";

import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

export default function SideMenu({
  children,
}: {
  children: (api: { open: () => void }) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative overflow-x-hidden">
      <div
        className={`transition-transform duration-300 ${isOpen ? "-translate-x-72" : "translate-x-0"}`}
      >
        {children({ open: () => setIsOpen(true) })}
      </div>

      <aside
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 right-0 z-40 w-72 overflow-y-auto bg-white p-4 shadow-xl transition-transform duration-300 dark:bg-zinc-800 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="סגור תפריט"
          className="mb-4 text-2xl leading-none text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ✕
        </button>
        <ThemeToggle />
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
