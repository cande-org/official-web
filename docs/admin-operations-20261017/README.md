# 결제·광고·친구 메뉴 — 2026-10-17

- `/admin/payments`: 구매·구독 갱신 목록, 완료/환불·실결제 근거, 거래별 원장 상세.
- `/admin/ads`: 서버가 검증해 보상을 지급한 광고 기록, 실제 지급 대화권과 원장 상세. 노출/중도 이탈 전체 로그는 아니다.
- `/admin/friends`: 사용자별 AI 친구, 성향/삭제 필터, 사용자 설정 사진과 기본 프리셋, 상세 확대 및 사진 재서명.

결제/광고 기본 최근 30일·최대 93일, 모든 메뉴 정확한 UID·20/50개 커서 페이지를 지원한다. 상세 URL과 Google 로그인 후 복귀는 공통 라우터를 사용한다. 메뉴별 수정·환불·지급 기능은 없다. 기존 결제의 환경이 저장되지 않았으면 환경 미기록으로 표시하며 금액만으로 실결제로 추정하지 않는다. 사진은 인증된 운영 관리자에게만 private Storage 10분 서명 URL로 제공한다.

## 검증과 캡처

`npm run check`, `npm test` 22개, `npm run test:browser` 10개 묶음, `npm run build`가 통과했다. 새 브라우저 fixture는 목록/필터/페이지, 거래별 상세·환불·미기록 금액, XSS 평문, 두 소유자 친구 경로, 사진 실패 fallback·재서명, OAuth 복귀, 403/로그아웃 자료 삭제, 지연 응답과 뒤로 가기, 360/390/430px 표시를 확인한다. 모든 fixture는 합성이며 실제 결제/광고/푸시/Slack 전송을 하지 않는다.

- [결제](screenshots/payments.png)
- [광고](screenshots/ads.png)
- [친구](screenshots/friends.png)
- [친구 모바일 상세](screenshots/friend-mobile.png)

서버 migration과 Edge는 mental 저장소 `server/supabase/`의 admin_operations 계약을 따른다. 서버 migration과 API 배포 및 ROLLBACK SQL 검증을 완료했다. 이 커밋은 공식 main에 push해 운영 Vercel로 배포한다. 운영 상태는 main SHA와 실제 응답을 대조해 확인한다.
