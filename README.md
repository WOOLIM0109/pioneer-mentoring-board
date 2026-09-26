# 파이오니아 멘토링팀 9기 분담표

**배포 주소: https://woolim0109.github.io/pioneer-mentoring-board/**

깃허브 Pages(화면) + 수파베이스(저장소)로 동작하는 팀 분담표.
링크를 열면 누구나 담당자·이름·메모·링크를 바꿀 수 있고, 바뀐 내용은 모든 사람 화면에 바로 반영됨.

## 파일
- `index.html` — 페이지 전체 (디자인·업무 목록·저장 로직)
- `config.js` — 수파베이스 주소·anon 키 (여기만 수정)
- `supabase_schema.sql` — 테이블·권한·실시간 설정 SQL

## 설정 순서 (10분)
1. **수파베이스 프로젝트 생성** — https://supabase.com → New project (리전: Northeast Asia)
2. **SQL 실행** — 대시보드 왼쪽 *SQL Editor* → `supabase_schema.sql` 내용 붙여넣기 → Run
3. **키 복사** — *Project Settings → API* 에서 `Project URL`, `anon public` 키 복사
4. **config.js 수정** — 두 값을 붙여넣기
5. **깃허브에 올리기** — 저장소 만들고 push → *Settings → Pages → Branch: main / root* → 저장
6. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 로 접속. 오른쪽 위에 "팀 공유 · 연결됨" 이 뜨면 완료

## 동작
- 업무 27개는 `index.html` 안에 기본값으로 들어 있고, 바꾼 내용만 수파베이스에 저장됨 → 표가 비어 있어도 처음부터 다 보임
- 담당·함께·메모·이름·링크·팀 추가 업무가 저장 대상
- 실시간은 수파베이스 Realtime(postgres_changes) 사용. 안 되면 새로고침으로도 최신 상태 반영

## 주의
- anon 키는 공개돼도 되는 키지만, 위 SQL은 "링크를 아는 누구나 수정 가능" 정책이므로 **페이지 링크를 챕터 밖에 공유하지 말 것**
- 업무 목록 자체(문구·기본 담당)를 바꾸려면 `index.html` 의 `DEFAULT_TASKS` 수정

## 리뷰·패스포트 알림 (apps-script/Code.gs)
- 패스포트 관리 구글시트에 붙어 있는 Apps Script. 매일 07:00 실행
- 가입날짜 기준 30/90/150/210일 리뷰일과 패스포트 마감(가입+90일)을 계산해 팀 캘린더 "파이오니아 멘토링팀"에 일정 생성
- 시트의 `30일 완료` 등 칸에 O를 넣거나 진도율이 100%가 되면 해당 일정 자동 삭제
- 다가오는 일정은 수파베이스 `board_due` 테이블에 써서 페이지 상단 "다가오는 리뷰 · 패스포트 마감"에 표시
- 시트의 `팀원` 탭에 이메일을 넣으면 일정 게스트로 초대되어 각자 알림을 받음
