# Event Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let family members attach one or more files (images or PDFs) to a reminder, then view, download, or share them from anywhere that reminder is shown.

**Architecture:** A new `event_attachments` table plus a private Supabase Storage bucket. Uploads go directly from the browser to Storage via a short-lived signed URL our API generates (never through our own serverless function, to avoid Vercel's ~4.5MB request body cap), then a small API call registers the row. Viewing/downloading similarly goes through a freshly-generated signed URL, never a permanent public link, since some attachments (medical referrals, etc.) are sensitive.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + Storage), TypeScript, Tailwind CSS v4.

**Design doc:** [docs/superpowers/specs/2026-08-10-event-attachments-design.md](../specs/2026-08-10-event-attachments-design.md)

---

## ⚠️ Prerequisite — manual setup only a human can do

**This is not a task for an implementer subagent.** No subagent has access to the project's Supabase dashboard or Vercel project settings. Before Task 1 is dispatched, the human running this plan must:

1. Run the SQL in `supabase/migrations/0002_event_attachments.sql` (written in Task 1) against the project's Supabase database, via the Supabase dashboard's SQL Editor — the same way `0001_init.sql` was presumably run originally (there's no migration-runner script in this repo).
2. In the Supabase dashboard, go to **Project Settings → API**, copy the **Project URL** and the **anon/public key** (NOT the service role key — that one must never reach the browser).
3. Add two new environment variables with those values:
   - Locally, in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=...` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - In the Vercel project's environment variables (Project Settings → Environment Variables), same two keys, for Production (and Preview/Development if used).
4. Restart the local dev server after adding the env vars so Next.js picks them up.

Task 1 below writes the migration file into the repo (so it's version-controlled and reviewable), but does not and cannot run it — that step is on the human, per step 1 above.

---

## File Structure

**Create:**
- `supabase/migrations/0002_event_attachments.sql` — table + storage bucket
- `lib/attachments.ts` — shared constants, the `EventAttachment` type, and validation helpers used by every route/component that touches attachments
- `lib/supabaseClient.ts` — browser-side Supabase client (anon key), used only for direct-to-storage uploads
- `lib/uploadAttachment.ts` — the sign → upload → register orchestration, used by the form
- `app/api/events/[id]/attachments/sign/route.ts` — POST, issues a signed upload URL
- `app/api/events/[id]/attachments/route.ts` — POST, registers a row after a successful upload
- `app/api/events/[id]/attachments/[attachmentId]/route.ts` — DELETE
- `app/api/events/[id]/attachments/[attachmentId]/url/route.ts` — GET, issues a short-lived signed view/download URL
- `app/u/[token]/AttachmentsField.tsx` — the upload UI inside the add/edit event form
- `app/u/[token]/AttachmentsButton.tsx` — the 📎 badge + list (view/download/share) shown wherever an event is displayed
- `app/u/[token]/Lightbox.tsx` — full-screen in-app image viewer

**Modify:**
- `.env.local.example` — document the two new env vars
- `app/api/events/route.ts` — nest attachment metadata into the events list query
- `app/api/events/[id]/route.ts` — delete an event's storage objects when the event itself is deleted
- `app/u/[token]/Dashboard.tsx` — `EventItem` type gains `event_attachments`; `EventForm` gains the attachments field and upload-after-save flow; the list view shows the 📎 badge
- `app/u/[token]/GridView.tsx` — 📎 badge on each card
- `app/u/[token]/CalendarView.tsx` — 📎 badge in the day popup

---

### Task 1: Database, storage bucket, and shared foundation

**Files:**
- Create: `supabase/migrations/0002_event_attachments.sql`
- Create: `lib/attachments.ts`
- Create: `lib/supabaseClient.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0002_event_attachments.sql
create table event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index event_attachments_event_idx on event_attachments (event_id);

-- Same RLS posture as every other table in this app: enabled, no policies.
-- All access goes through server-side API routes using the service role key.
alter table event_attachments enable row level security;

-- Private bucket - never publicly readable. All access goes through
-- short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values ('event-attachments', 'event-attachments', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Write the shared attachments module**

```ts
// lib/attachments.ts
export const ATTACHMENTS_BUCKET = "event-attachments";
export const MAX_ATTACHMENTS_PER_EVENT = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

export interface EventAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export function isAllowedAttachmentType(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export function buildStoragePath(
  familyId: string,
  eventId: string,
  attachmentId: string,
  fileName: string
): string {
  return `${familyId}/${eventId}/${attachmentId}-${sanitizeFileName(fileName)}`;
}
```

- [ ] **Step 3: Write the browser-side Supabase client**

```ts
// lib/supabaseClient.ts
"use client";

import { createClient } from "@supabase/supabase-js";

// Browser-side client using the public anon key. Only used to upload files
// directly to Storage via signed URLs our API generates - never for
// reading/writing tables directly (RLS has no policies, so the anon key
// can't touch the database even if this file is inspected).
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

- [ ] **Step 4: Document the new env vars**

Modify `.env.local.example` — old content:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
CRON_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

New content:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
CRON_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`lib/supabaseClient.ts` reads `process.env.NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` with a non-null assertion — this will only actually throw at runtime if those env vars are missing, not at type-check time. Confirm with the human running this plan that they've completed the Prerequisite section above and restarted their dev server before Task 4 onward, where this file is first actually imported and exercised.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_event_attachments.sql lib/attachments.ts lib/supabaseClient.ts .env.local.example
git commit -m "Add event_attachments table, storage bucket, and shared foundation"
```

---

### Task 2: Upload API routes (sign + register)

**Files:**
- Create: `app/api/events/[id]/attachments/sign/route.ts`
- Create: `app/api/events/[id]/attachments/route.ts`

- [ ] **Step 1: Write the sign route**

```ts
// app/api/events/[id]/attachments/sign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_EVENT,
  buildStoragePath,
  isAllowedAttachmentType,
} from "@/lib/attachments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id: eventId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const body = await req.json();
  const fileName = String(body.fileName ?? "").trim();
  const contentType = String(body.contentType ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }
  if (!isAllowedAttachmentType(contentType)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 15MB)" }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("event_attachments")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_EVENT) {
    return NextResponse.json(
      { error: `ניתן לצרף עד ${MAX_ATTACHMENTS_PER_EVENT} קבצים למועד` },
      { status: 400 }
    );
  }

  const attachmentId = randomUUID();
  const path = buildStoragePath(requester.family_id, eventId, attachmentId, fileName);

  const { data, error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "שגיאה ביצירת קישור העלאה" },
      { status: 500 }
    );
  }

  return NextResponse.json({ path, token: data.token });
}
```

- [ ] **Step 2: Write the register route**

```ts
// app/api/events/[id]/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { isAllowedAttachmentType, MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/attachments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id: eventId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const body = await req.json();
  const path = String(body.path ?? "");
  const fileName = String(body.fileName ?? "").trim();
  const contentType = String(body.contentType ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (
    !path ||
    !fileName ||
    !isAllowedAttachmentType(contentType) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_ATTACHMENT_SIZE_BYTES
  ) {
    return NextResponse.json({ error: "פרטי קובץ לא תקינים" }, { status: 400 });
  }

  const { data: attachment, error } = await supabaseAdmin
    .from("event_attachments")
    .insert({
      event_id: eventId,
      storage_path: path,
      file_name: fileName,
      content_type: contentType,
      size_bytes: sizeBytes,
      uploaded_by: requester.id,
    })
    .select()
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: error?.message ?? "שגיאה בשמירת הקובץ" }, { status: 500 });
  }

  return NextResponse.json({ attachment });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/events/[id]/attachments/sign/route.ts" "app/api/events/[id]/attachments/route.ts"
git commit -m "Add attachment upload sign and register API routes"
```

---

### Task 3: Delete + signed-URL routes, wire into existing event routes

**Files:**
- Create: `app/api/events/[id]/attachments/[attachmentId]/route.ts`
- Create: `app/api/events/[id]/attachments/[attachmentId]/url/route.ts`
- Modify: `app/api/events/route.ts`
- Modify: `app/api/events/[id]/route.ts`

- [ ] **Step 1: Write the delete route**

```ts
// app/api/events/[id]/attachments/[attachmentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id: eventId, attachmentId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const { data: attachment } = await supabaseAdmin
    .from("event_attachments")
    .select("id, storage_path")
    .eq("id", attachmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "קובץ לא נמצא" }, { status: 404 });
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from("event_attachments").delete().eq("id", attachmentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the signed view/download URL route**

```ts
// app/api/events/[id]/attachments/[attachmentId]/url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id: eventId, attachmentId } = await params;

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "מועד לא נמצא" }, { status: 404 });
  }

  const { data: attachment } = await supabaseAdmin
    .from("event_attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "קובץ לא נמצא" }, { status: 404 });
  }

  const forceDownload = new URL(req.url).searchParams.get("download") === "1";

  const { data, error } = await supabaseAdmin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(
      attachment.storage_path,
      300,
      forceDownload ? { download: attachment.file_name } : undefined
    );

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "שגיאה ביצירת קישור" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
```

- [ ] **Step 3: Nest attachment metadata into the events list query**

Modify `app/api/events/route.ts` — old:

```ts
  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, event_at, applies_to_all, created_by, event_members(member_id), reminders(id, remind_at, sent)"
    )
    .eq("family_id", requester.family_id)
    .gte("event_at", new Date().toISOString())
    .order("event_at");
```

New:

```ts
  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, event_at, applies_to_all, created_by, event_members(member_id), reminders(id, remind_at, sent), event_attachments(id, file_name, content_type, size_bytes)"
    )
    .eq("family_id", requester.family_id)
    .gte("event_at", new Date().toISOString())
    .order("event_at");
```

- [ ] **Step 4: Delete an event's storage objects when the event is deleted**

Modify `app/api/events/[id]/route.ts` — old import block:

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseEventInput, setEventRelations } from "@/lib/events";
```

New:

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseEventInput, setEventRelations } from "@/lib/events";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";
```

Old `DELETE` function (same file):

```ts
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", id)
    .eq("family_id", requester.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

New:

```ts
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const { data: attachments } = await supabaseAdmin
    .from("event_attachments")
    .select("storage_path")
    .eq("event_id", id);

  if (attachments && attachments.length > 0) {
    await supabaseAdmin.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((a) => a.storage_path));
  }

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", id)
    .eq("family_id", requester.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/events/[id]/attachments/[attachmentId]/route.ts" "app/api/events/[id]/attachments/[attachmentId]/url/route.ts" app/api/events/route.ts "app/api/events/[id]/route.ts"
git commit -m "Add attachment delete and signed-URL routes; clean up storage on event delete"
```

---

### Task 4: Upload orchestration helper + AttachmentsField component

**Files:**
- Create: `lib/uploadAttachment.ts`
- Create: `app/u/[token]/AttachmentsField.tsx`

- [ ] **Step 1: Write the upload helper**

```ts
// lib/uploadAttachment.ts
import { supabaseBrowser } from "./supabaseClient";
import { ATTACHMENTS_BUCKET } from "./attachments";

export async function uploadAttachment(
  token: string,
  eventId: string,
  file: File
): Promise<{ error?: string }> {
  const headers = { "Content-Type": "application/json", "x-member-token": token };

  const signRes = await fetch(`/api/events/${eventId}/attachments/sign`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  const signData = await signRes.json();
  if (!signRes.ok) return { error: signData.error ?? "שגיאה בהעלאה" };

  const { error: uploadError } = await supabaseBrowser.storage
    .from(ATTACHMENTS_BUCKET)
    .uploadToSignedUrl(signData.path, signData.token, file);
  if (uploadError) return { error: uploadError.message };

  const registerRes = await fetch(`/api/events/${eventId}/attachments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      path: signData.path,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  const registerData = await registerRes.json();
  if (!registerRes.ok) return { error: registerData.error ?? "שגיאה בשמירת הקובץ" };

  return {};
}
```

- [ ] **Step 2: Write AttachmentsField**

```tsx
// app/u/[token]/AttachmentsField.tsx
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
```

Note on `eventId: string | null`: when adding a brand-new event, there's no event id yet (the event doesn't exist until the form is submitted), so newly-picked files can only be queued as `pendingFiles` — they're uploaded by the caller (`EventForm`, wired in Task 5) right after the event is created. Removing an *existing* (already-uploaded) attachment always calls the delete API immediately, matching how deleting an event itself works elsewhere in this app (immediate, with a confirm dialog) — only never-yet-uploaded `pendingFiles` are just removed from local state with no network call.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Not wired into any page yet — nothing to browser-test until Task 5.)

- [ ] **Step 4: Commit**

```bash
git add lib/uploadAttachment.ts "app/u/[token]/AttachmentsField.tsx"
git commit -m "Add upload helper and AttachmentsField component"
```

---

### Task 5: Wire AttachmentsField into EventForm

**Files:**
- Modify: `app/u/[token]/Dashboard.tsx`

- [ ] **Step 1: Add the EventAttachment import and update EventItem**

Old:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { REMINDER_PRESETS } from "@/lib/reminders";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import { toIsraelDateTimeParts, timeOfDayGreeting } from "@/lib/israelTime";
import { formatCountdown } from "@/lib/countdown";
import { colorForMember } from "@/lib/memberColors";
import SearchBar from "./SearchBar";
import PushSubscribeButton from "./PushSubscribeButton";
import CalendarView from "./CalendarView";
import Modal from "./Modal";
import GridView from "./GridView";
import Avatar from "./Avatar";
import CountdownBadge from "./CountdownBadge";
import ToggleSwitch from "./ToggleSwitch";
import SideMenu from "./SideMenu";

export { toIsraelDateTimeParts };

export interface MemberSummary {
  id: string;
  name: string;
  email: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_at: string;
  applies_to_all: boolean;
  created_by: string;
  event_members: { member_id: string }[];
  reminders: { id: string; remind_at: string; sent: boolean }[];
}
```

New:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { REMINDER_PRESETS } from "@/lib/reminders";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import { toIsraelDateTimeParts, timeOfDayGreeting } from "@/lib/israelTime";
import { formatCountdown } from "@/lib/countdown";
import { colorForMember } from "@/lib/memberColors";
import { type EventAttachment } from "@/lib/attachments";
import { uploadAttachment } from "@/lib/uploadAttachment";
import SearchBar from "./SearchBar";
import PushSubscribeButton from "./PushSubscribeButton";
import CalendarView from "./CalendarView";
import Modal from "./Modal";
import GridView from "./GridView";
import Avatar from "./Avatar";
import CountdownBadge from "./CountdownBadge";
import ToggleSwitch from "./ToggleSwitch";
import SideMenu from "./SideMenu";
import AttachmentsField from "./AttachmentsField";

export { toIsraelDateTimeParts };

export interface MemberSummary {
  id: string;
  name: string;
  email: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_at: string;
  applies_to_all: boolean;
  created_by: string;
  event_members: { member_id: string }[];
  reminders: { id: string; remind_at: string; sent: boolean }[];
  event_attachments: EventAttachment[];
}
```

- [ ] **Step 2: Add token extraction and attachment state to EventForm**

Old:

```tsx
export function EventForm({
  headers,
  members,
  event,
  initialDate,
  onDone,
  onCancel,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  event?: EventItem;
  initialDate?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialDateTime = event ? toIsraelDateTimeParts(event.event_at) : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(initialDateTime?.date ?? initialDate ?? "");
  const [eventTime, setEventTime] = useState(initialDateTime?.time ?? "");
  const [appliesToAll, setAppliesToAll] = useState(event?.applies_to_all ?? true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    event ? event.event_members.map((em) => em.member_id) : []
  );
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    event ? event.reminders.map((r) => diffMinutes(event.event_at, r.remind_at)) : [60 * 24]
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    event ? event.reminders.length > 0 : false
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
```

New:

```tsx
export function EventForm({
  headers,
  members,
  event,
  initialDate,
  onDone,
  onCancel,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  event?: EventItem;
  initialDate?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const token = headers["x-member-token"] ?? "";
  const initialDateTime = event ? toIsraelDateTimeParts(event.event_at) : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(initialDateTime?.date ?? initialDate ?? "");
  const [eventTime, setEventTime] = useState(initialDateTime?.time ?? "");
  const [appliesToAll, setAppliesToAll] = useState(event?.applies_to_all ?? true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    event ? event.event_members.map((em) => em.member_id) : []
  );
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    event ? event.reminders.map((r) => diffMinutes(event.event_at, r.remind_at)) : [60 * 24]
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    event ? event.reminders.length > 0 : false
  );
  const [existingAttachments, setExistingAttachments] = useState<EventAttachment[]>(
    event?.event_attachments ?? []
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
```

- [ ] **Step 3: Upload pending files after the event is saved**

Old:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(event ? `/api/events/${event.id}` : "/api/events", {
        method: event ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          title,
          description,
          event_at: new Date(`${eventDate}T${eventTime}`).toISOString(),
          applies_to_all: appliesToAll,
          member_ids: selectedMembers,
          reminder_minutes: remindersEnabled ? selectedReminders : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה");
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }
```

New:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(event ? `/api/events/${event.id}` : "/api/events", {
        method: event ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          title,
          description,
          event_at: new Date(`${eventDate}T${eventTime}`).toISOString(),
          applies_to_all: appliesToAll,
          member_ids: selectedMembers,
          reminder_minutes: remindersEnabled ? selectedReminders : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה");
        return;
      }

      const savedEventId = event ? event.id : data.event.id;
      for (const file of pendingFiles) {
        const result = await uploadAttachment(token, savedEventId, file);
        if (result.error) {
          setError(`המועד נשמר, אבל העלאת "${file.name}" נכשלה: ${result.error}`);
          return;
        }
      }

      onDone();
    } finally {
      setSubmitting(false);
    }
  }
```

- [ ] **Step 4: Render AttachmentsField in the form**

Old:

```tsx
      <div>
        <p className={`mb-1 ${fieldLabel}`}>תזכורת</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">תזכורת</span>
            <ToggleSwitch checked={remindersEnabled} onChange={setRemindersEnabled} />
          </div>
          {remindersEnabled &&
            REMINDER_PRESETS.map((p) => (
              <div
                key={p.minutes}
                className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700"
              >
                <span className="text-sm">{p.label}</span>
                <ToggleSwitch
                  checked={selectedReminders.includes(p.minutes)}
                  onChange={() => toggleReminder(p.minutes)}
                />
              </div>
            ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
```

New:

```tsx
      <div>
        <p className={`mb-1 ${fieldLabel}`}>תזכורת</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">תזכורת</span>
            <ToggleSwitch checked={remindersEnabled} onChange={setRemindersEnabled} />
          </div>
          {remindersEnabled &&
            REMINDER_PRESETS.map((p) => (
              <div
                key={p.minutes}
                className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700"
              >
                <span className="text-sm">{p.label}</span>
                <ToggleSwitch
                  checked={selectedReminders.includes(p.minutes)}
                  onChange={() => toggleReminder(p.minutes)}
                />
              </div>
            ))}
        </div>
      </div>

      <AttachmentsField
        token={token}
        eventId={event?.id ?? null}
        existing={existingAttachments}
        onExistingChange={setExistingAttachments}
        pendingFiles={pendingFiles}
        onPendingFilesChange={setPendingFiles}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`GridView.tsx` and `CalendarView.tsx` both destructure `EventItem` from `Dashboard.tsx` — adding a required `event_attachments` field to that interface doesn't break them since they only read fields, they don't construct `EventItem` values themselves; the actual data comes from the API, which Task 3 already updated to include it.)

- [ ] **Step 6: Manual verification**

This requires the Prerequisite section's env vars to be set and the dev server restarted. Open the dashboard, click "+ הוסף מועד", fill in the required fields, click "+ הוספת קובץ" and pick an image and a PDF, confirm both appear in the pending list with a "הסר" button each, submit the form. Confirm no error appears and the modal closes. Re-open that event for editing and confirm both files now appear as "existing" attachments (this proves the upload-after-create flow and the nested `event_attachments` data both work end to end).

- [ ] **Step 7: Commit**

```bash
git add "app/u/[token]/Dashboard.tsx"
git commit -m "Wire attachment upload into the add/edit event form"
```

---

### Task 6: Lightbox and AttachmentsButton components

**Files:**
- Create: `app/u/[token]/Lightbox.tsx`
- Create: `app/u/[token]/AttachmentsButton.tsx`

- [ ] **Step 1: Write Lightbox**

```tsx
// app/u/[token]/Lightbox.tsx
"use client";

import { createPortal } from "react-dom";

export default function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="סגור"
        className="absolute top-4 left-4 text-3xl leading-none text-white"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}
```

Uses `createPortal` to `document.body` for the same reason `Modal.tsx` does (see `app/u/[token]/Modal.tsx`): this app's pages are wrapped in `SideMenu`, which always applies a CSS `translate` to its content wrapper, and any non-`none` `translate`/`transform` on an ancestor changes the containing block for `position: fixed` descendants — breaking full-viewport overlays that aren't portaled out of that subtree.

- [ ] **Step 2: Write AttachmentsButton**

```tsx
// app/u/[token]/AttachmentsButton.tsx
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

  if (attachments.length === 0) return null;

  async function handleView(a: EventAttachment) {
    setBusyId(a.id);
    try {
      const url = await fetchSignedUrl(token, eventId, a.id, false);
      if (!url) return;
      if (a.content_type.startsWith("image/")) {
        setLightbox({ src: url, alt: a.file_name });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(a: EventAttachment) {
    setBusyId(a.id);
    try {
      const url = await fetchSignedUrl(token, eventId, a.id, true);
      if (!url) return;
      const link = document.createElement("a");
      link.href = url;
      link.download = a.file_name;
      link.click();
    } finally {
      setBusyId(null);
    }
  }

  async function handleShare(a: EventAttachment) {
    setBusyId(a.id);
    try {
      const url = await fetchSignedUrl(token, eventId, a.id, false);
      if (!url) return;
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], a.file_name, { type: a.content_type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: a.file_name });
      }
    } catch {
      // user cancelled the native share sheet, or sharing failed - nothing to show
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
        className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
      >
        📎 {attachments.length}
      </button>

      {showList && (
        <Modal onClose={() => setShowList(false)} title="קבצים מצורפים">
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Not wired into any page yet — nothing to browser-test until Task 7.)

- [ ] **Step 4: Commit**

```bash
git add "app/u/[token]/Lightbox.tsx" "app/u/[token]/AttachmentsButton.tsx"
git commit -m "Add Lightbox and AttachmentsButton components"
```

---

### Task 7: Show the attachments badge everywhere an event appears

**Files:**
- Modify: `app/u/[token]/Dashboard.tsx`
- Modify: `app/u/[token]/GridView.tsx`
- Modify: `app/u/[token]/CalendarView.tsx`

- [ ] **Step 1: Dashboard list view**

Modify `app/u/[token]/Dashboard.tsx` — old:

```tsx
import AttachmentsField from "./AttachmentsField";
```

New:

```tsx
import AttachmentsField from "./AttachmentsField";
import AttachmentsButton from "./AttachmentsButton";
```

Old (the event list item body):

```tsx
                      {event.reminders.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-400">
                          תזכורות:{" "}
                          {event.reminders
                            .map((r) => reminderLabel(event.event_at, r.remind_at))
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <CountdownBadge countdown={countdown} size="sm" />
```

New:

```tsx
                      {event.reminders.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-400">
                          תזכורות:{" "}
                          {event.reminders
                            .map((r) => reminderLabel(event.event_at, r.remind_at))
                            .join(", ")}
                        </p>
                      )}
                      <div className="mt-1">
                        <AttachmentsButton
                          token={token}
                          eventId={event.id}
                          attachments={event.event_attachments}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <CountdownBadge countdown={countdown} size="sm" />
```

(`AttachmentsButton` returns `null` when an event has no attachments, so this is safe to always render — no extra conditional needed here.)

- [ ] **Step 2: Grid view**

Modify `app/u/[token]/GridView.tsx` — old:

```tsx
import Modal from "./Modal";
import Avatar from "./Avatar";
import CountdownBadge from "./CountdownBadge";
import { colorForMember } from "@/lib/memberColors";
import { formatCountdown } from "@/lib/countdown";
import { EventForm, type EventItem, type MemberSummary } from "./Dashboard";
```

New:

```tsx
import Modal from "./Modal";
import Avatar from "./Avatar";
import CountdownBadge from "./CountdownBadge";
import AttachmentsButton from "./AttachmentsButton";
import { colorForMember } from "@/lib/memberColors";
import { formatCountdown } from "@/lib/countdown";
import { EventForm, type EventItem, type MemberSummary } from "./Dashboard";
```

Old:

```tsx
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingEvent = events.find((e) => e.id === editingId) ?? null;
```

New:

```tsx
}) {
  const token = headers["x-member-token"] ?? "";
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingEvent = events.find((e) => e.id === editingId) ?? null;
```

Old (inside the card, between the date and the avatars):

```tsx
            <p className="line-clamp-2 text-sm font-semibold text-zinc-900">{event.title}</p>
            <p className="text-xs text-zinc-600">
              {new Date(event.event_at).toLocaleString("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Jerusalem",
              })}
            </p>
            <div className="mt-1 flex -space-x-2">
```

New:

```tsx
            <p className="line-clamp-2 text-sm font-semibold text-zinc-900">{event.title}</p>
            <p className="text-xs text-zinc-600">
              {new Date(event.event_at).toLocaleString("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Jerusalem",
              })}
            </p>
            {event.event_attachments.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <AttachmentsButton
                  token={token}
                  eventId={event.id}
                  attachments={event.event_attachments}
                />
              </div>
            )}
            <div className="mt-1 flex -space-x-2">
```

(Unlike Dashboard's list, this card has an `onClick` on the whole card that opens the edit modal — the wrapping `<div onClick={(e) => e.stopPropagation()}>` stops a tap on the badge from also opening edit mode, the same trick already used by this card's delete button. The explicit `event.event_attachments.length > 0` guard here (rather than relying on `AttachmentsButton`'s own empty-return) avoids rendering an unnecessary empty click-trapping wrapper on every card that has no attachments.)

- [ ] **Step 3: Calendar day popup**

Modify `app/u/[token]/CalendarView.tsx` — old:

```tsx
import { useState } from "react";
import Modal from "./Modal";
import {
  EventForm,
  reminderLabel,
  toIsraelDateTimeParts,
  type EventItem,
  type MemberSummary,
} from "./Dashboard";
```

New:

```tsx
import { useState } from "react";
import Modal from "./Modal";
import AttachmentsButton from "./AttachmentsButton";
import {
  EventForm,
  reminderLabel,
  toIsraelDateTimeParts,
  type EventItem,
  type MemberSummary,
} from "./Dashboard";
```

Old:

```tsx
}) {
  const todayKey = toIsraelDateTimeParts(new Date().toISOString()).date;
```

New:

```tsx
}) {
  const token = headers["x-member-token"] ?? "";
  const todayKey = toIsraelDateTimeParts(new Date().toISOString()).date;
```

Old (inside the day popup, after the reminders line):

```tsx
                {event.reminders.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">
                    תזכורות:{" "}
                    {event.reminders
                      .map((r) => reminderLabel(event.event_at, r.remind_at))
                      .join(", ")}
                  </p>
                )}
              </div>
            ))}
```

New:

```tsx
                {event.reminders.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">
                    תזכורות:{" "}
                    {event.reminders
                      .map((r) => reminderLabel(event.event_at, r.remind_at))
                      .join(", ")}
                  </p>
                )}
                {event.event_attachments.length > 0 && (
                  <div className="mt-1">
                    <AttachmentsButton
                      token={token}
                      eventId={event.id}
                      attachments={event.event_attachments}
                    />
                  </div>
                )}
              </div>
            ))}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

For an event that already has attachments (from Task 5's verification): confirm the 📎 badge with the correct count appears in (a) the dashboard list view, (b) grid view (tapping it must NOT open the edit modal), (c) calendar view's day popup for that event's date. Tap the badge in each place, confirm the file list modal opens with "צפייה"/"הורדה" (and "שיתוף" if the browser supports it) per file. Click "צפייה" on the image — confirm it opens full-screen in the app (not a new tab). Click "צפייה" on the PDF — confirm it opens in a new browser tab. Click "הורדה" on either — confirm the file downloads. If on a device/browser that supports the Web Share API with files, click "שיתוף" and confirm the native share sheet opens with the file attached.

- [ ] **Step 6: Commit**

```bash
git add "app/u/[token]/Dashboard.tsx" "app/u/[token]/GridView.tsx" "app/u/[token]/CalendarView.tsx"
git commit -m "Show attachments badge in list, grid, and calendar views"
```

---

### Task 8: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: End-to-end upload + view + download + share**

Create a brand-new event, attach one image and one PDF during creation (not editing), save, and confirm both appear correctly everywhere per Task 7's checks.

- [ ] **Step 2: Limits**

Try attaching a 6th file to an event that already has 5 — confirm the client-side error appears before any upload is attempted. Try a file over 15MB — confirm the size error appears immediately, no upload attempted. Try a disallowed file type (if easily testable, e.g. a `.txt` file) — the native file picker's `accept` filter should prevent selecting it in the first place; if it's still selectable (some OS file pickers allow overriding the filter), confirm the server-side `sign` route rejects it with "סוג קובץ לא נתמך".

- [ ] **Step 3: Deletion**

Delete one attachment from an existing event via the edit form — confirm it disappears from the form immediately and from the 📎 badge count everywhere else after refresh. Delete an entire event that has attachments — confirm (via the Supabase Storage dashboard, or by trying to fetch the old signed URL again) that the storage objects are actually gone, not just the DB rows.

- [ ] **Step 4: Dark mode**

With dark mode on, confirm the attachments section in the form, the 📎 badge, the file-list modal, and the Lightbox all render legibly.

- [ ] **Step 5: No further commit needed** — this task is verification-only. If any check fails, fix it in the relevant task's file, re-run `npx tsc --noEmit`, and re-check this list before considering the feature done.
