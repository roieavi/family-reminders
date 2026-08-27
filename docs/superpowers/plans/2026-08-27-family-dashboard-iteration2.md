# Family Dashboard Iteration 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate "who an event belongs to" from "who gets reminded about it", add an optional time-of-day to chores, and redesign both kiosk-dashboard columns (events as a single time-sorted list tinted by owner, chores as a card grid with full names, times, and per-member checkboxes).

**Architecture:** Two new nullable columns (`events.owner_member_id`, `chores.scheduled_time`) added via migration. `event_members`/`applies_to_all` are untouched and keep meaning exactly what they mean today — who gets push/email reminders (confirmed against `app/api/cron/reminders/route.ts`). The new `owner_member_id` is a separate, single-value field purely for kiosk display/grouping, with `null` meaning "everyone" (rendered as a neutral card, no name chip).

**Tech Stack:** Same as the rest of the app — Next.js 16 App Router, Supabase, Tailwind v4, no test framework (`npx tsc --noEmit` + manual browser verification).

**Working directly on `main`** (no worktree this time, per explicit instruction) — commit frequently, keep `main` buildable after each task.

---

### Task 1: Database migration + shared lib updates

**Files:**
- Create: `supabase/migrations/0004_event_owner_and_chore_time.sql`
- Modify: `lib/types.ts`
- Modify: `lib/memberColors.ts`
- Modify: `lib/events.ts`
- Modify: `lib/chores.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Event "ownership" (who the event is about, for kiosk display) is a
-- separate concept from event_members/applies_to_all (who gets reminded) —
-- confirmed those two are still exactly what powers app/api/cron/reminders.
alter table events add column owner_member_id uuid references members(id) on delete set null;

-- Optional time-of-day a chore should be done, shown on the kiosk dashboard.
alter table chores add column scheduled_time time;
```

- [ ] **Step 2: Update `lib/types.ts`**

In the existing `EventRow` interface, add a field after `applies_to_all`:

```ts
export interface EventRow {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  event_at: string;
  created_by: string;
  applies_to_all: boolean;
  owner_member_id: string | null;
  created_at: string;
}
```

In the existing `ChoreRow` interface, add a field after `once_date`:

```ts
export interface ChoreRow {
  id: string;
  family_id: string;
  title: string;
  recurrence: "daily" | "once";
  once_date: string | null;
  scheduled_time: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
}
```

- [ ] **Step 3: Add a `border` class to each member color**

`lib/memberColors.ts` currently defines `bg`/`light`/`text`/`ring` per color as literal Tailwind class strings (with a comment explaining why they must stay literal — Tailwind's static scanner needs to see the exact class name in source, not a runtime-computed one). Add a matching literal `border` class to each entry, used for the kiosk's event-card accent border:

```ts
export const MEMBER_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-300", border: "border-blue-500" },
  { bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-300", border: "border-violet-500" },
  { bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-700", ring: "ring-cyan-300", border: "border-cyan-500" },
  { bg: "bg-indigo-500", light: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-300", border: "border-indigo-500" },
  { bg: "bg-sky-500", light: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-300", border: "border-sky-500" },
  { bg: "bg-teal-500", light: "bg-teal-100", text: "text-teal-700", ring: "ring-teal-300", border: "border-teal-500" },
] as const;
```

- [ ] **Step 4: Update `lib/events.ts`**

Add `ownerMemberId` to the `EventInput` interface and parse it in `parseEventInput` (it's optional — `null` means "everyone"):

```ts
export interface EventInput {
  title: string;
  description: string | null;
  eventAt: string;
  appliesToAll: boolean;
  memberIds: string[];
  reminderMinutes: number[];
  ownerMemberId: string | null;
}

export function parseEventInput(body: unknown): EventInput | { error: string } {
  const b = body as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  const description = b.description ? String(b.description).trim() : null;
  const eventAt = typeof b.event_at === "string" ? b.event_at : "";
  const appliesToAll = Boolean(b.applies_to_all);
  const memberIds: string[] = Array.isArray(b.member_ids) ? (b.member_ids as string[]) : [];
  const reminderMinutes: number[] = Array.isArray(b.reminder_minutes)
    ? (b.reminder_minutes as number[])
    : [];
  const ownerMemberId =
    typeof b.owner_member_id === "string" && b.owner_member_id ? b.owner_member_id : null;

  if (!title || !eventAt) {
    return { error: "נדרשים כותרת ותאריך" };
  }
  if (!appliesToAll && memberIds.length === 0) {
    return { error: "יש לבחור למי המועד רלוונטי, או לסמן 'כולם'" };
  }

  return { title, description, eventAt, appliesToAll, memberIds, reminderMinutes, ownerMemberId };
}
```

(`setEventRelations` is unchanged — `owner_member_id` is a plain column on `events`, not a relation table.)

- [ ] **Step 5: Update `lib/chores.ts`**

Add `scheduledTime` to `ChoreInput` and parse it in `parseChoreInput` (optional):

```ts
export interface ChoreInput {
  title: string;
  recurrence: "daily" | "once";
  onceDate: string | null;
  scheduledTime: string | null;
  memberIds: string[];
}

export function parseChoreInput(body: unknown): ChoreInput | { error: string } {
  const b = body as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  const recurrence =
    b.recurrence === "once" ? "once" : b.recurrence === "daily" ? "daily" : null;
  const onceDate = typeof b.once_date === "string" && b.once_date ? b.once_date : null;
  const scheduledTime =
    typeof b.scheduled_time === "string" && b.scheduled_time ? b.scheduled_time : null;
  const memberIds: string[] = Array.isArray(b.member_ids) ? (b.member_ids as string[]) : [];

  if (!title) {
    return { error: "נדרשת כותרת" };
  }
  if (!recurrence) {
    return { error: "נדרש סוג חזרתיות" };
  }
  if (recurrence === "once" && !onceDate) {
    return { error: "משימה חד-פעמית דורשת תאריך" };
  }
  if (memberIds.length === 0) {
    return { error: "יש לבחור לפחות בן משפחה אחד" };
  }

  return { title, recurrence, onceDate, scheduledTime, memberIds };
}
```

(`setChoreMembers` is unchanged.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in the API route files that construct `EventInput`/`ChoreInput`-shaped inserts without the new required fields — that's expected and fixed in Tasks 2-3. If `lib/*.ts` themselves have no errors, this step is fine to pass with those downstream errors still present.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0004_event_owner_and_chore_time.sql lib/types.ts lib/memberColors.ts lib/events.ts lib/chores.ts
git commit -m "Add events.owner_member_id and chores.scheduled_time columns"
```

- [ ] **Step 8: Apply the migration**

Run the SQL from Step 1 against the project's Supabase instance (SQL editor, same as migration 0003). Additive only — no risk to existing data.

---

### Task 2: API routes — persist and return the two new fields

**Files:**
- Modify: `app/api/events/route.ts`
- Modify: `app/api/events/[id]/route.ts`
- Modify: `app/api/chores/route.ts`
- Modify: `app/api/chores/[id]/route.ts`
- Modify: `app/api/dashboard/[dashboardToken]/route.ts`

- [ ] **Step 1: `app/api/events/route.ts`**

In `GET`, add `owner_member_id` to the `.select(...)` string (so `Dashboard.tsx` can prefill the edit form):

```ts
  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, event_at, applies_to_all, created_by, owner_member_id, event_members(member_id), reminders(id, remind_at, sent), event_attachments(id, file_name, content_type, size_bytes)"
    )
```

In `POST`, add `owner_member_id: input.ownerMemberId` to the `.insert({...})` object.

- [ ] **Step 2: `app/api/events/[id]/route.ts`**

In `PATCH`, add `owner_member_id: input.ownerMemberId` to the `.update({...})` object.

- [ ] **Step 3: `app/api/chores/route.ts`**

In `GET`, add `scheduled_time` to the `.select(...)` string:

```ts
  const { data: chores, error } = await supabaseAdmin
    .from("chores")
    .select("id, title, recurrence, once_date, scheduled_time, active, chore_members(member_id)")
```

In `POST`, add `scheduled_time: input.scheduledTime` to the `.insert({...})` object.

- [ ] **Step 4: `app/api/chores/[id]/route.ts`**

In `PATCH`, add `scheduled_time: input.scheduledTime` to the `.update({...})` object.

- [ ] **Step 5: `app/api/dashboard/[dashboardToken]/route.ts`**

In the `events` query's `.select(...)`, add `owner_member_id`:

```ts
    supabaseAdmin
      .from("events")
      .select("id, title, event_at, applies_to_all, owner_member_id, event_members(member_id)")
      .eq("family_id", family.id)
      .order("event_at"),
```

In the `chores` query's `.select(...)`, add `scheduled_time`:

```ts
    supabaseAdmin
      .from("chores")
      .select("id, title, recurrence, once_date, scheduled_time, chore_members(member_id)")
      .eq("family_id", family.id)
      .eq("active", true),
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors now (Task 1's downstream errors are resolved).

- [ ] **Step 7: Commit**

```bash
git add app/api/events/route.ts "app/api/events/[id]/route.ts" app/api/chores/route.ts "app/api/chores/[id]/route.ts" "app/api/dashboard/[dashboardToken]/route.ts"
git commit -m "Persist and return owner_member_id and scheduled_time in APIs"
```

---

### Task 3: Event form — add the "who this event belongs to" selector

**Files:**
- Modify: `app/u/[token]/Dashboard.tsx`

This is a **new, separate** single-select control in `EventForm`, distinct from the existing "שיוך" section (which stays exactly as-is — it still controls `event_members`/`applies_to_all`, i.e. who gets reminded).

- [ ] **Step 1: Add state**

In `EventForm` (`Dashboard.tsx`), right after the existing `selectedReminders`/`remindersEnabled` state declarations, add:

```ts
  const [ownerMemberId, setOwnerMemberId] = useState<string | null>(
    event?.owner_member_id ?? null
  );
```

- [ ] **Step 2: Add the field to both submit payloads**

In `handleSubmit`, both the PATCH body and the POST body currently look like:

```ts
          body: JSON.stringify({
            title,
            description,
            event_at: new Date(`${eventDate}T${eventTime}`).toISOString(),
            applies_to_all: appliesToAll,
            member_ids: selectedMembers,
            reminder_minutes: remindersEnabled ? selectedReminders : [],
          }),
```

Add `owner_member_id: ownerMemberId,` as the last field in both of these JSON bodies.

- [ ] **Step 3: Add the UI section**

Insert this new section right after the existing "שיוך" `<div>` block (which ends right before the "תזכורת" `<div>` block) in the form JSX:

```tsx
      <div>
        <p className={`mb-1 ${fieldLabel}`}>משויך ל</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setOwnerMemberId(null)}
            className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition ${
              ownerMemberId === null
                ? "bg-indigo-50 font-semibold text-indigo-600 dark:bg-indigo-950"
                : ""
            }`}
          >
            <span>כולם</span>
            {ownerMemberId === null && <span aria-hidden="true">✓</span>}
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setOwnerMemberId(m.id)}
              className={`flex w-full items-center justify-between border-t border-zinc-100 px-3 py-2.5 text-sm transition dark:border-zinc-700 ${
                ownerMemberId === m.id
                  ? "bg-indigo-50 font-semibold text-indigo-600 dark:bg-indigo-950"
                  : ""
              }`}
            >
              <span>{m.name}</span>
              {ownerMemberId === m.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 4: Update `EventItem` interface**

Near the top of `Dashboard.tsx`, `EventItem` needs `owner_member_id: string | null;` added (so `event?.owner_member_id` in Step 1 typechecks):

```ts
export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_at: string;
  applies_to_all: boolean;
  owner_member_id: string | null;
  created_by: string;
  event_members: { member_id: string }[];
  reminders: { id: string; remind_at: string; sent: boolean }[];
  event_attachments: EventAttachment[];
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/u/[token]/Dashboard.tsx
git commit -m "Add event-owner selector to the event form, separate from reminder targeting"
```

---

### Task 4: Chore form — add optional scheduled time

**Files:**
- Modify: `app/u/[token]/chores/ChoresManagement.tsx`

- [ ] **Step 1: Add state**

In `ChoreForm`, right after the `onceDate` state declaration, add:

```ts
  const [scheduledTime, setScheduledTime] = useState(chore?.scheduled_time?.slice(0, 5) ?? "");
```

(`.slice(0, 5)` trims a Postgres `"HH:MM:SS"` value down to the `"HH:MM"` an `<input type="time">` expects.)

- [ ] **Step 2: Add it to the submit payload**

In `handleSubmit`, the `body` currently looks like:

```ts
      const body = JSON.stringify({
        title,
        recurrence,
        once_date: recurrence === "once" ? onceDate : null,
        member_ids: selectedMembers,
      });
```

Add `scheduled_time: scheduledTime || null,` as a new field.

- [ ] **Step 3: Add the input to the form**

Add a new field right after the "כותרת" `<label>` block and before the "חזרתיות" `<div>` block:

```tsx
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>שעת ביצוע (אופציונלי)</span>
        <input
          type="time"
          className={fieldInput}
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
        />
      </label>
```

- [ ] **Step 4: Update `ChoreItem` interface**

Add `scheduled_time: string | null;` to `ChoreItem`:

```ts
interface ChoreItem {
  id: string;
  title: string;
  recurrence: "daily" | "once";
  once_date: string | null;
  scheduled_time: string | null;
  chore_members: { member_id: string }[];
  completed_member_ids: string[];
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/u/[token]/chores/ChoresManagement.tsx"
git commit -m "Add optional scheduled time to the chore form"
```

---

### Task 5: Kiosk dashboard redesign

**Files:**
- Modify: `app/d/[dashboardToken]/DashboardScreen.tsx`

- [ ] **Step 1: Update the `DashboardEvent` and `DashboardChore` interfaces**

```ts
interface DashboardEvent {
  id: string;
  title: string;
  event_at: string;
  applies_to_all: boolean;
  owner_member_id: string | null;
  event_members: { member_id: string }[];
}

interface DashboardChore {
  id: string;
  title: string;
  scheduled_time: string | null;
  chore_members: { member_id: string }[];
  completed_member_ids: string[];
}
```

- [ ] **Step 2: Replace the events section**

Replace the entire first `<section>` (currently headed "לו״ז היום") with:

```tsx
        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">אירועים להיום</h2>
          {data.events.length === 0 ? (
            <p className="text-zinc-400">אין אירועים היום</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.events.map((event) => {
                const owner = event.owner_member_id
                  ? data.members.find((m) => m.id === event.owner_member_id)
                  : null;
                const color = owner ? colorForMember(data.members, owner.id) : null;
                return (
                  <li
                    key={event.id}
                    className={`flex items-center gap-3 rounded-xl border-r-4 p-3 ${
                      color ? `${color.light} ${color.border}` : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700"
                    }`}
                  >
                    <span className="w-14 shrink-0 font-mono text-lg" dir="ltr">
                      {new Date(event.event_at).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jerusalem",
                      })}
                    </span>
                    <span className="flex-1 text-lg">{event.title}</span>
                    <span className={`text-sm font-semibold ${color ? color.text : "text-zinc-400"}`}>
                      {owner ? owner.name : "כולם"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
```

Note: no more per-member colored dots — those were `event_members` (reminder recipients), which this section no longer displays at all, per the explicit instruction that reminder targeting and "who the event belongs to" are different things and only the latter shows on the kiosk.

- [ ] **Step 3: Replace the chores section**

Replace the entire second `<section>` (currently headed "תורנויות ומשימות") with:

```tsx
        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">לו״ז ומשימות</h2>
          {data.chores.length === 0 ? (
            <p className="text-zinc-400">אין משימות היום</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.chores.map((chore) => (
                <div
                  key={chore.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold">{chore.title}</span>
                    {chore.scheduled_time && (
                      <span className="shrink-0 text-sm text-zinc-400" dir="ltr">
                        {chore.scheduled_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {chore.chore_members.map((cm) => {
                      const member = data.members.find((m) => m.id === cm.member_id);
                      if (!member) return null;
                      const done = chore.completed_member_ids.includes(member.id);
                      return (
                        <li key={member.id}>
                          <button
                            onClick={() => toggleCompletion(chore.id, member.id)}
                            aria-pressed={done}
                            className="flex w-full items-center gap-2 text-right"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 text-sm text-white transition ${
                                done ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 dark:border-zinc-600"
                              }`}
                              aria-hidden="true"
                            >
                              {done && "✓"}
                            </span>
                            <span className={`text-base ${done ? "text-zinc-400 line-through" : ""}`}>
                              {member.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
```

This replaces the avatar-circle-with-initials buttons with full names and an explicit checkbox, per the requested design, and adds the scheduled time when set.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/d/[dashboardToken]/DashboardScreen.tsx"
git commit -m "Redesign kiosk dashboard: events as a time-sorted list tinted by owner, chores as a card grid with full names and checkboxes"
```

---

### Task 6: Manual verification

**Files:** none

- [ ] Create an event assigned to one member as "owner" (and, separately, a different set of members for reminders) — confirm the kiosk shows the owner's name (not the reminder recipients) with the card tinted in that member's color, and no colored dots.
- [ ] Create an event with owner "כולם" — confirm it renders as a neutral (non-colored) card with "כולם" as the label.
- [ ] Add a scheduled time to a chore — confirm it appears on the kiosk card.
- [ ] Confirm chore cards show full member names (not initials) with a checkbox each, and that tapping a checkbox still toggles completion correctly (same endpoint as before, unchanged).
- [ ] Confirm the two section headers read "אירועים להיום" and "לו״ז ומשימות".

No commit for this task — verification only.
