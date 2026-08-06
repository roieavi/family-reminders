# Side menu (phase 1: light/dark toggle) — design

## Problem

The phone's OS-level dark mode currently causes the app to render half-broken: `app/globals.css` has a `@media (prefers-color-scheme: dark)` block that flips the page's base background/foreground colors, but no component actually has dark styling, so cards, borders, and text end up mismatched. There is also no in-app way to override the system preference.

This is phase 1 of a larger navigation project (a future phase will add calendar and family-management links to the same menu). Phase 1 delivers:

1. A side menu, opened via a hamburger icon, containing a single light/dark toggle.
2. A real, explicit theme system that replaces the automatic OS-based switch.

## Menu behavior

- The small logo icon currently shown above the "צהריים טובים" greeting in [Dashboard.tsx](../../../app/u/[token]/Dashboard.tsx) is replaced with a hamburger icon button.
- Tapping it slides a panel in from the right edge of the screen (app is RTL) and pushes the existing page content to the left — not a transparent overlay. Tapping outside the panel (or a close control) closes it.
- Content for phase 1: a single row with a light/dark toggle control (e.g. sun/moon icons or a switch). Future phases add navigation links above/below it.
- The menu shell (trigger + slide-in panel) is built as a reusable component so future phases can add items without restructuring it.

## Theme system

- Replace the automatic `@media (prefers-color-scheme: dark)` rule with an explicit, user-controlled theme: a `dark` class on `<html>`, driven by `localStorage` (not by the OS setting).
- Default is **light** for every user, including those whose phone is set to dark — this directly fixes the reported bug even before anyone touches the toggle.
- Tailwind v4 uses a CSS-first config; dark-variant styling will be enabled via a custom variant tied to the `.dark` class (`@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`) rather than the default media-query strategy. Exact syntax to be confirmed against `node_modules/next/dist/docs` / Tailwind v4 docs during implementation, per this repo's [AGENTS.md](../../../AGENTS.md) instruction to verify framework specifics before coding.
- The choice is applied on mount before paint where possible (to avoid a light→dark flash for users who previously chose dark) and persisted on toggle.

## Scope: components that need dark styling

Since this is meant to be a working toggle (not just a stub), dark styling is added to every screen that exists today, not just the menu:

- `EntryScreen` (logo screen, join/setup form card)
- `Dashboard` header, next-event card, scope/view-mode buttons, event list, grid view, calendar view, member section
- `Modal` (used for add/edit event, member forms)
- All forms: `SetupForm`, `JoinForm`, `EventForm`, `AddMemberForm`, `MemberRow`

Out of scope for phase 1: calendar page as a standalone route, family-management as a standalone route, any other menu items. Those are a follow-up phase once this navigation shell and theme system exist.

## Testing

- Manual verification in the browser: toggle between light/dark, confirm all screens above render legibly in both, confirm a phone with OS dark mode set still loads light by default, confirm the choice persists across reload.
