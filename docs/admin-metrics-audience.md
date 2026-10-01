# 대시보드 이용자 필터

`전체 / 로그인 / 비로그인`을 바꾸면 날짜/집계 단위를 유지하고 다시 조회한다. `audience=all|member|guest`와 schemaVersion 3 응답을 사용한다. 응답 상태가 요청과 다르거나 구버전일 때는 필터되지 않은 값을 표시하지 않는다.

로그인 상태는 현재 계정 속성이 아니라 활동 당시 기록으로 판단한다. 전체 고유 사용자 수는 게스트·로그인 양쪽 활동을 중복 제거한다. 재방문 기준도 선택한 상태의 최초 활동 날짜다. 비로그인은 익명 게스트 계정이며, 게스트 시작 코호트의 리텐션/전환을 조회한다. 누적 가입·이번 주 가입·현재 회원과 대기 큐는 전체 운영 현황으로 명시한다.

배포 순서: mental 서버 저장소의 `202610010012_metrics_audience.sql` 적용 → `admin-metrics` 배포 → 이 웹 배포. audience가 없는 이전 웹 요청은 서버가 v2 호환 응답을 제공한다.

검증: `npm run check`, `npm test`, `npm run build`, `npm run test:browser`. 브라우저 검증에는 기존과 같이 Playwright가 필요하며 외부 런타임은 `PLAYWRIGHT_MODULE_PATH`와 `CHROMIUM_EXECUTABLE_PATH`로 지정한다. `tests/metrics-browser.mjs`는 가상 API와 실제 대시보드 DOM을 사용하며 운영 로그인·데이터를 사용하지 않는다.

서버 집계 검증/화면 캡처: mental의 `docs/admin-metrics-audience-20261001/README.md`.
