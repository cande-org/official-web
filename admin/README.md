# Cande operations admin

Animation preview repair (2026-11-09): both built-in themes load their existing data packages into the same canvas player as uploaded animations. Real double-clicks queue the second touch instead of dropping it; a full-play button runs both phases. Thumbnail preview buttons play and reveal the canvas without changing the selected theme, draft, or published configuration. Loading/error/retry, reset and logout clear stale work. `npm run test:animation` covers built-in previews and the existing remote upload/publish fixture flow. [Verification](../../mental/docs/admin-animation-preview-20261109/README.md).

Hourly metrics (2026-11-09): separate calendar day/week/month/custom ranges from hour/day/week/month display grains. Default today in KST with hourly chart/detail rows; previous/next moves the selected period. Weekly/monthly hourly views retain each date and hour. Range unique-user cards and day-based retention cohorts keep their existing definitions. Uses the private hourly RPC through `admin-metrics?grain=hour`; all/member/guest filters and legacy daily APIs are preserved. [Verification](../../mental/docs/admin-hourly-metrics-20261109/README.md).

Exit feedback (2026-11-03): **탈퇴·해지 사유** at `/admin/exit-feedback` lists submitted reasons and optional comments, with inclusive KST dates (up to93 days), flow/reason/account-state filters, whole-range totals and numbered20/50-row pages. Includes consent-retained surveys after account deletion; existing deletion policy is unchanged. Submissions are not confirmed cancellation/deletion counts. Verified-admin-only `admin-exit-feedback` API, plain-text opinions, stale-request/sign-out cleanup. [Verification](../../mental/docs/admin-exit-feedback-20261103/README.md).

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

Operational records (2026-10-17): separate `/admin/payments`, `/admin/ads`, `/admin/friends` tables and shareable details. Payments/ads support bounded KST periods and all menus support exact UID/cursor paging. Ads represent verified rewarded completions; unproven payment environments and missing credit ledgers remain explicit. Friend photos use owner-checked private signed URLs with refresh/fallback. [Contract and synthetic screenshots](../docs/admin-operations-20261017/README.md).

Numbered pages (2026-10-17): all record lists share numeric navigation and direct page entry. Server-backed records fetch total counts and one requested page; unchanged seed friends are omitted while renamed/photo-customized seed friends and user-added friends remain. [Verification](../docs/admin-pagination-20261017/README.md).

## 친구 선톡 · 배치 / CRM (2026-11-10)

푸시 메뉴의 친구 선톡 영역에서 유료 이용 구분, 최소 합산 대화권, 사용자별 간격, 최근/대화량/랜덤 친구, 발송 시간·비활동·배치·일일 한도와 선톡 프롬프트를 설정합니다. 저장 후 대상 미리보기를 확인하고 선택 UID 또는 조건 전체에 이번 배치를 등록할 수 있습니다. AI 생성과 직접 문구를 지원하며 기록 상세에서 실제 메시지, 선택 이유, 적용 조건·프롬프트, 기기별 FCM 접수/실패와 열람을 구분합니다.

서버 함수 `admin-friend-push`, `friend-push-dispatch`, `friend-push-open`과 migration `202611100001_friend_push.sql`은 mental 저장소에서 관리합니다. 현재 게시 성향 프롬프트를 재사용하고 사용자 대화권은 차감하지 않습니다. 자동 발송은 초기 OFF이며 기존 수신 동의와 지원 앱 등록 버전 1 이상이 필요합니다. 새 앱 적용 전 기존 기기는 대상에 포함되지 않습니다.

검증: npm check/test/build 및 tests/friend-push-browser.mjs. 브라우저 검증은 합성 데이터만 사용하고 실제 푸시를 발송하지 않습니다.
