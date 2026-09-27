# Admin item audit, names and persistent sessions

2026-09-27

- Product/FAQ tables retain a default of 20 items and now show created/updated timestamps (KST) and the updating administrator's name.
- Metadata comes from the private `admin-content` response. An absent name stays blank; email is never a fallback. Historical initial CMS entries have no recorded actor.
- Administrators can provide an optional name on creation or change/clear it later (80 characters). Existing actor references resolve to the current registered name. Name changes do not rewrite content timestamps.
- Backend dependency: mental migration `202609270008_content_audit_names.sql` plus `admin-access`/`admin-content` Edge functions.
- Login now persists in localStorage with Supabase token refresh enabled. A previous tab-local session/PKCE verifier migrates once; an old tab cannot resurrect an explicitly logged-out session. Server authorization is still checked per API request. The client does not impose a 16-hour logout; short-lived tokens renew normally.
- Initial session restoration has its own loading state. An API/network failure offers retry and does not delete the saved session.

## Verification

`npm run check`, `npm run build`, `node --test tests/auth-storage.test.js` passed.

A Playwright browser fixture verified KST dates, blank/named updater, default 20/page 2, name save and display refresh, legacy session migration, reload, a new tab, token renewal after advancing the clock 16 hours 5 minutes, explicit logout, stale-tab prevention, and desktop/390px layouts. This is simulated elapsed-time verification, not a 16-hour wall-clock soak. API fixtures use fictional accounts and do not change production content.

Supabase session reference: https://supabase.com/docs/guides/auth/sessions
