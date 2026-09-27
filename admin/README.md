# Cande operations admin

`https://cande.fyi/admin` uses Supabase Google PKCE sign-in and the server's private `mb_content_admins` allowlist. The static page contains no privileged credentials. Every content/metrics API request verifies the real session and administrator membership. Sessions are stored in sessionStorage.

- Dashboard: KST day/week (Monday)/month buckets, unique room creators and chat senders, signup/guest counts, turn outcomes, processing/notification queue status. A maximum 366-day inclusive range is accepted. Partial boundary weeks/months use the selected range only.
- Content: current store product metadata, FAQ and payment notice; draft/save/preview/publish with revision conflicts. Store SKU IDs/fulfillment and actual store prices remain authoritative.
- Backend source and migrations: `mental/server/supabase/`. Production project: `tzuxtejuscgyvgfmlijt`.
- Required build settings: `ADMIN_SUPABASE_URL`, `ADMIN_SUPABASE_PUBLISHABLE_KEY` (public publishable key only). Never use a service role key or Slack token here.
- OAuth redirects: `https://cande.fyi/admin` and `https://www.cande.fyi/admin`.

Run `npm ci`, `npm run check`, `npm run build`. Output is `dist/`. Existing homepage/legal pages are preserved. `/admin` has no-store, noindex and a restrictive CSP.
