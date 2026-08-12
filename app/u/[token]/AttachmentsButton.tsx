"use client";

import { useState } from "react";
import Modal from "./Modal";
import Lightbox from "./Lightbox";
import type { EventAttachment } from "@/lib/attachments";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function fetchSignedUrl(
  token: string,
  eventId: string,
  attachmentId: string,
  download: boolean
): Promise<string | null> {
  const res = await fetch(
    `/api/events/${eventId}/attachments/${attachmentId}/url${download ? "?download=1" : ""}`,
    { headers: { "x-member-token": token } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ?? null;
}

export default function AttachmentsButton({
  token,
  eventId,
  attachments,
}: {
  token: string;
  eventId: string;
  attachments: EventAttachment[];
}) {
  const [showList, setShowList] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function handleView(a: EventAttachment) {
    setBusyId(a.id);
    setError(null);
    try {
      const url = await fetchSignedUrl(token, eventId, a.id, false);
      if (!url) {
        setError("שגיאה בטעינת הקובץ");
        return;
      }
      if (a.content_type.startsWith("image/")) {
        setLightbox({ src: url, alt: a.file_name });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("שגיאה בטעינת הקובץ");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(a: EventAttachment) {
    setBusyId(a.id);
    setError(null);
    try {
      const url = await fetchSignedUrl(token, eventId, a.id, true);
      if (!url) {
        setError("שגיאה בהורדת הקובץ");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = a.file_name;
      link.click();
    } catch {
      setError("שגיאה בהורדת הקובץ");
    } finally {
      setBusyId(null);
    }
  }

  async function handleShare(a: EventAttachment) {
    setBusyId(a.id);
    setError(null);
    try {
      const url = await fetchSignedUrl(token, eventId, a.id, false);
      if (!url) {
        setError("שגיאה בשיתוף הקובץ");
        return;
      }
      const res = await fetch(url);
      if (!res.ok) {
        setError("שגיאה בשיתוף הקובץ");
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], a.file_name, { type: a.content_type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: a.file_name });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user cancelled the native share sheet - nothing to show
      } else {
        setError("שגיאה בשיתוף הקובץ");
      }
    } finally {
      setBusyId(null);
    }
  }

  const canShare =
    typeof navigator !== "undefined" && !!navigator.canShare && !!navigator.share;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowList(true)}
        aria-label={`קבצים מצורפים (${attachments.length})`}
        className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
      >
        📎 {attachments.length}
      </button>

      {showList && (
        <Modal onClose={() => setShowList(false)} title="קבצים מצורפים">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 p-2 text-sm dark:border-zinc-700"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.file_name}</p>
                  <p className="text-xs text-zinc-400">{formatSize(a.size_bytes)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleView(a)}
                    disabled={busyId === a.id}
                    className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                  >
                    צפייה
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(a)}
                    disabled={busyId === a.id}
                    className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                  >
                    הורדה
                  </button>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => handleShare(a)}
                      disabled={busyId === a.id}
                      className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                    >
                      שיתוף
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
