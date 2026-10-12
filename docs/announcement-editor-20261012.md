# 공지 본문 글꼴 편집 — 로컬 준비

사용자 요청: 문구를 선택해 프리텐다드/문막체를 혼용. 기본은 프리텐다드이며 문막체는 선택한 문구에만 적용한다. textarea의 선택 범위에 적용하고 본문 미리보기에서 확인한다. 글자를 수정해도 나머지 강조 구간을 보존한다. 새로 입력한 문구는 기본 글꼴이다. HTML은 지원하지 않고 문자 그대로 표시한다.

서버 `admin-announcements` save에 기존 `body`와 `bodyRuns: [{text,font}]`를 전달한다. font는 `pretendard | munmak`이며 runs 전체 문자열이 body와 같아야 한다. 읽기는 `body_runs`로 수신한다. 서버 소스·migration은 mental/server/supabase에 있다. DB → Edge Functions → 어드민 순으로 반영해야 한다. 기존 앱은 plain body로 읽고 새 앱에서 혼용 글꼴을 표시한다. 이번 작업은 로컬이며 원격 push나 배포는 하지 않았다.

검증: npm check/test/build, announcement-browser(선택/적용/저장/재열기/수정/XSS 문자 보존), routing-browser(미저장 경고·뒤로/앞으로·로그인 복귀). 실제 모듈과 가짜 관리자/공지 데이터만 사용했다. 외부 호출과 운영 저장 없음.

본문 미리보기는 앱과 같은 기존 Munmak, 번들 Pretendard-Regular 파일을 사용한다. 서버 허용량은 최대 128구간이며 검증 실패 시 저장 오류를 표시한다.
