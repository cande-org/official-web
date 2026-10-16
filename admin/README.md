# Cande operations admin

`https://cande.fyi/admin` uses Supabase Google PKCE sign-in and the server's private `mb_content_admins` allowlist. The static page contains no privileged credentials. Every content/metrics API request verifies the real session and administrator membership. Sessions persist in localStorage; OAuth return routes are retained only in sessionStorage.

- Dashboard: KST day/week (Monday)/month buckets, unique room creators and chat senders, signup/guest counts, turn outcomes, processing/notification queue status. A maximum 366-day inclusive range is accepted. Partial boundary weeks/months use the selected range only.
- Content: current store product metadata, FAQ and payment notice; draft/save/preview/publish with revision conflicts. Store SKU IDs/fulfillment and actual store prices remain authoritative.
- Backend source and migrations: `mental/server/supabase/`. Production project: `tzuxtejuscgyvgfmlijt`.
- Required build settings: `ADMIN_SUPABASE_URL`, `ADMIN_SUPABASE_PUBLISHABLE_KEY` (public publishable key only). Never use a service role key or Slack token here.
- OAuth redirects: `https://cande.fyi/admin` and `https://www.cande.fyi/admin`.

Run `npm ci`, `npm run check`, `npm run build`. Output is `dist/`. Existing homepage/legal pages are preserved. `/admin` has no-store, noindex and a restrictive CSP.

Growth dashboard (2026-09-27): returning users and DAU/WAU/MAU use authenticated server activity (startup billing reads, room creation, accepted user turns), not every foreground/offline open. Signup cohorts show exact KST D1/D7/D30 only after the return day is complete. Signup→chat/purchase and guest→member conversion use a 168-hour window; immature cohorts and pre-collection signups are excluded. Each rate includes numerator/denominator. Purchases are verified positive-price PRODUCTION transactions, including renewals, excluding sandbox/free trials; later refunds do not erase prior purchase experience. Ad views mean verified rewarded completions, not impressions. Outcome failure rate uses completed results. Collection coverage, empty/maturing states and privacy-safe aggregates are visible; raw user identities are never returned.

Backend contract: `mb_metrics_dashboard_v2` / schemaVersion 2. Billing activity writes run via EdgeRuntime.waitUntil, then the existing minute-based outbox worker aggregates them. No new app SDK, mobile build or Slack message is required for this addition.

## Admin links (2026-10-12)

Menus use `/admin/push`, `/admin/members`, etc.; record details use `/admin/push/{uuid}`, `/admin/announcements/{uuid}`, `/admin/members/{uuid}`, `/admin/support/{uuid}`, `/admin/faqs/{id}`, and `/admin/products/{key}`. Legal versions use `/admin/legal/{key}?version={uuid}`. New forms use `/admin/push/new`, `/admin/announcements/new`, `/admin/faqs/new`.

Shared URLs open the exact view after login. OAuth continues to return to the existing allowlisted `/admin`; only a validated internal route is restored. Refresh, Back and Forward use the same router. Menu/detail query links have been retired. Vercel rewrites known menu paths to the admin shell without rewriting static assets.

[Implementation and verification](../docs/admin-routing-20261012/README.md).

Chat history (2026-10-16): `/admin/chats` lists recent user messages with KST period/kind/exact UID filters and cursor pagination. Clicking a message opens `/admin/chats/{userUuid}/{roomId}?message={id}` with bounded chronological context, older/newer loading and login return routing. Administrator-only read access; no export or chat mutation. [Verification and synthetic screenshots](../docs/admin-chat-history-20261016/README.md).
