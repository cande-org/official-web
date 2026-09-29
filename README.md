# Cande 회사 홈페이지

`app/`과 같은 위치의 독립 정적 웹사이트. 외부 런타임 의존성, 앱 API 호출,
방문자 추적 없이 HTML/CSS/JavaScript로 동작합니다.

## 실행

Node.js 20 이상에서 별도 패키지 설치 없이 실행합니다.

```sh
cd homepage
npm run dev
```

기본 주소: `http://127.0.0.1:4173`. 종료: `Ctrl+C`.
다른 포트는 `PORT=4174 npm run dev`로 지정합니다.

```sh
npm run check
npm run build
npm run preview
```

`dist/`가 배포 가능한 정적 파일입니다. `npm run preview`는 빌드 결과를
같은 기본 포트에서 제공합니다.

## 콘텐츠와 동작

- 한국어 기본, KO/EN 전환. 선택 언어만 브라우저에 저장하며 저장소 접근이
  차단되어도 동작합니다. `lang`, 제목, 설명, 접근성 레이블도 전환합니다.
- 짧은 회사 소개 → 정병발사 제품 소개 → 푸터. 별도 문의/가치관/슬로건 섹션 없음.
- 문의 이메일은 푸터에만 한 번 표시: `mailto:contact@cande.fyi`.
- 스토어 주소는 제공되지 않아 임의 다운로드 링크나 출시 상태를 넣지 않았습니다.
- 제품 대화 예시에만 스크롤 등장과 순차 반응 적용. 본문은 처음부터 표시.
- `prefers-reduced-motion`에서는 움직임을 중단하고 내용을 바로 표시합니다.
- JavaScript가 없어도 기본 한국어 내용과 앵커·메일 링크가 표시됩니다.

## 디자인 출처

흰 바탕의 큰 Cande 워드마크와 짧은 설명으로 회사를 소개합니다.
앱 원본 손글씨·캐릭터·말풍선은 제품 소개 영역에 사용합니다.
홈페이지의 새 레이아웃이며 Figma 특정 화면과의 픽셀 일치를 주장하지 않습니다.

| 홈페이지 에셋 | 원본 |
| --- | --- |
| `assets/app-icon.png` | `app/assets/images/app-icon-1024.png` |
| `assets/MUNMAK_HAEBANCHE.otf` | `app/assets/fonts/MUNMAK_HAEBANCHE.otf` |
| `assets/avatar-stable.svg` | `app/assets/figma/chat-avatar-1.svg` |
| `assets/avatar-anxious.svg` | `app/assets/figma/chat-avatar-2.svg` |
| `assets/avatar-avoidant.svg` | `app/assets/figma/chat-avatar-3.svg` |
| `assets/chat-message-outline.svg` | `app/assets/figma/chat-message-outline.svg` |

성향별 매핑은 `app/lib/core/widgets/profile_avatar.dart`를 따릅니다.
SVG 경로는 변경하지 않았으며 말풍선은 CSS border-image의 9분할로 확장합니다.
캐릭터·아이콘을 다시 그리지 않았습니다. favicon은 회사 홈페이지용 흑백 C 모티프입니다.

2026-09-19 구조 개편의 참고 페이지와 판단은 [디자인 기록](docs/design-review.md)에 있습니다.

## 수정 위치

- 한국어 본문/구조: `index.html`
- 영문 번역, 언어 전환, 스크롤 효과: `main.js`
- 반응형, 모션, 디자인: `style.css`
- 빌드/로컬 서버: `scripts/`

사업자 정보는 사용자가 제공한 상호·등록번호·과세 유형·문의 메일만 기재했습니다.
주소나 대표자 이름 등 제공되지 않은 정보는 임의로 만들지 않았습니다.

## 개인정보처리방침 · 서비스 이용약관

- `privacy.html`, `terms.html`: 한국어/영어 별도 문서 페이지. 홈페이지와 각
  문서 푸터에서 이동할 수 있고 선택 언어가 유지됩니다.
- 시행일: 2026-10-01. 담당부서: Cande 개인정보 보호 담당.
- 연락처는 각 페이지 푸터에만 한 번 표시하며 본문의 권리행사 안내에서 연결합니다.
- 문서 스타일: `legal.css`. 공통 언어 전환/제목/설명: `main.js`.
- `npm run build`가 두 문서와 스타일을 `dist/`에 포함합니다.
- 국외처리 세부 내역은 아직 실제 계약·설정 확인이 필요한 시행 예정안입니다.
  [확인 근거와 운영 보완 사항](docs/legal-review.md)을 확인하세요.

## 운영 관리자

`https://cande.fyi/admin`은 Supabase가 검증한 Google 계정과 비공개 허용 목록으로 접근을 제어합니다. `관리자` 탭에서 이메일 추가, 권한 해제, 다시 허용, 최근 50건의 변경 이력을 제공합니다. 모든 관리자는 같은 권한이며 별도 초대 메일은 보내지 않습니다. 본인·마지막 관리자 해제는 서버에서도 막고, 동시 변경은 직렬화합니다. 해제된 계정의 다음 API 요청부터 거부합니다.

서버는 mental 저장소의 `server/supabase/functions/admin-access` 및 `202609270007_admin_access.sql`입니다. 초기 허용 이메일은 운영 DB에만 등록하고 소스에는 넣지 않습니다. 빌드에는 `ADMIN_SUPABASE_URL`, `ADMIN_SUPABASE_PUBLISHABLE_KEY`만 사용하며 서버 비밀값은 웹에 포함하지 않습니다.

### 사이드바·대시보드 디자인

2026-09-27: 좌측 메뉴를 분석/콘텐츠/설정으로 구분하고, 모바일에서는 포커스 제한·Escape·배경 닫기를 지원하는 메뉴를 사용합니다. 콘텐츠 탭 전환 시 초안은 보존됩니다. 대시보드는 Apache ECharts 6.1.0의 선/막대·툴팁·범례·35구간 초과 확대 슬라이더를 제공합니다. SVG 렌더러와 필요한 모듈만 번들링하며 외부 차트 CDN/분석 서버에 데이터를 보내지 않습니다. ResizeObserver/로그아웃/새 데이터 조회 시 크기 조정과 인스턴스 정리를 수행합니다. 미성숙 리텐션은 null로 표시하고 표의 분모/분자를 유지합니다.

참고: [Linear 사이드바·설정](https://linear.app/changelog/2024-12-18-personalized-sidebar), [Stripe 대시보드 정보 구조](https://docs.stripe.com/dashboard/basics), [ECharts 모듈 가져오기](https://echarts.apache.org/handbook/en/basics/import/). 이 사이트에 맞춘 구현이며 해당 제품의 화면을 복제하지 않았습니다.

### 콘텐츠 목록·상세 편집

상품/FAQ는 검색·노출 필터·5/10/20개 페이지네이션이 있는 테이블이며 기본은 20개입니다. 행/이름/상세 버튼에서 별도 편집 팝업을 열고 서버 초안을 저장합니다. 수정 취소 시 원본 보존, 저장 충돌·네트워크 실패 시 입력 유지, FAQ 추가/삭제/노출 순서 변경을 지원합니다. 상품은 결제 계약을 유지하기 위해 삭제 대신 노출 숨김을 사용합니다. 앱 반영은 기존 `앱에 공개` 단계이며, 팝업 저장 시 같은 초안의 미저장 변경도 함께 저장됨을 안내합니다. 현재 최대7개 상품/50개 FAQ이므로 클라이언트 페이지네이션을 사용하고 서버 revision 충돌 검사를 유지합니다.

### 프롬프트 실험실

`AI 대화 > 프롬프트 실험실`에서 안정형·불안형·회피형의 지침을 편집하고 초안 저장, 앱 공개, 공개 버전 되돌리기를 할 수 있습니다. 테스트는 공개본과 편집 중 문구를 합성 시나리오에서 나란히 실행하며 대화 맥락을 이어가고, 사람 점수·응답 시간·토큰·예상 비용을 비교합니다. 위험 문구 시나리오는 앱과 같은 안전 안내를 모델 호출 없이 확인합니다. Luna none/low와 실험 전용 Sol을 고를 수 있지만 앱의 운영 모델은 Luna none입니다. 관리자별 일일 호출 한도는 서버에서 적용합니다. 결과는 브라우저 탭에만 두고 필요하면 JSON으로 내보냅니다. 실제 사용자 대화나 개인정보를 입력하지 마세요.

서버 구현·모델 비용 근거·검증 범위는 mental 저장소의 `docs/persona-studio-20260930/README.md`를 참고합니다.
