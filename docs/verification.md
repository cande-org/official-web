# 홈페이지 검증 — 2026-09-19

- 로컬 Chromium 실렌더에서 한국어/영어 각각 360, 390, 430, 768, 1024,
  1440px 폭 확인: 가로 넘침 없음, 이미지 로딩 성공, 번역 누락 없음.
- KO/EN 버튼 전환 및 새로고침 후 선택 언어 유지 확인.
- 내부 앵커 대상 존재 및 서비스 링크 실제 이동 확인.
- 모든 문의 링크가 제공된 mailto 주소와 일치. 실제 메일 발송은 하지 않음.
- reduced-motion 설정 시 캐릭터 animation=none, 섹션 opacity=1 확인.
- 브라우저 런타임 오류 없음.
- `npm run check`, `npm run build` 통과.
- 앱 원본과 성향별 SVG 파일 일치 확인.
- 실기기 Safari/Android 검증은 수행하지 않음. 브라우저 뷰포트 검증임.
- 캡처는 전체 내용을 보여주기 위해 reduced-motion 설정에서 촬영.

최종 한국어 화면: [데스크톱](desktop-ko.png), [모바일](mobile-ko.png).
