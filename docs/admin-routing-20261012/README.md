# Admin path routing — 2026-10-12

## Routes

- Eleven existing menu names: `/admin/{tab}`. `/admin` opens the dashboard.
- Products and FAQ: `/admin/products/{key}`, `/admin/faqs/{id}`. Existing FAQ IDs are keys such as `faq-1`; newly created FAQs can use UUIDs.
- Announcement, push, member and support details: `/admin/{tab}/{uuid}`.
- Legal document version: `/admin/legal/{key}?version={uuid}`. Opening a document resolves its currently selected version into the URL; the chosen historical version survives refresh/sharing.
- New forms: `/admin/faqs/new`, `/admin/announcements/new`, `/admin/push/new`. Unsubmitted form contents are not serialized in links.
- Menu/detail query routes retired by user instruction. Future automatic support links use `/admin/support/{uuid}`.

## Login and navigation

- Login uses existing Google PKCE and allowlisted `/admin` redirect. Before login, save only the normalized internal view in sessionStorage. Capture the callback URL before SDK initialization because the SDK removes the OAuth code from browser history. Restore the original path after session verification and administrator content authorization.
- No externally supplied callback URL is followed. Route parser whitelists menus, ID syntax and legal version IDs. URLs contain no title, body, email or access token.
- Push/replace/popstate keep menu and modal aligned. Closing details returns to their list. Back/Forward reopen details. Reload preserves history position so declining navigation from an unsaved editor restores the correct history entry.
- Unsaved detail editors ask before history/menu navigation. Pending API results cannot reopen stale details after another menu or logout. Existing draft and prompt edits remain in their modules when changing menus.
- Known menu Vercel rewrites serve the shell at nested paths. Static assets/config retain their real routes and the existing admin CSP/no-store/noindex headers.

## Server contract

`admin-announcements` POST `{action:"detail",kind:"push"|"announcements",id:uuid}` runs the existing verified administrator allowlist check. New service-role-only RPCs retrieve a single record by ID; recent-list limits (100 push / 200 announcement) do not limit shared details. Missing records return 404. Image URLs and click metrics use the existing fields and calculation.

Backend: mental migration `202610120001_admin_detail_links.sql`, rollback-safe SQL fixture `tests/admin_detail_links.sql`. No new data collection or push dispatch is introduced.

## Verification

- `npm run check`, `npm test` (10 tests), `npm run build`.
- All seven real Chrome fixture browser suites: push/photo, member, image CSP, metrics, legal, support, routing.
- Routing suite checks 11 menus, seven detail types, Back/Forward, refresh, dirty navigation rejected/accepted after refresh, records absent from recent lists, OAuth callback with SDK code removal, stale detail and logout. Browser tests close owned Chrome processes in `finally`.
- Production DB fixture creates functions and synthetic records inside a rolled-back transaction before applying; checks old-record lookup, no anonymous/authenticated RPC privilege, service role privilege, and missing IDs. Repeated after migration application; all fixture rows rolled back. No campaigns were queued or delivered.
- Production publication must additionally confirm known nested paths return the shell, assets retain their content types, the bundled JS matches this build, and an authorized record opens on a direct detail URL. Final deployment evidence is recorded in mental/docs/admin-routing-20261012/README.md.
