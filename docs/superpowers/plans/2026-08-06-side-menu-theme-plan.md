# Side Menu + Light/Dark Theme (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the automatic OS-driven dark mode (which currently half-breaks the UI) with an explicit, user-controlled light/dark toggle living in a new slide-in side menu, and give every existing screen real dark styling.

**Architecture:** A `dark` class on `<html>`, driven by `localStorage` and applied via a `beforeInteractive` inline script (no flash on reload) plus a React `ThemeToggle`. Tailwind v4's CSS-first config gets a `@custom-variant dark` tied to that class instead of the default `prefers-color-scheme` media query. A reusable `SideMenu` shell (hamburger trigger via render-prop + slide-in panel that pushes page content left, RTL) hosts the toggle today and future nav links later. Every component that currently hardcodes `bg-white`/`border-black`/etc. gets a matching `dark:` variant.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (CSS-first config, no `tailwind.config.*`), TypeScript. No automated test framework exists in this repo (`package.json` has no test runner) — verification for this UI-only change is `npx tsc --noEmit` for type safety plus manual checks in the browser (dev server + Chrome browser tool), matching how this session already verified `EntryScreen`.

**Design doc:** [docs/superpowers/specs/2026-08-06-side-menu-theme-design.md](../specs/2026-08-06-side-menu-theme-design.md)

---

## File Structure

**Create:**
- `lib/theme.ts` — theme type, localStorage read/write helpers, the no-flash init script string
- `app/u/[token]/ThemeToggle.tsx` — the light/dark toggle row (uses `ToggleSwitch`)
- `app/u/[token]/SideMenu.tsx` — reusable slide-in panel shell (trigger via render-prop, push-content mechanics, hosts `ThemeToggle`)

**Modify:**
- `app/globals.css` — swap `@media (prefers-color-scheme: dark)` for an explicit `.dark` class + register the Tailwind v4 custom variant
- `app/layout.tsx` — inject the no-flash theme script via `next/script` (`beforeInteractive`)
- `app/u/[token]/ToggleSwitch.tsx` — dark track color
- `app/u/[token]/Dashboard.tsx` — wrap in `SideMenu`, swap header logo icon for hamburger trigger, dark-style all cards/forms/borders
- `app/u/[token]/Modal.tsx`, `GridView.tsx`, `CalendarView.tsx`, `SearchBar.tsx` — dark styling
- `app/EntryScreen.tsx`, `app/SetupForm.tsx`, `app/JoinForm.tsx`, `app/u/[token]/page.tsx` — dark styling

**Styling rules used throughout** (so the per-file diffs below read as mechanical application of a fixed rule set, not one-off judgment calls):
- `border-black` (any weight) → add `dark:border-zinc-300`
- `border-zinc-100` / `border-zinc-200` (subtle dividers) → add `dark:border-zinc-700`
- `bg-white` used as a card/sheet/input surface → add `dark:bg-zinc-800`
- `hover:bg-indigo-50` → add `dark:hover:bg-zinc-700` (keeps the orange regen-token button's `hover:bg-orange-50` on-brand with `dark:hover:bg-orange-950` instead)
- `text-zinc-600` / `text-zinc-700` sitting on a surface that flips (white/dark:zinc-800 or the page background) → add `dark:text-zinc-300` (these shades are too dark to stay legible on a dark surface; `text-zinc-400`/`text-zinc-500` are left alone — they read fine on both)
- Elements with **no** explicit text color inherit `--foreground`, which already flips via the `.dark` class — no per-element change needed, *except* two spots in `GridView` that sit on a permanently-light chip background (member-color pastel / always-white "+N" pill) — those get an explicit `text-zinc-900` pin instead of a `dark:` variant, since their background never changes with the theme
- Bare `border-2 border-black` `<input>` elements (no explicit `bg-*` today, so they rely on the browser's native white input background) get `bg-white dark:bg-zinc-800` added explicitly, so they don't go "light gray text on native white bg" once the page turns dark

---

### Task 1: Theme infrastructure (storage, CSS variant, no-flash script)

**Files:**
- Create: `lib/theme.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the theme helper module**

```ts
// lib/theme.ts
export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// Runs before hydration (see app/layout.tsx) so a user who previously chose
// dark doesn't see a light flash. Everyone else defaults to light, even if
// their OS is set to dark - that default is what fixes the reported bug.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem("${THEME_STORAGE_KEY}") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;
```

- [ ] **Step 2: Replace the automatic media-query dark mode in globals.css**

Modify `app/globals.css` — old content:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-heebo);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
```

New content:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-heebo);
}

body {
```

(The rest of the file — keyframes, `.animate-sheet-up`, `.no-scrollbar`, `.animate-fade-in` — is unchanged.)

- [ ] **Step 3: Wire the no-flash script into the root layout**

Modify `app/layout.tsx` — old content:

```tsx
import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "תזכיר לי",
  description: "מישהו צריך לזכור את זה",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

New content:

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Heebo } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "תזכיר לי",
  description: "מישהו צריך לזכור את זה",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </body>
    </html>
  );
}
```

`beforeInteractive` scripts are always hoisted into `<head>` by Next.js regardless of where they sit in the tree (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md`), so this runs before first paint.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts app/globals.css app/layout.tsx
git commit -m "Replace automatic OS dark mode with explicit theme toggle infra"
```

---

### Task 2: ThemeToggle component

**Files:**
- Modify: `app/u/[token]/ToggleSwitch.tsx`
- Create: `app/u/[token]/ThemeToggle.tsx`

- [ ] **Step 1: Give the toggle track a dark-mode "off" color**

Modify `app/u/[token]/ToggleSwitch.tsx` — old:

```tsx
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-indigo-600" : "bg-zinc-300"
      }`}
```

New:

```tsx
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
      }`}
```

- [ ] **Step 2: Create ThemeToggle**

```tsx
// app/u/[token]/ThemeToggle.tsx
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/u/\[token\]/ToggleSwitch.tsx app/u/\[token\]/ThemeToggle.tsx
git commit -m "Add ThemeToggle component"
```

---

### Task 3: SideMenu shell

**Files:**
- Create: `app/u/[token]/SideMenu.tsx`

- [ ] **Step 1: Create the slide-in menu shell**

```tsx
// app/u/[token]/SideMenu.tsx
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
```

`children` is a render-prop (function, not plain JSX) so the caller decides exactly where the hamburger trigger button sits, while `SideMenu` still owns the open/closed state and the push/slide mechanics. Menu content is hardcoded to `<ThemeToggle />` for this phase; a future phase can extend this file's JSX to accept more items when nav links are added — not worth a generic "menu items" API until there's a second consumer.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (SideMenu isn't imported anywhere yet, so this just confirms the file itself is valid).

- [ ] **Step 3: Commit**

```bash
git add app/u/\[token\]/SideMenu.tsx
git commit -m "Add SideMenu shell component"
```

---

### Task 4: Wire SideMenu into Dashboard (hamburger trigger + push)

**Files:**
- Modify: `app/u/[token]/Dashboard.tsx`

- [ ] **Step 1: Import SideMenu**

Old:

```tsx
import CountdownBadge from "./CountdownBadge";
import ToggleSwitch from "./ToggleSwitch";
```

New:

```tsx
import CountdownBadge from "./CountdownBadge";
import ToggleSwitch from "./ToggleSwitch";
import SideMenu from "./SideMenu";
```

- [ ] **Step 2: Wrap the return value in SideMenu and swap the header logo for a hamburger trigger**

Old:

```tsx
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-8">
      <header className="relative -mx-4 overflow-hidden rounded-b-3xl bg-gradient-to-br from-indigo-500 to-violet-600 px-5 pt-10 pb-20 text-white">
        <div className="pointer-events-none absolute -top-10 -left-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute top-14 -right-6 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-white.png" alt="תזכיר לי" className="mb-2 h-8 w-8" />
            <h1 className="text-4xl font-extrabold">
              {greeting}, {memberName}
            </h1>
          </div>
          <PushSubscribeButton token={token} />
        </div>
      </header>
```

New:

```tsx
  return (
    <SideMenu>
      {({ open }) => (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-8">
      <header className="relative -mx-4 overflow-hidden rounded-b-3xl bg-gradient-to-br from-indigo-500 to-violet-600 px-5 pt-10 pb-20 text-white">
        <div className="pointer-events-none absolute -top-10 -left-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute top-14 -right-6 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div>
            <button
              type="button"
              onClick={open}
              aria-label="פתח תפריט"
              className="mb-2 flex h-8 w-8 items-center justify-center"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            <h1 className="text-4xl font-extrabold">
              {greeting}, {memberName}
            </h1>
          </div>
          <PushSubscribeButton token={token} />
        </div>
      </header>
```

Note: everything between this header and the function's closing tags (Step 3 below) is untouched JSX — only its effective nesting depth changes, not its content. Leave its indentation as-is; that's a cosmetic-only mismatch (JSX doesn't care about indentation), not worth a manual re-indent pass.

- [ ] **Step 3: Close the wrapper at the end of the function**

Old (this is the tail end of `Dashboard`, right before the module-level `diffMinutes` helper):

```tsx
      </section>
    </main>
  );
}

function diffMinutes(eventAt: string, remindAt: string): number {
```

New:

```tsx
      </section>
    </main>
      )}
    </SideMenu>
  );
}

function diffMinutes(eventAt: string, remindAt: string): number {
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Start the dev server (`npm run dev` or the existing `.claude/launch.json` "reminder-dev" preview) and open a member's dashboard page:
- Confirm the small logo icon above the greeting is now a hamburger icon.
- Tap it: a panel slides in from the right edge, page content shifts left, and it contains the light/dark row.
- Tap the backdrop (or the ✕ in the panel): it closes.
- Tap the theme row: page should visibly flip to dark (even though most components don't have `dark:` styling yet, the body background/text should already flip since `globals.css` was updated in Task 1).

- [ ] **Step 6: Commit**

```bash
git add app/u/\[token\]/Dashboard.tsx
git commit -m "Wire SideMenu and hamburger trigger into Dashboard"
```

---

### Task 5: Dark styling — Dashboard.tsx cards, chips, forms

**Files:**
- Modify: `app/u/[token]/Dashboard.tsx`

Apply each of the following edits (all in the same file, all mechanical applications of the rules listed in "File Structure" above):

- [ ] **Step 1: Next-event card**

Old: `      <div className="relative z-10 -mt-12 rounded-2xl bg-white p-4 shadow-lg">`
New: `      <div className="relative z-10 -mt-12 rounded-2xl bg-white p-4 shadow-lg dark:bg-zinc-800">`

- [ ] **Step 2: Event list card**

Old: `                <li key={event.id} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">`
New: `                <li key={event.id} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">`

- [ ] **Step 3: Event description text (list view)**

Old:

```tsx
                      {event.description && (
                        <p className="mt-1 text-sm text-zinc-600">{event.description}</p>
                      )}
```

New:

```tsx
                      {event.description && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{event.description}</p>
                      )}
```

- [ ] **Step 4: Member section divider**

Old: `      <section className="mt-6 border-t-2 border-black pt-4">`
New: `      <section className="mt-6 border-t-2 border-black pt-4 dark:border-zinc-300">`

- [ ] **Step 5: "+ הוסף בן משפחה" button**

Old:

```tsx
                onClick={() => setShowAddMember((v) => !v)}
                className="rounded-lg border-2 border-black px-2 py-1 text-sm font-semibold transition hover:bg-indigo-50"
              >
                + הוסף בן משפחה
```

New:

```tsx
                onClick={() => setShowAddMember((v) => !v)}
                className="rounded-lg border-2 border-black px-2 py-1 text-sm font-semibold transition hover:bg-indigo-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
              >
                + הוסף בן משפחה
```

- [ ] **Step 6: EventForm field underline (shared by every text/date/time input in the form)**

Old:

```tsx
  const fieldInput =
    "w-full border-b-2 border-zinc-200 bg-transparent py-2 focus:border-indigo-500 focus:outline-none";
```

New:

```tsx
  const fieldInput =
    "w-full border-b-2 border-zinc-200 bg-transparent py-2 focus:border-indigo-500 focus:outline-none dark:border-zinc-700";
```

- [ ] **Step 7: "שיוך"/"תזכורת" boxes (both occurrences — use a find-and-replace-all for each string, they're identical)**

Old (appears twice, at the "שיוך" box and the "תזכורת" box):
```tsx
        <div className="overflow-hidden rounded-xl border border-zinc-100">
```
New (both occurrences):
```tsx
        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700">
```

Old (appears twice, one row template in each box):
```tsx
                className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5"
```
New (both occurrences):
```tsx
                className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-700"
```

- [ ] **Step 8: AddMemberForm wrapper**

Old: `    <div className="mt-3 flex flex-col gap-2 rounded-lg border-2 border-black p-3">`
New: `    <div className="mt-3 flex flex-col gap-2 rounded-lg border-2 border-black p-3 dark:border-zinc-300">`

- [ ] **Step 9: AddMemberForm name input**

Old:

```tsx
        <input
          className="rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="שם בן המשפחה"
```

New:

```tsx
        <input
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="שם בן המשפחה"
```

- [ ] **Step 10: AddMemberForm email input**

Old:

```tsx
        <input
          className="rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
      </form>
```

New:

```tsx
        <input
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
      </form>
```

- [ ] **Step 11: AddMemberForm submit button**

Old:

```tsx
        <button
          type="submit"
          className="rounded-lg border-2 border-black bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          צור קישור אישי
```

New:

```tsx
        <button
          type="submit"
          className="rounded-lg border-2 border-black bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:border-zinc-300"
        >
          צור קישור אישי
```

- [ ] **Step 12: AddMemberForm new-link callout**

Old:

```tsx
        <div className="rounded-lg border-2 border-indigo-400 bg-indigo-50 p-2 text-sm">
          <p>שלח/י את הקישור הזה לבן המשפחה - זו הפעם היחידה שהוא מוצג:</p>
```

New:

```tsx
        <div className="rounded-lg border-2 border-indigo-400 bg-indigo-50 p-2 text-sm dark:border-indigo-700 dark:bg-indigo-950">
          <p>שלח/י את הקישור הזה לבן המשפחה - זו הפעם היחידה שהוא מוצג:</p>
```

- [ ] **Step 13: MemberRow list item**

Old: `    <li className="rounded-lg border-2 border-black p-3 text-sm">`
New: `    <li className="rounded-lg border-2 border-black p-3 text-sm dark:border-zinc-300">`

- [ ] **Step 14: MemberRow email input**

Old:

```tsx
        <input
          type="email"
          className="min-w-0 flex-1 rounded-lg border-2 border-black px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
```

New:

```tsx
        <input
          type="email"
          className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
          placeholder="אימייל (אופציונלי, לגיבוי תזכורות)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
```

- [ ] **Step 15: MemberRow "שמור מייל" button**

Old:

```tsx
        <button
          onClick={saveEmail}
          disabled={savingEmail}
          className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold transition hover:bg-indigo-50 disabled:opacity-50"
        >
          שמור מייל
```

New:

```tsx
        <button
          onClick={saveEmail}
          disabled={savingEmail}
          className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold transition hover:bg-indigo-50 disabled:opacity-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
        >
          שמור מייל
```

- [ ] **Step 16: MemberRow "קישור חדש" button**

Old:

```tsx
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="rounded-lg border-2 border-orange-600 px-2 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 disabled:opacity-50"
        >
          קישור חדש
```

New:

```tsx
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="rounded-lg border-2 border-orange-600 px-2 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 disabled:opacity-50 dark:hover:bg-orange-950"
        >
          קישור חדש
```

- [ ] **Step 17: MemberRow new-link callout**

Old:

```tsx
      {newLink && (
        <div className="mt-2 rounded-lg border-2 border-indigo-400 bg-indigo-50 p-2">
          <p>הקישור החדש - שלח/י ל{member.name} (זו הפעם היחידה שהוא מוצג):</p>
```

New:

```tsx
      {newLink && (
        <div className="mt-2 rounded-lg border-2 border-indigo-400 bg-indigo-50 p-2 dark:border-indigo-700 dark:bg-indigo-950">
          <p>הקישור החדש - שלח/י ל{member.name} (זו הפעם היחידה שהוא מוצג):</p>
```

- [ ] **Step 18: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 19: Commit**

```bash
git add app/u/\[token\]/Dashboard.tsx
git commit -m "Dark-style Dashboard cards, chips, and forms"
```

---

### Task 6: Dark styling — Modal, GridView, CalendarView, SearchBar

**Files:**
- Modify: `app/u/[token]/Modal.tsx`
- Modify: `app/u/[token]/GridView.tsx`
- Modify: `app/u/[token]/CalendarView.tsx`
- Modify: `app/u/[token]/SearchBar.tsx`

- [ ] **Step 1: Modal sheet, divider, close button**

Old:

```tsx
      <div
        className="animate-sheet-up flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
          <button
            onClick={onClose}
            aria-label="סגור"
            className="text-2xl leading-none text-zinc-400 transition hover:text-zinc-600"
          >
```

New:

```tsx
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
```

- [ ] **Step 2: GridView title text (always sits on a fixed-light card, so pin the color instead of theming it)**

Old: `            <p className="line-clamp-2 text-sm font-semibold">{event.title}</p>`
New: `            <p className="line-clamp-2 text-sm font-semibold text-zinc-900">{event.title}</p>`

- [ ] **Step 3: GridView "+N" overflow chip (same reasoning — always a white chip)**

Old:

```tsx
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold ring-2 ring-white">
                  +{relevantMembers.length - 3}
                </span>
```

New:

```tsx
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-zinc-900 ring-2 ring-white">
                  +{relevantMembers.length - 3}
                </span>
```

- [ ] **Step 4: CalendarView month nav buttons**

Old:

```tsx
        <button
          onClick={() => goToMonth(-1)}
          aria-label="חודש קודם"
          className="rounded-full px-3 py-1 font-semibold text-zinc-600 transition hover:bg-indigo-50"
        >
          ‹
        </button>
        <p className="font-bold">{monthLabel}</p>
        <button
          onClick={() => goToMonth(1)}
          aria-label="חודש הבא"
          className="rounded-full px-3 py-1 font-semibold text-zinc-600 transition hover:bg-indigo-50"
        >
          ›
        </button>
```

New:

```tsx
        <button
          onClick={() => goToMonth(-1)}
          aria-label="חודש קודם"
          className="rounded-full px-3 py-1 font-semibold text-zinc-600 transition hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ‹
        </button>
        <p className="font-bold">{monthLabel}</p>
        <button
          onClick={() => goToMonth(1)}
          aria-label="חודש הבא"
          className="rounded-full px-3 py-1 font-semibold text-zinc-600 transition hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ›
        </button>
```

- [ ] **Step 5: CalendarView day cells**

Old:

```tsx
              className={`flex aspect-square flex-col items-center justify-center rounded-full text-sm transition ${
                isToday
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "text-zinc-700 hover:bg-indigo-50"
              }`}
```

New:

```tsx
              className={`flex aspect-square flex-col items-center justify-center rounded-full text-sm transition ${
                isToday
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "text-zinc-700 hover:bg-indigo-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
```

- [ ] **Step 6: CalendarView day-popup divider and description text**

Old:

```tsx
              <div key={event.id} className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0">
```

New:

```tsx
              <div key={event.id} className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-700">
```

Old:

```tsx
                {event.description && (
                  <p className="mt-1 text-sm text-zinc-600">{event.description}</p>
                )}
```

New:

```tsx
                {event.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{event.description}</p>
                )}
```

- [ ] **Step 7: SearchBar input and answer box**

Old: `          className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"`
New: `          className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-700 dark:bg-zinc-800"`

Old: `        <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">{answer}</p>`
New: `        <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{answer}</p>`

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/u/\[token\]/Modal.tsx app/u/\[token\]/GridView.tsx app/u/\[token\]/CalendarView.tsx app/u/\[token\]/SearchBar.tsx
git commit -m "Dark-style Modal, GridView, CalendarView, SearchBar"
```

---

### Task 7: Dark styling — EntryScreen, SetupForm, JoinForm, invalid-link page

**Files:**
- Modify: `app/EntryScreen.tsx`
- Modify: `app/SetupForm.tsx`
- Modify: `app/JoinForm.tsx`
- Modify: `app/u/[token]/page.tsx`

- [ ] **Step 1: EntryScreen form card**

Old: `        <div className="w-full max-w-sm animate-fade-in rounded-2xl border-2 border-black bg-white p-6">`
New: `        <div className="w-full max-w-sm animate-fade-in rounded-2xl border-2 border-black bg-white p-6 dark:border-zinc-300 dark:bg-zinc-800">`

- [ ] **Step 2: SetupForm inputs (both — identical string, replace all)**

Old (appears twice):
```tsx
          className="rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
```
New (both occurrences):
```tsx
          className="rounded-lg border-2 border-black bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"
```

- [ ] **Step 3: SetupForm submit button**

Old: `        className="rounded-lg border-2 border-black bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"`
New: `        className="rounded-lg border-2 border-black bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:border-zinc-300"`

- [ ] **Step 4: JoinForm input**

Old: `          className="rounded-lg border-2 border-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"`
New: `          className="rounded-lg border-2 border-black bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-zinc-300 dark:bg-zinc-800"`

- [ ] **Step 5: JoinForm submit button**

Old: `        className="rounded-lg border-2 border-black bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"`
New: `        className="rounded-lg border-2 border-black bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 dark:border-zinc-300"`

- [ ] **Step 6: Invalid-link page's "back home" button**

Old:

```tsx
        <Link
          href="/"
          className="rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold transition hover:bg-indigo-50"
        >
```

New:

```tsx
        <Link
          href="/"
          className="rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold transition hover:bg-indigo-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
        >
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/EntryScreen.tsx app/SetupForm.tsx app/JoinForm.tsx app/u/\[token\]/page.tsx
git commit -m "Dark-style EntryScreen, SetupForm, JoinForm, invalid-link page"
```

---

### Task 8: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Verify the original bug is fixed**

In the browser, simulate an OS/browser dark-mode preference (e.g. DevTools "Emulate CSS prefers-color-scheme: dark", or `resize_window`'s `colorScheme` option if using the Claude Browser tool) and load the app fresh (no `theme` key in localStorage yet). Expect: the app renders in **light** mode regardless — the bug reported at the start of this project no longer reproduces.

- [ ] **Step 2: Verify the toggle and persistence**

On a member's dashboard, open the side menu, flip the toggle to dark. Confirm every screen reads legibly: next-event card, event list, grid view, calendar view, all modals (add/edit event, add member), member management section. Reload the page — dark mode should persist (no flash of light before it applies). Flip back to light, reload — should persist as light.

- [ ] **Step 3: Verify EntryScreen respects the stored theme**

With dark mode chosen, clear the stored member token (or open an incognito-style tab) and load `/`. Confirm the logo/join-or-setup-form screen renders in dark styling too, consistent with the dashboard.

- [ ] **Step 4: Verify menu mechanics**

Confirm the panel slides in from the right and visibly pushes the page content left (not just an overlay), and that tapping the backdrop or the ✕ closes it.

- [ ] **Step 5: No further commit needed** — this task is verification-only. If any check fails, fix the specific styling rule in the relevant task's file and re-run `npx tsc --noEmit` plus this checklist before considering the phase done.
