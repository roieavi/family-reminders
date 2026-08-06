"use client";

import { createPortal } from "react-dom";

export default function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-700">
          <button
            onClick={onClose}
            aria-label="סגור"
            className="text-2xl leading-none text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ✕
          </button>
          {title && <p className="font-semibold">{title}</p>}
          <span className="w-6" aria-hidden="true" />
        </div>
        <div className="no-scrollbar overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
