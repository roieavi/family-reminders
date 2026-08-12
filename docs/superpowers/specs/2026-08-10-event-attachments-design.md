# Event attachments — design

## Problem

Reminders often come with a document worth keeping alongside them — an MRI referral, a lesson confirmation PDF, a photo of a form. Today there's no way to attach anything to an event; the description field is text-only.

## Scope

- Attach one or more files (images or PDFs) to an event, when creating it or later when editing it.
- View, download, or share an attached file from anywhere an event is shown (list, grid, calendar).
- Any family member can delete any attachment, matching the existing permission model (any member can already edit/delete any event).
- Out of scope for this pass: other file types (Word/Excel/etc.), attachment versioning, per-member permissions finer than the existing family-wide model.

## Data & storage

New table, `event_attachments`:

```sql
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
```

Files live in a **private** Supabase Storage bucket, `event-attachments` — not public, since attachments may be personal medical documents. All reads and writes go through short-lived **signed URLs** generated server-side, never a permanent public link. This matches the existing security posture (RLS enabled with no policies; the anon key, even if it ever leaked, can't read/write directly).

Limits: up to 5 files per event, 15MB per file, MIME type restricted to `image/*` and `application/pdf` (enforced both client-side, as a UX nicety, and server-side, since client-side checks are never trustworthy).

Storage path convention: `{family_id}/{event_id}/{attachment_id}-{sanitized_file_name}` — namespaced by family so there's no cross-family collision risk, and by event so deleting an event's storage objects is a simple prefix operation.

## Upload flow

Direct-to-storage upload, chosen over proxying file bytes through our own API route, because Vercel's serverless functions cap request bodies at ~4.5MB — well under what a phone camera photo often is.

This requires a new **browser-side** Supabase client (`lib/supabaseClient.ts`), using the public anon key — distinct from the existing server-only `lib/supabase.ts` (service role key, never sent to the browser). Two new environment variables are needed: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, set in both `.env.local` and Vercel's project settings.

Flow for each selected file:
1. Client asks our API for permission to upload: `POST /api/events/[id]/attachments/sign` with `{ fileName, contentType, sizeBytes }`, authenticated via the existing member-token header. The server validates the requester belongs to the event's family, validates type/size against the limits above, generates the storage path, and calls Supabase's `createSignedUploadUrl` for that path — returning `{ path, token }`.
2. The client uploads the file bytes directly to Supabase Storage using that signed path/token (via the new browser client's `uploadToSignedUrl`), bypassing our server entirely for the actual bytes.
3. On success, the client calls `POST /api/events/[id]/attachments` with `{ path, fileName, contentType, sizeBytes }` to register the row in `event_attachments`.

If step 2 fails (network error, etc.), no row is ever created — nothing to clean up. If step 3 fails after a successful upload, there's a harmless orphaned storage object with no DB row; acceptable for this scope (no automatic garbage collection planned).

## Viewing, downloading, sharing

- `GET /api/events/[id]/attachments` (or nested into the existing events list query, the same way `event_members`/`reminders` are already nested) returns each attachment's metadata — but never a direct storage URL, since the bucket is private.
- `GET /api/events/[id]/attachments/[attachmentId]/url` returns a short-lived signed URL (a few minutes) for that one file, generated on demand when the user actually wants to view/download/share it — not fetched in bulk up front.
- **View:** images open in an in-app full-screen lightbox; PDFs open in a new browser tab (the browser's own PDF viewer — no custom viewer built).
- **Download:** a plain link to the signed URL with a `download` attribute.
- **Share:** uses `navigator.share` with the fetched file (device's native share sheet — WhatsApp is one of the options a user sees there, not a dedicated integration). Where `navigator.canShare` with files isn't supported (older browsers/desktop), the share button is simply not rendered — download remains available.

## UI placement

- `EventForm` (add/edit): a new "קבצים מצורפים" section, styled like the existing "שיוך"/"תזכורת" sections — a file picker (`accept="image/*,application/pdf"`, `multiple`) plus a list of attached files with a remove button each. Uploads happen immediately on selection (not deferred to form submit), each showing its own progress/error state, consistent with how this keeps the rest of the form's submit simple.
- Event list, grid view, and calendar day popup: a 📎 icon with a count badge when an event has attachments, opening the existing `Modal` component with the file list (view/download/share actions per file).

## Deletion

`DELETE /api/events/[id]/attachments/[attachmentId]` — any family member may call this (matching the existing event-editing permission model). Deletes the storage object first, then the DB row (if storage deletion fails, the row is kept and an error is returned, rather than leaving a DB row pointing at a file that might still exist). Deleting an event cascades the `event_attachments` rows via the FK, but the actual storage objects for that event must also be explicitly deleted in the event-delete route (the DB cascade doesn't touch Storage) — done via a prefix-delete on `{family_id}/{event_id}/`.

## Testing

No automated test framework exists in this repo. Verification is `npx tsc --noEmit` plus manual browser checks: upload multiple files (image + PDF) while creating an event, confirm they appear correctly in list/grid/calendar, view an image (lightbox) and a PDF (new tab), download a file, share a file (on a device where the Web Share API with files is supported), delete an attachment, delete an event with attachments and confirm the storage objects are gone (checked via the Supabase dashboard).
