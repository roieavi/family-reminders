"use client";

import { useRef, useState } from "react";
import { MAX_ATTACHMENTS_PER_EVENT, MAX_ATTACHMENT_SIZE_BYTES, type EventAttachment } from "@/lib/attachments";

export default function AttachmentsField({
  token,
  eventId,
  existing,
  onExistingChange,
  pendingFiles,
  onPendingFilesChange,
}: {
  token: string;
  eventId: string | null;
  existing: EventAttachment[];
  onExistingChange: (attachments: EventAttachment[]) => void;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const totalCount = existing.length + pendingFiles.length + files.length;
    if (totalCount > MAX_ATTACHMENTS_PER_EVENT) {
      setError(`ניתן לצרף עד ${MAX_ATTACHMENTS_PER_EVENT} קבצים למועד`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (tooBig) {
      setError(`הקובץ "${tooBig.name}" גדול מדי (מקסימום 15MB)`);
      return;
    }
    onPendingFilesChange([...pendingFiles, ...files]);
  }

  function removePending(index: number) {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
  }

  async function removeExisting(id: string) {
    if (!eventId) return;
    if (!confirm("למחוק את הקובץ המצורף?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/attachments/${id}`, {
        method: "DELETE",
        headers: { "x-member-token": token },
      });
      if (!res.ok) {
        setError("שגיאה במחיקת הקובץ");
        return;
      }
      onExistingChange(existing.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="block text-xs font-semibold tracking-wide text-zinc-400">
          קבצים מצורפים
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
        >
          + הוספת קובץ
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {(existing.length > 0 || pendingFiles.length > 0) && (
        <ul className="mt-2 flex flex-col gap-1">
          {existing.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-zinc-100 px-2 py-1.5 text-sm dark:border-zinc-700"
            >
              <span className="truncate">{a.file_name}</span>
              <button
                type="button"
                onClick={() => removeExisting(a.id)}
                disabled={deletingId === a.id}
                className="shrink-0 text-xs font-semibold text-red-500 transition hover:text-red-700 disabled:opacity-50"
              >
                הסר
              </button>
            </li>
          ))}
          {pendingFiles.map((f, i) => (
            <li
              key={`pending-${i}`}
              className="flex items-center justify-between rounded-lg border border-dashed border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-600"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removePending(i)}
                className="shrink-0 text-xs font-semibold text-red-500 transition hover:text-red-700"
              >
                הסר
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
