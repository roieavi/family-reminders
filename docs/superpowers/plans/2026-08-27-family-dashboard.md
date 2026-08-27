# Family Dashboard + Daily Schedule Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "לו"ז יומי" (daily schedule) management area for chores/tasks and sticky notes, plus a standalone tablet-kiosk dashboard route that displays today's timeline, chores checklist, weather, and a scrolling note ticker.

**Architecture:** Two new Postgres tables (`chores` + join/completion tables, `sticky_notes`) and four new columns on `families`, following the existing `events`/`event_members` pattern exactly. Management CRUD stays behind the existing per-member token auth (`x-member-token`). The kiosk dashboard is a brand-new, unauthenticated-by-member-token route family (`/d/[dashboardToken]`, `/api/dashboard/[dashboardToken]/...`) authenticated by a new family-level `dashboard_token`, since the physical tablet isn't tied to one person. Chore "done" state is tracked as dated rows in `chore_completions`, not a boolean, so daily reset needs no cron job.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), Supabase (Postgres + `supabase-js` service-role client), Tailwind v4, no test framework in this codebase — verification is `npx tsc --noEmit` plus manual browser checks, matching how the rest of the app is verified today.

**No new endpoint for weather in isolation:** the approved spec listed `/api/weather` as its own route, but nothing besides the dashboard aggregate needs it — folding the Open-Meteo call directly into `lib/weather.ts`, called only from `/api/dashboard/[dashboardToken]`, avoids an unused route (YAGNI). Flagging this as a deliberate deviation from the literal spec text.

**Completions write path:** only the kiosk dashboard ever marks a chore done/undone (per the design, ticking happens by tapping an avatar on the tablet) — there's no "mark done" affordance on the `/u/[token]/chores` management screen, which is CRUD-only. So the completion-toggle endpoint lives under `/api/dashboard/[dashboardToken]/...` and is authenticated by `dashboardToken`, not by a member token. This keeps each endpoint's auth model single-purpose.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0003_daily_schedule.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Daily schedule: chores/tasks, per-member daily completions, sticky notes,
-- and the family-level fields needed for the tablet kiosk dashboard.

alter table families add column dashboard_token text unique;
alter table families add column latitude double precision;
alter table families add column longitude double precision;
alter table families add column location_label text;

create table chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  recurrence text not null check (recurrence in ('daily', 'once')),
  once_date date,
  active boolean not null default true,
  created_by uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table chore_members (
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (chore_id, member_id)
);

create table chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  completion_date date not null,
  completed_at timestamptz not null default now(),
  unique (chore_id, member_id, completion_date)
);

create table sticky_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  text text not null,
  note_date date not null,
  created_at timestamptz not null default now()
);

create index chores_family_idx on chores (family_id, active);
create index chore_completions_lookup_idx on chore_completions (chore_id, completion_date);
create index sticky_notes_family_date_idx on sticky_notes (family_id, note_date);
create index families_dashboard_token_idx on families (dashboard_token);

-- Same RLS posture as every other table in this app: enabled, no policies.
-- All access goes through server-side API routes using the service role key.
alter table chores enable row level security;
alter table chore_members enable row level security;
alter table chore_completions enable row level security;
alter table sticky_notes enable row level security;
```

- [ ] **Step 2: Apply the migration**

Run this against the project's Supabase instance (e.g. via the Supabase SQL editor, or `supabase db push` if the CLI is linked locally). There's no automated migration runner in this repo — `supabase/migrations/0001_init.sql` and `0002_event_attachments.sql` were applied the same way.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_daily_schedule.sql
git commit -m "Add chores, chore_completions, sticky_notes tables and family location/dashboard columns"
```

---

### Task 2: Shared types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the new row types**

Append to `lib/types.ts` (after the existing `ReminderRow` interface, before `PushSubscriptionJSON`):

```ts
export interface Family {
  id: string;
  name: string;
  dashboard_token: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  created_at: string;
}

export interface ChoreRow {
  id: string;
  family_id: string;
  title: string;
  recurrence: "daily" | "once";
  once_date: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
}

export interface ChoreCompletionRow {
  id: string;
  chore_id: string;
  member_id: string;
  completion_date: string;
  completed_at: string;
}

export interface StickyNoteRow {
  id: string;
  family_id: string;
  member_id: string;
  text: string;
  note_date: string;
  created_at: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this is an additive change to a file with no other usages yet).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "Add Family, ChoreRow, ChoreCompletionRow, StickyNoteRow types"
```

---

### Task 3: "Today" helper in Israel time

**Files:**
- Modify: `lib/israelTime.ts`

- [ ] **Step 1: Add `todayIsraelDate`**

Append to `lib/israelTime.ts`:

```ts
export function todayIsraelDate(): string {
  return toIsraelDateTimeParts(new Date().toISOString()).date;
}
```

This returns a `YYYY-MM-DD` string for "today" as experienced in Israel, reusing the existing `toIsraelDateTimeParts` helper. It's the value stored in and compared against `chore_completions.completion_date` and `sticky_notes.note_date`, which is what makes both reset automatically at Israel midnight with no cron job.

- [ ] **Step 2: Verify manually**

Run: `node -e "const {toIsraelDateTimeParts}=require('./lib/israelTime.ts')" ` won't work directly since it's TS — instead sanity-check by reading the function: it delegates entirely to `toIsraelDateTimeParts`, which is already exercised by the existing app (used in `Dashboard.tsx` today). No separate test needed.

- [ ] **Step 3: Commit**

```bash
git add lib/israelTime.ts
git commit -m "Add todayIsraelDate helper for daily reset logic"
```

---

### Task 4: Hebrew date conversion

**Files:**
- Create: `lib/hebrewDate.ts`

This is a self-contained Gregorian→Hebrew calendar conversion (the public-domain Fourmilab/`calendar.js` algorithm) plus Hebrew numeral (gematria) formatting — no external package. It was prototyped and verified outside the repo before writing this plan:
- Round-trip tested (Gregorian → Hebrew → Gregorian) across 1950–2050 with 0 mismatches.
- Anchor-tested: 1999-09-11 → "א׳ בתשרי תש״ס" (1 Tishrei 5760, a known Rosh Hashana), 1948-05-14 → "ה׳ באייר תש״ח" (5 Iyar 5708, Israeli Independence Day), 2027-03-20 → "י״א באדר ב׳ תשפ״ז" (correctly lands in Adar II of a leap year).

- [ ] **Step 1: Write the file**

```ts
// Self-contained Gregorian -> Hebrew calendar conversion and Hebrew numeral
// (gematira) formatting. No external dependency — this is the public-domain
// Fourmilab `calendar.js` algorithm, reimplemented and round-trip verified.

const GREGORIAN_EPOCH = 1721425.5;
const HEBREW_EPOCH = 347995.5;

function mod(a: number, b: number): number {
  return a - b * Math.floor(a / b);
}

function leapGregorian(year: number): boolean {
  return year % 4 === 0 && !(year % 100 === 0 && year % 400 !== 0);
}

function gregorianToJd(year: number, month: number, day: number): number {
  return (
    GREGORIAN_EPOCH -
    1 +
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400) +
    Math.floor(
      (367 * month - 362) / 12 +
        (month <= 2 ? 0 : leapGregorian(year) ? -1 : -2) +
        day
    )
  );
}

function hebrewLeap(year: number): boolean {
  return mod(7 * year + 1, 19) < 7;
}

function hebrewYearMonths(year: number): number {
  return hebrewLeap(year) ? 13 : 12;
}

function hebrewDelay1(year: number): number {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12084 + 13753 * months;
  let day = months * 29 + Math.floor(parts / 25920);
  if (mod(3 * (day + 1), 7) < 3) day++;
  return day;
}

function hebrewDelay2(year: number): number {
  const last = hebrewDelay1(year - 1);
  const present = hebrewDelay1(year);
  const next = hebrewDelay1(year + 1);
  if (next - present === 356) return 2;
  if (present - last === 382) return 1;
  return 0;
}

function hebrewYearDays(year: number): number {
  return hebrewToJd(year + 1, 7, 1) - hebrewToJd(year, 7, 1);
}

function hebrewMonthDays(year: number, month: number): number {
  if ([2, 4, 6, 10, 13].includes(month)) return 29;
  if (month === 12 && !hebrewLeap(year)) return 29;
  if (month === 8 && mod(hebrewYearDays(year), 10) !== 5) return 29;
  if (month === 9 && mod(hebrewYearDays(year), 10) === 3) return 29;
  return 30;
}

function hebrewToJd(year: number, month: number, day: number): number {
  let jd = HEBREW_EPOCH + hebrewDelay1(year) + hebrewDelay2(year) + day + 1;
  if (month < 7) {
    for (let m = 7; m <= hebrewYearMonths(year); m++) jd += hebrewMonthDays(year, m);
    for (let m = 1; m < month; m++) jd += hebrewMonthDays(year, m);
  } else {
    for (let m = 7; m < month; m++) jd += hebrewMonthDays(year, m);
  }
  return jd;
}

function jdToHebrew(jd: number): { year: number; month: number; day: number } {
  jd = Math.floor(jd) + 0.5;
  const count = Math.floor(((jd - HEBREW_EPOCH) * 98496.0) / 35975351.0);
  let i = count;
  while (jd >= hebrewToJd(i, 7, 1)) i++;
  const year = i - 1;

  let month = jd < hebrewToJd(year, 1, 1) ? 7 : 1;
  while (jd > hebrewToJd(year, month, hebrewMonthDays(year, month))) month++;

  const day = jd - hebrewToJd(year, month, 1) + 1;
  return { year, month, day };
}

// Standard Hebrew numeral (gematria) formatting, including the 15/16
// exception (ט״ו / ט״ז instead of י״ה / י״ו) and geresh/gershayim marks.
function hebrewNumeral(num: number): string {
  let n = num;
  const letters: string[] = [];
  while (n >= 400) {
    letters.push("ת");
    n -= 400;
  }
  if (n >= 300) {
    letters.push("ש");
    n -= 300;
  } else if (n >= 200) {
    letters.push("ר");
    n -= 200;
  } else if (n >= 100) {
    letters.push("ק");
    n -= 100;
  }

  if (n === 15) {
    letters.push("ט", "ו");
    n = 0;
  } else if (n === 16) {
    letters.push("ט", "ז");
    n = 0;
  } else {
    const TENS: [number, string][] = [
      [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"],
      [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"],
    ];
    for (const [v, l] of TENS) {
      if (n >= v) {
        letters.push(l);
        n -= v;
        break;
      }
    }
    const UNITS: [number, string][] = [
      [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"],
      [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"],
    ];
    for (const [v, l] of UNITS) {
      if (n >= v) {
        letters.push(l);
        n -= v;
        break;
      }
    }
  }

  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0] + "׳"; // geresh
  return letters.slice(0, -1).join("") + "״" + letters[letters.length - 1]; // gershayim before last letter
}

const MONTH_NAMES: Record<number, string> = {
  1: "ניסן", 2: "אייר", 3: "סיוון", 4: "תמוז", 5: "אב", 6: "אלול",
  7: "תשרי", 8: "חשוון", 9: "כסלו", 10: "טבת", 11: "שבט",
  12: "אדר", 13: "אדר ב׳",
};

function hebrewMonthName(year: number, month: number): string {
  if (month === 12 && hebrewLeap(year)) return "אדר א׳";
  return MONTH_NAMES[month];
}

// Formats a Date (read in its local/system time) as a Hebrew date string,
// e.g. "י״ד באלול תשפ״ו".
export function formatHebrewDate(date: Date): string {
  const jd = gregorianToJd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { year, month, day } = jdToHebrew(jd);
  const dayStr = hebrewNumeral(day);
  const monthStr = hebrewMonthName(year, month);
  const yearStr = hebrewNumeral(mod(year, 1000));
  return `${dayStr} ב${monthStr} ${yearStr}`;
}
```

- [ ] **Step 2: Verify with a throwaway script**

Run:
```bash
node -e "
$(sed 's/^export //' lib/hebrewDate.ts | sed 's/: [A-Za-z<>\[\], ]*//g' | sed 's/): [^{]*{/) {/')
console.log(formatHebrewDate(new Date(2026, 7, 27)));
console.log(formatHebrewDate(new Date(1999, 8, 11)));
console.log(formatHebrewDate(new Date(1948, 4, 14)));
"
```
Expected output:
```
י״ד באלול תשפ״ו
א׳ בתשרי תש״ס
ה׳ באייר תש״ח
```

(If the inline `sed` transform is awkward in your shell, simpler: copy `lib/hebrewDate.ts` to a scratch `.mjs` file, strip the `export` keyword and type annotations by hand, and run it with `node`. The goal is just to re-confirm the three lines above before moving on — this exact code was already verified this way while writing this plan.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/hebrewDate.ts
git commit -m "Add self-contained Gregorian-to-Hebrew date formatting"
```

---

### Task 5: Weather fetch

**Files:**
- Create: `lib/weather.ts`

- [ ] **Step 1: Write the file**

```ts
// Thin proxy over Open-Meteo's free, keyless current-weather API.

export interface WeatherSnapshot {
  temperatureC: number;
  icon: string;
  description: string;
}

const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "בהיר", icon: "☀️" },
  1: { description: "בהיר בעיקר", icon: "🌤️" },
  2: { description: "מעונן חלקית", icon: "⛅" },
  3: { description: "מעונן", icon: "☁️" },
  45: { description: "ערפל", icon: "🌫️" },
  48: { description: "ערפל קפוא", icon: "🌫️" },
  51: { description: "טפטוף קל", icon: "🌦️" },
  53: { description: "טפטוף", icon: "🌦️" },
  55: { description: "טפטוף חזק", icon: "🌦️" },
  61: { description: "גשם קל", icon: "🌧️" },
  63: { description: "גשם", icon: "🌧️" },
  65: { description: "גשם חזק", icon: "🌧️" },
  71: { description: "שלג קל", icon: "🌨️" },
  73: { description: "שלג", icon: "🌨️" },
  75: { description: "שלג כבד", icon: "🌨️" },
  80: { description: "ממטרים קלים", icon: "🌦️" },
  81: { description: "ממטרים", icon: "🌦️" },
  82: { description: "ממטרים עזים", icon: "⛈️" },
  95: { description: "סופת רעמים", icon: "⛈️" },
};

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherSnapshot | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=Asia%2FJerusalem`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const data = await res.json();
    const temperature = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temperature !== "number" || typeof code !== "number") return null;
    const meta = WEATHER_CODES[code] ?? { description: "לא ידוע", icon: "🌡️" };
    return { temperatureC: Math.round(temperature), icon: meta.icon, description: meta.description };
  } catch {
    return null;
  }
}
```

`next: { revalidate: 900 }` uses Next.js's extended `fetch` caching (15-minute server-side cache), matching the project's Next 16 App Router (see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`). Failures are swallowed to `null` rather than thrown, since the dashboard should still render without weather if Open-Meteo is briefly unavailable.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/weather.ts
git commit -m "Add Open-Meteo weather fetch helper"
```

---

### Task 6: Chore input parsing + relation helpers

**Files:**
- Create: `lib/chores.ts`

Mirrors `lib/events.ts`'s `parseEventInput` / `setEventRelations` split exactly, adapted for chores' simpler relation set (members only, no reminders).

- [ ] **Step 1: Write the file**

```ts
import { supabaseAdmin } from "./supabase";

export interface ChoreInput {
  title: string;
  recurrence: "daily" | "once";
  onceDate: string | null;
  memberIds: string[];
}

export function parseChoreInput(body: unknown): ChoreInput | { error: string } {
  const b = body as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  const recurrence =
    b.recurrence === "once" ? "once" : b.recurrence === "daily" ? "daily" : null;
  const onceDate = typeof b.once_date === "string" && b.once_date ? b.once_date : null;
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

  return { title, recurrence, onceDate, memberIds };
}

// Replaces a chore's assigned members with a fresh set, matching the fields
// just submitted (used by both create and edit) — mirrors setEventRelations.
export async function setChoreMembers(
  choreId: string,
  memberIds: string[]
): Promise<{ error: string } | null> {
  const { error: deleteError } = await supabaseAdmin
    .from("chore_members")
    .delete()
    .eq("chore_id", choreId);
  if (deleteError) return { error: deleteError.message };

  if (memberIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("chore_members")
      .insert(memberIds.map((member_id) => ({ chore_id: choreId, member_id })));
    if (error) return { error: error.message };
  }

  return null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/chores.ts
git commit -m "Add chore input parsing and member-relation helpers"
```

---

### Task 7: Dashboard-token lookup

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add `getFamilyByDashboardToken`**

Append to `lib/auth.ts` (add `Family` to the existing `import { Member } from "./types";` line so it reads `import { Member, Family } from "./types";`, then add):

```ts
export async function getFamilyByDashboardToken(token: string): Promise<Family | null> {
  const { data } = await supabaseAdmin
    .from("families")
    .select("*")
    .eq("dashboard_token", token)
    .maybeSingle();
  return data as Family | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "Add getFamilyByDashboardToken for kiosk auth"
```

---

### Task 8: Chores list/create API

**Files:**
- Create: `app/api/chores/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseChoreInput, setChoreMembers } from "@/lib/chores";
import { todayIsraelDate } from "@/lib/israelTime";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data: chores, error } = await supabaseAdmin
    .from("chores")
    .select("id, title, recurrence, once_date, active, chore_members(member_id)")
    .eq("family_id", requester.family_id)
    .eq("active", true)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const choreIds = (chores ?? []).map((c) => c.id);
  let completions: { chore_id: string; member_id: string }[] = [];
  if (choreIds.length > 0) {
    const { data: completionsData, error: completionsError } = await supabaseAdmin
      .from("chore_completions")
      .select("chore_id, member_id")
      .in("chore_id", choreIds)
      .eq("completion_date", todayIsraelDate());
    if (completionsError) {
      return NextResponse.json({ error: completionsError.message }, { status: 500 });
    }
    completions = completionsData ?? [];
  }

  const choresWithCompletions = (chores ?? []).map((c) => ({
    ...c,
    completed_member_ids: completions
      .filter((comp) => comp.chore_id === c.id)
      .map((comp) => comp.member_id),
  }));

  return NextResponse.json({ chores: choresWithCompletions });
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const input = parseChoreInput(await req.json());
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const { data: chore, error } = await supabaseAdmin
    .from("chores")
    .insert({
      family_id: requester.family_id,
      title: input.title,
      recurrence: input.recurrence,
      once_date: input.onceDate,
      created_by: requester.id,
    })
    .select()
    .single();

  if (error || !chore) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  const membersError = await setChoreMembers(chore.id, input.memberIds);
  if (membersError) {
    return NextResponse.json(membersError, { status: 500 });
  }

  return NextResponse.json({ chore });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/chores/route.ts
git commit -m "Add /api/chores GET (with today's completions) and POST"
```

---

### Task 9: Chore edit/delete API

**Files:**
- Create: `app/api/chores/[id]/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { parseChoreInput, setChoreMembers } from "@/lib/chores";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const input = parseChoreInput(await req.json());
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const { data: chore, error } = await supabaseAdmin
    .from("chores")
    .update({
      title: input.title,
      recurrence: input.recurrence,
      once_date: input.onceDate,
    })
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .select()
    .single();

  if (error || !chore) {
    return NextResponse.json({ error: error?.message ?? "משימה לא נמצאה" }, { status: 404 });
  }

  const membersError = await setChoreMembers(chore.id, input.memberIds);
  if (membersError) {
    return NextResponse.json(membersError, { status: 500 });
  }

  return NextResponse.json({ chore });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }
  const { id } = await params;

  const { data: chore } = await supabaseAdmin
    .from("chores")
    .select("id")
    .eq("id", id)
    .eq("family_id", requester.family_id)
    .maybeSingle();
  if (!chore) {
    return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("chores")
    .delete()
    .eq("id", id)
    .eq("family_id", requester.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/chores/[id]/route.ts
git commit -m "Add /api/chores/[id] PATCH and DELETE"
```

---

### Task 10: Sticky notes list/create API

**Files:**
- Create: `app/api/sticky-notes/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { todayIsraelDate } from "@/lib/israelTime";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("sticky_notes")
    .select("id, text, member_id, created_at")
    .eq("family_id", requester.family_id)
    .eq("note_date", todayIsraelDate())
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}

export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "נדרש טקסט לפתק" }, { status: 400 });
  }

  const { data: note, error } = await supabaseAdmin
    .from("sticky_notes")
    .insert({
      family_id: requester.family_id,
      member_id: requester.id,
      text,
      note_date: todayIsraelDate(),
    })
    .select()
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ note });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/sticky-notes/route.ts
git commit -m "Add /api/sticky-notes GET (today only) and POST"
```

---

### Task 11: Sticky note delete API

**Files:**
- Create: `app/api/sticky-notes/[id]/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";

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
    .from("sticky_notes")
    .delete()
    .eq("id", id)
    .eq("family_id", requester.family_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/sticky-notes/[id]/route.ts
git commit -m "Add /api/sticky-notes/[id] DELETE"
```

---

### Task 12: Family location API

**Files:**
- Create: `app/api/family/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const { data: family, error } = await supabaseAdmin
    .from("families")
    .select("id, name, location_label, latitude, longitude, dashboard_token")
    .eq("id", requester.family_id)
    .single();

  if (error || !family) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ family });
}

export async function PATCH(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const locationLabel = body.location_label ? String(body.location_label).trim() : null;
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;

  if (locationLabel && (latitude === null || longitude === null)) {
    return NextResponse.json({ error: "נדרשות קואורדינטות תקינות למיקום" }, { status: 400 });
  }

  const { data: family, error } = await supabaseAdmin
    .from("families")
    .update({ location_label: locationLabel, latitude, longitude })
    .eq("id", requester.family_id)
    .select("id, name, location_label, latitude, longitude, dashboard_token")
    .single();

  if (error || !family) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ family });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/family/route.ts
git commit -m "Add /api/family GET and PATCH for location settings"
```

---

### Task 13: Dashboard token regeneration API

**Files:**
- Create: `app/api/family/regenerate-dashboard-token/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMemberFromRequest } from "@/lib/auth";
import { generateMemberToken } from "@/lib/token";

// Immediately invalidates the household's current dashboard link and issues
// a new one - the old link stops working the moment this runs, matching
// members/[id]/regenerate-token's behavior.
export async function POST(req: NextRequest) {
  const requester = await getMemberFromRequest(req);
  if (!requester) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const dashboardToken = generateMemberToken();
  const { data: family, error } = await supabaseAdmin
    .from("families")
    .update({ dashboard_token: dashboardToken })
    .eq("id", requester.family_id)
    .select("dashboard_token")
    .single();

  if (error || !family) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json({ dashboard_token: family.dashboard_token });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/family/regenerate-dashboard-token/route.ts
git commit -m "Add dashboard token regeneration endpoint"
```

---

### Task 14: Dashboard aggregate read API

**Files:**
- Create: `app/api/dashboard/[dashboardToken]/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFamilyByDashboardToken } from "@/lib/auth";
import { todayIsraelDate, toIsraelDateTimeParts } from "@/lib/israelTime";
import { fetchWeather } from "@/lib/weather";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dashboardToken: string }> }
) {
  const { dashboardToken } = await params;
  const family = await getFamilyByDashboardToken(dashboardToken);
  if (!family) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const today = todayIsraelDate();

  const [membersRes, eventsRes, choresRes] = await Promise.all([
    supabaseAdmin.from("members").select("id, name").eq("family_id", family.id).order("name"),
    supabaseAdmin
      .from("events")
      .select("id, title, event_at, applies_to_all, event_members(member_id)")
      .eq("family_id", family.id)
      .order("event_at"),
    supabaseAdmin
      .from("chores")
      .select("id, title, recurrence, once_date, chore_members(member_id)")
      .eq("family_id", family.id)
      .eq("active", true),
  ]);

  // Filtered in JS against the Israel calendar date rather than a UTC
  // timestamp range, so this doesn't drift by an hour across the DST
  // transition (a fixed "+03:00" offset would be wrong for half the year —
  // Israel is UTC+2 in winter).
  const todaysEvents = (eventsRes.data ?? []).filter(
    (e) => toIsraelDateTimeParts(e.event_at).date === today
  );

  const todaysChores = (choresRes.data ?? []).filter(
    (c) => c.recurrence === "daily" || c.once_date === today
  );
  const choreIds = todaysChores.map((c) => c.id);

  const [completionsRes, notesRes] = await Promise.all([
    choreIds.length > 0
      ? supabaseAdmin
          .from("chore_completions")
          .select("chore_id, member_id")
          .in("chore_id", choreIds)
          .eq("completion_date", today)
      : Promise.resolve({ data: [] as { chore_id: string; member_id: string }[], error: null }),
    supabaseAdmin
      .from("sticky_notes")
      .select("id, text, member_id")
      .eq("family_id", family.id)
      .eq("note_date", today)
      .order("created_at"),
  ]);

  const chores = todaysChores.map((c) => ({
    ...c,
    completed_member_ids: (completionsRes.data ?? [])
      .filter((comp) => comp.chore_id === c.id)
      .map((comp) => comp.member_id),
  }));

  const weather =
    family.latitude !== null && family.longitude !== null
      ? await fetchWeather(family.latitude, family.longitude)
      : null;

  return NextResponse.json({
    family: { name: family.name, location_label: family.location_label },
    members: membersRes.data ?? [],
    events: todaysEvents,
    chores,
    notes: notesRes.data ?? [],
    weather,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/[dashboardToken]/route.ts
git commit -m "Add dashboard aggregate read endpoint"
```

---

### Task 15: Dashboard chore-completion toggle API

**Files:**
- Create: `app/api/dashboard/[dashboardToken]/chores/[choreId]/completions/route.ts`

- [ ] **Step 1: Write the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFamilyByDashboardToken } from "@/lib/auth";
import { todayIsraelDate } from "@/lib/israelTime";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dashboardToken: string; choreId: string }> }
) {
  const { dashboardToken, choreId } = await params;
  const family = await getFamilyByDashboardToken(dashboardToken);
  if (!family) {
    return NextResponse.json({ error: "לינק לא תקין" }, { status: 401 });
  }

  const body = await req.json();
  const memberId = String(body.member_id ?? "");
  if (!memberId) {
    return NextResponse.json({ error: "נדרש בן משפחה" }, { status: 400 });
  }

  const { data: chore } = await supabaseAdmin
    .from("chores")
    .select("id")
    .eq("id", choreId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (!chore) {
    return NextResponse.json({ error: "משימה לא נמצאה" }, { status: 404 });
  }

  const today = todayIsraelDate();
  const { data: existing } = await supabaseAdmin
    .from("chore_completions")
    .select("id")
    .eq("chore_id", choreId)
    .eq("member_id", memberId)
    .eq("completion_date", today)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from("chore_completions").delete().eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ completed: false });
  }

  const { error } = await supabaseAdmin.from("chore_completions").insert({
    chore_id: choreId,
    member_id: memberId,
    completion_date: today,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ completed: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/dashboard/[dashboardToken]/chores/[choreId]/completions/route.ts"
git commit -m "Add dashboard chore-completion toggle endpoint"
```

---

### Task 16: Side menu nav link

**Files:**
- Modify: `app/u/[token]/SideMenu.tsx:43-51`

- [ ] **Step 1: Add the nav entry**

In the `<nav>` block, add a new `Link` between the existing "לוח הבית" and "בני המשפחה" links:

```tsx
<nav className="flex flex-col gap-2">
  <Link href={`/u/${token}`} onClick={() => setIsOpen(false)} className={navLinkClass}>
    <span aria-hidden="true">🏠</span>
    לוח הבית
  </Link>
  <Link href={`/u/${token}/chores`} onClick={() => setIsOpen(false)} className={navLinkClass}>
    <span aria-hidden="true">📋</span>
    לו״ז יומי
  </Link>
  <Link href={`/u/${token}/family`} onClick={() => setIsOpen(false)} className={navLinkClass}>
    <span aria-hidden="true">👪</span>
    בני המשפחה
  </Link>
</nav>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/u/[token]/SideMenu.tsx
git commit -m "Add daily-schedule link to side menu"
```

---

### Task 17: Chores management screen

**Files:**
- Create: `app/u/[token]/chores/page.tsx`
- Create: `app/u/[token]/chores/ChoresManagement.tsx`

- [ ] **Step 1: Write the page (server component, resolves token — mirrors `app/u/[token]/family/page.tsx`)**

`app/u/[token]/chores/page.tsx`:

```tsx
import { getMemberByToken } from "@/lib/auth";
import ChoresManagement from "./ChoresManagement";
import InvalidLink from "../InvalidLink";

export const dynamic = "force-dynamic";

export default async function ChoresPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);

  if (!member) {
    return <InvalidLink />;
  }

  return <ChoresManagement token={token} />;
}
```

- [ ] **Step 2: Write the management component**

`app/u/[token]/chores/ChoresManagement.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { MEMBER_TOKEN_KEY } from "@/lib/storage";
import SideMenu from "../SideMenu";
import Modal from "../Modal";
import ToggleSwitch from "../ToggleSwitch";
import type { MemberSummary } from "../Dashboard";

interface ChoreItem {
  id: string;
  title: string;
  recurrence: "daily" | "once";
  once_date: string | null;
  chore_members: { member_id: string }[];
  completed_member_ids: string[];
}

interface StickyNoteItem {
  id: string;
  text: string;
  member_id: string;
  created_at: string;
}

export default function ChoresManagement({ token }: { token: string }) {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [chores, setChores] = useState<ChoreItem[]>([]);
  const [notes, setNotes] = useState<StickyNoteItem[]>([]);
  const [showAddChore, setShowAddChore] = useState(false);
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = { "Content-Type": "application/json", "x-member-token": token };

  const refresh = useCallback(async () => {
    setLoading(true);
    const [membersRes, choresRes, notesRes] = await Promise.all([
      fetch("/api/members", { headers }),
      fetch("/api/chores", { headers }),
      fetch("/api/sticky-notes", { headers }),
    ]);
    const membersData = await membersRes.json();
    const choresData = await choresRes.json();
    const notesData = await notesRes.json();
    setMembers(membersData.members ?? []);
    setChores(choresData.chores ?? []);
    setNotes(notesData.notes ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(MEMBER_TOKEN_KEY, token);
  }, [token]);

  async function deleteChore(id: string) {
    if (!confirm("למחוק את המשימה?")) return;
    await fetch(`/api/chores/${id}`, { method: "DELETE", headers });
    refresh();
  }

  async function deleteNote(id: string) {
    await fetch(`/api/sticky-notes/${id}`, { method: "DELETE", headers });
    refresh();
  }

  const dailyChores = chores.filter((c) => c.recurrence === "daily");
  const onceChores = chores.filter((c) => c.recurrence === "once");

  return (
    <SideMenu token={token}>
      {({ open }) => (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
          <header className="flex items-center gap-3">
            <button
              type="button"
              onClick={open}
              aria-label="פתח תפריט"
              className="flex h-8 w-8 items-center justify-center"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold">לו״ז יומי</h1>
          </header>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">תורנויות ומשימות</h2>
              <button
                onClick={() => setShowAddChore(true)}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                + הוסף משימה
              </button>
            </div>

            {loading ? (
              <p className="mt-3 text-center text-zinc-400">טוען...</p>
            ) : (
              <>
                <ChoreGroup
                  title="יומיומיות"
                  chores={dailyChores}
                  members={members}
                  onEdit={setEditingChoreId}
                  onDelete={deleteChore}
                />
                <ChoreGroup
                  title="חד-פעמיות"
                  chores={onceChores}
                  members={members}
                  onEdit={setEditingChoreId}
                  onDelete={deleteChore}
                />
              </>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">פתקים להיום</h2>
            <NoteForm headers={headers} onDone={refresh} />
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <span>{note.text}</span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="shrink-0 text-xs font-semibold text-red-500 transition hover:text-red-700"
                  >
                    מחק
                  </button>
                </li>
              ))}
              {notes.length === 0 && <p className="text-sm text-zinc-400">אין פתקים היום</p>}
            </ul>
          </section>

          {showAddChore && (
            <Modal onClose={() => setShowAddChore(false)} title="הוספת משימה">
              <ChoreForm
                headers={headers}
                members={members}
                onDone={() => {
                  setShowAddChore(false);
                  refresh();
                }}
                onCancel={() => setShowAddChore(false)}
              />
            </Modal>
          )}

          {editingChoreId &&
            (() => {
              const editingChore = chores.find((c) => c.id === editingChoreId);
              if (!editingChore) return null;
              return (
                <Modal onClose={() => setEditingChoreId(null)} title="עריכת משימה">
                  <ChoreForm
                    headers={headers}
                    members={members}
                    chore={editingChore}
                    onDone={() => {
                      setEditingChoreId(null);
                      refresh();
                    }}
                    onCancel={() => setEditingChoreId(null)}
                  />
                </Modal>
              );
            })()}
        </main>
      )}
    </SideMenu>
  );
}

function ChoreGroup({
  title,
  chores,
  members,
  onEdit,
  onDelete,
}: {
  title: string;
  chores: ChoreItem[];
  members: MemberSummary[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-wide text-zinc-400">{title}</p>
      {chores.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-400">אין משימות</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-2">
          {chores.map((chore) => (
            <li
              key={chore.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div>
                <p className="font-semibold">{chore.title}</p>
                <p className="text-xs text-zinc-400">
                  {chore.chore_members
                    .map((cm) => members.find((m) => m.id === cm.member_id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  onClick={() => onEdit(chore.id)}
                  className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
                >
                  ערוך
                </button>
                <button
                  onClick={() => onDelete(chore.id)}
                  className="text-xs font-semibold text-red-500 transition hover:text-red-700"
                >
                  מחק
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChoreForm({
  headers,
  members,
  chore,
  onDone,
  onCancel,
}: {
  headers: Record<string, string>;
  members: MemberSummary[];
  chore?: ChoreItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(chore?.title ?? "");
  const [recurrence, setRecurrence] = useState<"daily" | "once">(chore?.recurrence ?? "daily");
  const [onceDate, setOnceDate] = useState(chore?.once_date ?? "");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    chore ? chore.chore_members.map((cm) => cm.member_id) : []
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMember(id: string) {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = JSON.stringify({
        title,
        recurrence,
        once_date: recurrence === "once" ? onceDate : null,
        member_ids: selectedMembers,
      });
      const res = await fetch(chore ? `/api/chores/${chore.id}` : "/api/chores", {
        method: chore ? "PATCH" : "POST",
        headers,
        body,
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

  const fieldLabel = "block text-xs font-semibold tracking-wide text-zinc-400";
  const fieldInput =
    "w-full border-b-2 border-zinc-200 bg-transparent py-2 focus:border-indigo-500 focus:outline-none dark:border-zinc-700";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>כותרת</span>
        <input
          className={fieldInput}
          placeholder="למשל: הורדת זבל"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <div>
        <p className={`mb-1 ${fieldLabel}`}>חזרתיות</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">יומיומית</span>
            <ToggleSwitch
              checked={recurrence === "once"}
              onChange={(checked) => setRecurrence(checked ? "once" : "daily")}
            />
            <span className="text-sm">חד-פעמית</span>
          </div>
          {recurrence === "once" && (
            <div className="border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700">
              <input
                type="date"
                className={fieldInput}
                value={onceDate}
                onChange={(e) => setOnceDate(e.target.value)}
                required
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className={`mb-1 ${fieldLabel}`}>שיוך</p>
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 first:border-t-0 dark:border-zinc-700"
            >
              <span className="text-sm">{m.name}</span>
              <ToggleSwitch checked={selectedMembers.includes(m.id)} onChange={() => toggleMember(m.id)} />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "שומר..." : "שמור משימה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-full py-1 text-sm font-semibold text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-50"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

function NoteForm({ headers, onDone }: { headers: Record<string, string>; onDone: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/sticky-notes", {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
      setText("");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
        placeholder="פתק חדש..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        הוסף
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/u/[token]/chores/page.tsx" "app/u/[token]/chores/ChoresManagement.tsx"
git commit -m "Add daily-schedule management screen (chores + sticky notes CRUD)"
```

---

### Task 18: Family management additions (location + dashboard link)

**Files:**
- Modify: `app/u/[token]/family/FamilyManagement.tsx`

- [ ] **Step 1: Add location and dashboard-link sections**

Add two new components to the bottom of `app/u/[token]/family/FamilyManagement.tsx` (after the existing `MemberRow` function), and render them inside the `<main>` in `FamilyManagement`, right after the closing `</ul>` of the members list and before the `{showAddMember && (...)}` block:

```tsx
          <LocationSection headers={headers} />
          <DashboardLinkSection headers={headers} />
```

Append these two functions at the end of the file:

```tsx
function LocationSection({ headers }: { headers: Record<string, string> }) {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { name: string; admin1?: string; latitude: number; longitude: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/family", { headers })
      .then((res) => res.json())
      .then((data) => setLocationLabel(data.family?.location_label ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=he&format=json`
      );
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function selectResult(result: { name: string; admin1?: string; latitude: number; longitude: number }) {
    const label = result.admin1 ? `${result.name}, ${result.admin1}` : result.name;
    setSaving(true);
    try {
      await fetch("/api/family", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          location_label: label,
          latitude: result.latitude,
          longitude: result.longitude,
        }),
      });
      setLocationLabel(label);
      setResults([]);
      setQuery("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border-2 border-black p-3 dark:border-zinc-300">
      <h2 className="font-semibold">מיקום המשפחה (למזג האוויר בדשבורד)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {locationLabel ? `נוכחי: ${locationLabel}` : "לא הוגדר מיקום"}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="חיפוש עיר..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={search}
          disabled={searching}
          className="rounded-lg border-2 border-black px-3 py-2 text-sm font-semibold transition hover:bg-indigo-50 disabled:opacity-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
        >
          חפש
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => selectResult(r)}
                disabled={saving}
                className="w-full rounded-lg px-2 py-1.5 text-right text-sm hover:bg-indigo-50 disabled:opacity-50 dark:hover:bg-zinc-700"
              >
                {r.name}
                {r.admin1 ? `, ${r.admin1}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardLinkSection({ headers }: { headers: Record<string, string> }) {
  const [dashboardToken, setDashboardToken] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch("/api/family", { headers })
      .then((res) => res.json())
      .then((data) => setDashboardToken(data.family?.dashboard_token ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerate() {
    if (dashboardToken && !confirm("ליצור קישור דשבורד חדש? הקישור הנוכחי יפסיק לעבוד מיד.")) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/family/regenerate-dashboard-token", { method: "POST", headers });
      const data = await res.json();
      if (res.ok) setDashboardToken(data.dashboard_token);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border-2 border-black p-3 dark:border-zinc-300">
      <h2 className="font-semibold">קישור לדשבורד הטאבלט</h2>
      {dashboardToken ? (
        <p className="mt-1 break-all font-mono text-xs">
          {typeof window !== "undefined" ? window.location.origin : ""}/d/{dashboardToken}
        </p>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">לא נוצר קישור עדיין</p>
      )}
      <button
        onClick={regenerate}
        disabled={regenerating}
        className="mt-2 rounded-lg border-2 border-orange-600 px-2 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 disabled:opacity-50 dark:hover:bg-orange-950"
      >
        {dashboardToken ? "קישור חדש" : "צור קישור"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/u/[token]/family/FamilyManagement.tsx"
git commit -m "Add location search and dashboard link management to family screen"
```

---

### Task 19: Marquee animation

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the keyframes**

Append to `app/globals.css` (after the existing `.animate-fade-in` block):

```css
@keyframes marquee {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

.animate-marquee {
  animation: marquee 25s linear infinite;
}
```

This moves the sticky-note strip left-to-right (`-100%` → `100%`), matching the requested scroll direction.

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "Add marquee animation for dashboard sticky-note ticker"
```

---

### Task 20: Tablet kiosk dashboard screen

**Files:**
- Create: `app/d/[dashboardToken]/page.tsx`
- Create: `app/d/[dashboardToken]/DashboardScreen.tsx`

- [ ] **Step 1: Write the page**

`app/d/[dashboardToken]/page.tsx`:

```tsx
import DashboardScreen from "./DashboardScreen";

export const dynamic = "force-dynamic";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  return <DashboardScreen dashboardToken={dashboardToken} />;
}
```

This intentionally doesn't resolve/validate the token server-side (unlike `/u/[token]`'s pages) — the client component's first fetch to `/api/dashboard/[dashboardToken]` does that, and renders an invalid-link state itself, since the whole screen is one client component that polls repeatedly anyway.

- [ ] **Step 2: Write the dashboard screen**

`app/d/[dashboardToken]/DashboardScreen.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { colorForMember, initials } from "@/lib/memberColors";
import { formatHebrewDate } from "@/lib/hebrewDate";

interface DashboardMember {
  id: string;
  name: string;
}

interface DashboardEvent {
  id: string;
  title: string;
  event_at: string;
  applies_to_all: boolean;
  event_members: { member_id: string }[];
}

interface DashboardChore {
  id: string;
  title: string;
  chore_members: { member_id: string }[];
  completed_member_ids: string[];
}

interface DashboardNote {
  id: string;
  text: string;
  member_id: string;
}

interface DashboardData {
  family: { name: string; location_label: string | null };
  members: DashboardMember[];
  events: DashboardEvent[];
  chores: DashboardChore[];
  notes: DashboardNote[];
  weather: { temperatureC: number; icon: string; description: string } | null;
}

const DATA_REFRESH_MS = 60_000;

export default function DashboardScreen({ dashboardToken }: { dashboardToken: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/dashboard/${dashboardToken}`);
    if (res.status === 401) {
      setInvalid(true);
      return;
    }
    if (!res.ok) return;
    const json = await res.json();
    setData(json);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on mount
    refresh();
    const dataTimer = setInterval(refresh, DATA_REFRESH_MS);
    return () => clearInterval(dataTimer);
  }, [refresh]);

  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  async function toggleCompletion(choreId: string, memberId: string) {
    await fetch(`/api/dashboard/${dashboardToken}/chores/${choreId}/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    });
    refresh();
  }

  if (invalid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-400">קישור דשבורד לא תקין</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-400">טוען...</p>
      </main>
    );
  }

  const time = now.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
  const gregorianDate = now.toLocaleDateString("he-IL", {
    dateStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  const hebrewDate = formatHebrewDate(now);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      <header className="flex items-center justify-between gap-4 bg-gradient-to-l from-indigo-500 to-violet-600 px-8 py-4 text-white">
        <span className="text-4xl font-extrabold" dir="ltr">
          {time}
        </span>
        <span className="text-lg font-semibold">
          {hebrewDate} | {gregorianDate}
        </span>
        {data.weather && (
          <span className="text-2xl font-semibold">
            {data.weather.icon} {data.weather.temperatureC}°
          </span>
        )}
      </header>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden p-4">
        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">לו״ז היום</h2>
          {data.events.length === 0 ? (
            <p className="text-zinc-400">אין אירועים היום</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.events.map((event) => {
                const relevantMembers = event.applies_to_all
                  ? data.members
                  : data.members.filter((m) => event.event_members.some((em) => em.member_id === m.id));
                return (
                  <li key={event.id} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 font-mono text-lg" dir="ltr">
                      {new Date(event.event_at).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jerusalem",
                      })}
                    </span>
                    {relevantMembers.map((m) => (
                      <span
                        key={m.id}
                        className={`h-3 w-3 shrink-0 rounded-full ${colorForMember(data.members, m.id).bg}`}
                        title={m.name}
                      />
                    ))}
                    <span className="text-lg">{event.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-y-auto rounded-2xl bg-white p-4 shadow dark:bg-zinc-800">
          <h2 className="mb-3 text-xl font-bold">תורנויות ומשימות</h2>
          {data.chores.length === 0 ? (
            <p className="text-zinc-400">אין משימות היום</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.chores.map((chore) => (
                <li key={chore.id} className="flex items-center gap-2">
                  <span className="flex-1 text-lg">{chore.title}</span>
                  {chore.chore_members.map((cm) => {
                    const member = data.members.find((m) => m.id === cm.member_id);
                    if (!member) return null;
                    const done = chore.completed_member_ids.includes(member.id);
                    const color = colorForMember(data.members, member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleCompletion(chore.id, member.id)}
                        aria-pressed={done}
                        title={member.name}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white transition ${color.bg} ${
                          done ? "opacity-40" : ""
                        }`}
                      >
                        {done ? "✓" : initials(member.name)}
                      </button>
                    );
                  })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.notes.length > 0 && (
        <div className="overflow-hidden whitespace-nowrap border-t border-zinc-200 bg-white py-3 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="animate-marquee inline-block">
            {data.notes.map((note) => (
              <span key={note.id} className="mx-8 text-lg">
                📌 {note.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/d/[dashboardToken]/page.tsx" "app/d/[dashboardToken]/DashboardScreen.tsx"
git commit -m "Add tablet kiosk dashboard screen"
```

---

### Task 21: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server and log in**

Start the dev server (via the project's normal `npm run dev`), open `/u/<an existing member token>` in a browser, confirm the app loads as before (no regressions from the `SideMenu` change).

- [ ] **Step 2: Exercise the management screen**

From the side menu, open "לו״ז יומי". Create one daily chore assigned to two members, one one-time chore dated today, and one sticky note. Confirm they appear in the lists, edit the daily chore's title, then delete the one-time chore. Confirm errors show inline if you submit a chore with no title.

- [ ] **Step 3: Set a location and get the dashboard link**

Open "בני המשפחה", search a city in the new location box, select a result, confirm the "נוכחי:" label updates. Click "צור קישור" under the dashboard-link section and copy the shown `/d/...` URL.

- [ ] **Step 4: Open the kiosk dashboard**

Open the `/d/<dashboard_token>` URL in a new tab (or resize the browser to a tablet-ish landscape size). Confirm: the clock ticks every second, the Hebrew+Gregorian date line matches today, the weather chip shows a temperature (if the searched city has valid coordinates), today's events appear in the left column with member-colored dots, the chore created in Step 2 appears in the right column with an avatar per assigned member, and the sticky note scrolls across the bottom strip.

- [ ] **Step 5: Toggle a chore from the dashboard**

Tap one member's avatar on the daily chore. Confirm it visually marks done (checkmark, dimmed) within the next poll cycle, then tap again to confirm it un-marks. Reload the management screen's chores list and confirm nothing there broke (management screen doesn't show completion state, which is expected — only the dashboard does).

- [ ] **Step 6: Confirm an invalid dashboard token is rejected**

Open `/d/not-a-real-token` and confirm it shows "קישור דשבורד לא תקין" instead of a blank or crashing page.

No commit for this task — it's verification of everything committed in Tasks 1–20.
