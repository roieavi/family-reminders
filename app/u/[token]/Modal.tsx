"use client";

export default function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border-2 border-black bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            onClick={onClose}
            aria-label="סגור"
            className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold transition hover:bg-indigo-50"
          >
            ✕ סגור
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
