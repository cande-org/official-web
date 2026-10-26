# 관리자 푸시 작성 — 2026-10-26

사용자 요청으로 운영 관리자를 푸시 대상에 포함한다. 서버의 대상 수와 발송 대기열은 mental 저장소의 DB migration `202610260001_admin_push_recipients`로 반영했다. 기기 활성·마케팅 동의·UID/가입/활동/구독 조건과 운영 지표의 관리자 제외는 유지한다.

회원 상세의 관리자 전용 발송 차단 조건과 제외 안내를 제거했다. 알림 허용 기기가 있는 관리자는 UID가 채워진 새 푸시 창으로 이동할 수 있고, 최종 대상 수는 기존 서버 미리보기로 확인한다. 마케팅 동의가 별도로 필요함을 안내하며 기기가 없는 회원과 탈퇴 회원의 제한은 유지한다.

검증: `npm run check`, `npm run build`, `tests/members-browser.mjs`의 실제 Chromium 합성 검증 통과. 관리자 상세→푸시 작성→UID 자동 입력, 기기 없는 관리자 차단, 동의 안내, 390px 넘침, 로그아웃 응답 보호를 확인했다. 운영 계정으로 알림을 발송하지 않았고 테스트 브라우저는 finally에서 종료한다.

배포는 기존 CANDE/cande6의 official-web Git 연동 `main`으로 진행한다. Vercel 연결 도구에는 해당 팀의 접근 권한이 없어, 운영 `/admin/admin.js`와 로컬 `dist/admin/admin.js`의 일치로 실제 반영을 확인한다. DB 검증 영수증과 적용 기록은 mental의 `docs/admin-push-recipients-20261026/`에 보관한다.
