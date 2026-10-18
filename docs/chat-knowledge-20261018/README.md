# 인물·줄임말 사전 어드민 — 2026-10-18

사용자가 승인한 `https://cande.fyi/admin/knowledge` 메뉴다. 공식 official-web의 기존 홈페이지/어드민을 보존하며 기능을 추가했다. 서버 소스와 DB migration은 mental 저장소 `server/supabase/`에 있다. 앱 빌드 변경은 없다.

인물·아이돌, 그룹, 줄임말·용어, 사건·활동을 검색·조회·추가·수정·비활성화·삭제할 수 있다. 이름, 별칭(20개), 맥락 키워드(10개), 설명(600자), 역할 대화 참고(300자), 출처 HTTPS URL(4개)을 편집한다. 저장한 공개 사전은 다음 새 대화 요청부터 서버가 조회한다. 방별 역할 기억은 사용자 방에 별도로 저장하며 이 메뉴는 공통 사전만 편집한다. 삭제하면 사전 설명은 더 이상 조회하지 않으며 기존 대화 기록이나 사용자 설정을 삭제하지 않는다.

기존 Google 관리자 인증/allowlist를 사용한다. 목록은 서버의 숫자 페이지(20개씩), 상세·추가 URL, OAuth 후 복귀를 지원한다. 수정·삭제는 revision을 확인해 다른 관리자의 변경을 덮어쓰지 않는다. 충돌 시 입력을 유지하고, 편집 중 이동/닫기에는 미저장 확인을 제공한다. 사용자 입력은 textContent로 표시한다. 서버는 CRUD 감사 이력을 저장한다.

`npm run check`, 웹 단위 테스트24개, 빌드가 통과했다. `tests/chat-knowledge-browser.mjs`는 실제 브라우저·실제 편집 모듈과 합성 API를 사용해 CRUD, 비활성화, 수정 충돌 시 입력 보존, 페이지 이동, XSS, 권한 실패, 360/390/430px을 검증한다. `tests/routing-browser.mjs`로 기존 로그인/라우팅/뒤로 가기/미저장 보호를 회귀 검증했다. 테스트 Chrome은 finally에서 종료하며 별도 dev 서버는 사용하지 않는다. [합성 화면](screenshots/).

배포 대상은 CANDE/cande6, 프로젝트 `prj_Lwe2BZU8bzRf2CsxPLEAM68sduUs`, 공식 `cande-org/official-web`의 main이다. 기존 Cande Vercel 로그인에서 계정·팀·프로젝트·Git 연결·빌드 설정을 재확인했다. 소스 `ca7c7ef`의 프로덕션 배포 `dpl_CtDPUP8vEN7Je4JVCLsvqfNxRjdJ`가 READY이며 `/admin/knowledge` HTTP200을 확인했다. 실제 관리자 세션에서12개 목록과 Hearts2Hearts 항목 편집창, 저장/삭제 버튼 활성 상태를 확인했으며 운영 내용은 변경하지 않았다. Aside 검증 탭을 종료했다.

- URL: https://cande.fyi/admin/knowledge
- Target / Status: production / READY
- Framework: 없음, 정적 파일+esbuild
- Commit: ca7c7effe52884dafd8c23a9e05daa12533a28ab
- Build duration: 이번 검증에서 미조회
- Observability: 합성 브라우저 오류0, 인증된 목록/편집창 확인. Vercel 런타임 오류 로그/드레인 설정은 이번 작업에서 별도 조회하지 않았다.
