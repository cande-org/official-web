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
같은 기본 포트에서 제공합니다. 이번 작업은 저장소 내 구현이며 원격 배포는 하지 않았습니다.

## 콘텐츠와 동작

- 한국어 기본, KO/EN 전환. 선택 언어만 브라우저에 저장하며 저장소 접근이
  차단되어도 동작합니다. `lang`, 제목, 설명, 접근성 레이블도 전환합니다.
- 회사 소개, 정병발사 소개와 명시된 대화 예시, 문의, 사업자 정보.
- 문의 링크: `mailto:cande.official4@gmail.com`.
- 스토어 주소는 제공되지 않아 임의 다운로드 링크나 출시 상태를 넣지 않았습니다.
- 스크롤 등장, 캐릭터의 작은 움직임, 대화 순차 등장, 진행 표시.
- `prefers-reduced-motion`에서는 움직임을 중단하고 내용을 바로 표시합니다.
- JavaScript가 없어도 기본 한국어 내용과 앵커·메일 링크가 표시됩니다.

## 디자인 출처

기존 앱의 흑백 손글씨에 홈페이지 전용 연노랑/세이지 포인트를 더했습니다.
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
캐릭터·아이콘을 다시 그리지 않았습니다. favicon은 회사 홈페이지용 신규 C 모티프입니다.

## 수정 위치

- 한국어 본문/구조: `index.html`
- 영문 번역, 언어 전환, 스크롤 효과: `main.js`
- 반응형, 모션, 디자인: `style.css`
- 빌드/로컬 서버: `scripts/`

사업자 정보는 사용자가 제공한 상호·등록번호·과세 유형·문의 메일만 기재했습니다.
주소나 대표자 이름 등 제공되지 않은 정보는 임의로 만들지 않았습니다.
