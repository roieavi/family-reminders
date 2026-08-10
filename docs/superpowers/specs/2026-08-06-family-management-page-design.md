# Family management page + real side-menu navigation — design

## Problem

The side menu built in the previous phase only holds the light/dark toggle — it was scaffolded to be extended, but nothing in it navigates anywhere yet. Family member management (member list, add member, save email, regenerate token) currently lives in a collapsible section at the bottom of the dashboard, which makes the dashboard longer than it needs to be and buries a page-worthy feature inside a "more" toggle.

This phase moves family management to its own route, reachable from the side menu, and turns the side menu into a real two-way navigation surface (dashboard ⇄ family management) shown on both pages.

## Side menu navigation

- `SideMenu` (`app/u/[token]/SideMenu.tsx`) gains a required `token: string` prop so it can build links.
- Two new rows render above the existing theme toggle, styled the same way (full-width row, icon + label, `rounded-xl border-2 border-black dark:border-zinc-300`):
  - "לוח הבית" → `/u/${token}`
  - "בני המשפחה" → `/u/${token}/family`
- Both the dashboard and the new family page render `<SideMenu token={token}>`, so the menu (and both nav links) is available from either page — this is what makes the navigation two-way, per explicit confirmation from the user rather than relying on a separate back button.

## Family management page

- New route: `app/u/[token]/family/page.tsx` — a server component that resolves the member via `getMemberByToken(token)`, identical in structure to the existing `app/u/[token]/page.tsx`. If the token is invalid, it shows the same "invalid link" fallback the dashboard route shows today.
  - That fallback (currently inlined in `app/u/[token]/page.tsx`) is extracted into a shared `app/u/[token]/InvalidLink.tsx` component so both routes use one implementation instead of duplicating the markup.
- New client component `app/u/[token]/family/FamilyManagement.tsx`, rendered by the page once the token resolves. It:
  - Fetches `/api/members` itself (same call already made by `Dashboard`).
  - Renders a simple header — hamburger button (opens `SideMenu`) + the title "בני המשפחה" — deliberately plainer than the dashboard's colored greeting header, since this is a management/settings-style page, not the home screen.
  - Renders the member list and "+ הוסף בן משפחה" flow exactly as they behave today.
- `AddMemberForm` and `MemberRow` (currently defined as sibling functions inside `Dashboard.tsx`) move into `FamilyManagement.tsx` verbatim — they're only used here now. `FamilyManagement.tsx` imports the existing `MemberSummary` type from `./Dashboard` rather than duplicating it (`Dashboard.tsx` already exports it, and `CalendarView.tsx` already imports types from `Dashboard.tsx` the same way).

## Dashboard changes

- `Dashboard.tsx` passes `token` to `<SideMenu token={token}>`.
- The collapsible "בני המשפחה" section (member list + add-member UI) and the `showMembers`/`showAddMember` state are removed entirely — this functionality now lives only on the family page.
- The `members` fetch itself stays in `Dashboard.tsx` — it's still needed for event-form member assignment and avatars in the event list/grid/calendar views.

## Testing

No automated test framework exists in this repo. Verification is `npx tsc --noEmit` plus manual browser checks: navigate dashboard → family page and back via the menu from both sides, confirm member list/add-member/email-save/regenerate-token all still work identically on the new page, confirm the dashboard no longer shows the old collapsible section, confirm an invalid token shows the same fallback on both routes, confirm dark mode styling carries over correctly on the new page (menu rows, header, member list).
