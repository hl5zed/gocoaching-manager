# AI_WORKFLOW

## 목적

이 문서는 GOThriveCoaching 프로젝트에서 Claude, Codex, Cursor, ChatGPT, Gemini를 함께 사용할 때  
작업 속도, 안정성, 비용 효율을 유지하기 위한 **운영 가이드**입니다.

핵심 원칙:

> **AI를 많이 쓰는 것이 아니라, AI를 역할별로 통제하는 것이 핵심이다.**


---

## 1. 기본 원칙

- 한 번에 하나의 기능만 진행한다.
- 이미 동작하는 모듈은 함부로 다시 생성하지 않는다.
- DB, 권한, 초대, 역할 부여 로직은 특히 보수적으로 다룬다.
- AI에게 “전체를 다시 만들어 달라”는 요청을 하지 않는다.
- 문제가 생기면 **에러 메시지 기준으로 최소 수정**한다.
- 한 기능이 안정화되면 LOCK 상태로 간주하고 다음 기능으로 넘어간다.


---

## 2. AI 역할 분담

### ChatGPT
- 기획
- 작업 단위 분해
- 우선순위 정리
- 명령어/프롬프트 초안 작성
- 다음 작업 제안

### Claude
- 새 기능 생성
- UI/페이지/폼/초기 구조 작성
- 새로운 읽기/쓰기 흐름 초안 구현

### Codex
- 오류 수정
- 타입 에러 해결
- 빌드 실패 해결
- 기존 기능 안정화
- 작은 범위 리팩터링

### Cursor
- 작업 환경
- 빠른 코드 탐색
- 파일 비교
- 로컬 코드 검토
- 수동 편집 보조

### Gemini
- 필요할 때만 보조
- 아이디어 비교
- 문장 대안
- 보조 분석

권장 운영:
- **새 기능 생성은 Claude**
- **오류 수정과 안정화는 Codex**
- **작업 설계는 ChatGPT**
- **탐색과 사람 편집은 Cursor**
- **Gemini는 보조용**


---

## 3. 현재 LOCK 대상 모듈

아래 항목은 현재 프로젝트의 핵심 동작 흐름이므로, 특별한 이유가 없으면 수정하지 않는다.

### 초대/인증 흐름
- invitation creation
- invitation email sending
- invitation acceptance RPC
- profile creation
- role assignment

### 대시보드/관리자 흐름
- dashboard role links
- admin users list

### i18n Maintenance Automation LOCK
- i18n audit automation added
- i18n missing key checker added
- scripts/i18n-audit.mjs
- scripts/i18n-check-missing-keys.mjs
- npm run i18n:audit
- npm run i18n:check
- npm run verify:i18n
- i18n 잔여 한글 문구 리포트 자동화
- ko/en 번역 누락 키 점검 자동화

보호 원칙:
- i18n 점검 자동화는 기존 localStorage + profiles.preferred_locale 저장 흐름을 변경하지 않는다.
- `/ko`, `/en` 라우팅 구조를 도입하지 않는다.
- next-intl 등 새 i18n 라이브러리를 설치하지 않는다.
- DB, RLS, API, 인증/권한 흐름은 i18n 점검 자동화 작업에서 수정하지 않는다.

### Admin User Management UX Stabilization LOCK
- admin user management UX 1st-3rd stabilization
- admin user search
- admin user role filter
- admin user active/inactive status filter
- admin user role badges
- admin user status badges
- admin user client-side sorting
- admin user client-side pagination
- admin user detail panel
- admin user detail panel top close button
- admin user detail panel scroll/responsive layout
- admin direct registration collapsible form
- 회원 검색
- role 필터
- active/inactive 필터
- 역할/상태 배지
- 정렬
- 페이지네이션
- 상세보기 패널
- 상세 패널 닫기 버튼 상단 배치
- 상세 패널 스크롤/반응형 개선
- 등록 폼 접기/펼치기

검증 기록:
- `npm run typecheck`: passed
- `npm run lint`: passed; ESLint config not found, so lint was skipped

회귀 금지:
- 직접 회원등록 기능
- 중복 이메일 처리
- 회원목록 조회
- 검색/role 필터/상태 필터
- 역할/상태 배지
- 정렬/페이지네이션
- 상세보기 패널
- 로그인 안내 복사
- 역할 변경
- 비활성화/재활성화
- 관리자 본인 보호
- super_admin 보호
- 비관리자 API 접근 차단

## LOCK - Admin Dashboard User Summary

Completed:
- admin dashboard user summary cards
- total users count
- active users count
- inactive users count
- users with role count
- users without role count
- dynamic role-based user count
- Korean role label display
- admin dashboard link to user management

Role Label Mapping:
- church_admin: 교회 관리자
- coach: 코치
- coach_maker: 코치메이커
- coachee: 코칭 대상자
- organization_admin: 기관 관리자
- super_admin: 최고 관리자

Route/Area:
- /admin
- /admin/users
- admin dashboard
- admin user summary
- profile-based role statistics

Validation:
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script
- `npm run dev`: admin dashboard confirmed

Do not regress:
- existing login flow
- existing admin access flow
- existing /admin/users functionality
- existing role/permission structure
- existing Supabase Auth structure
- existing RLS policies
- role original values must not be changed in DB
- Korean labels are display-only

## LOCK - Coach Maker Moksilgi Progress UX Stabilization

Completed:
- /coach-maker/moksilgi-progress page stabilization
- moksilgi team progress table
- moksilgi region/team progress view
- moksilgi up-to-current achievement summary
- moksilgi 12-month achievement view
- search by name/region/team
- region filter
- team filter
- sorting
- progress status badge
- empty/error state handling
- responsive table layout

Validation:
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing coach-maker access flow
- existing moksilgi data structure
- existing moksilgi monthly summaries
- existing moksilgi achievement calculation
- existing /coach-maker/moksilgi-progress route
- existing /coach-maker/moksilgi-progress/[planId] detail link
- existing empty/error state handling
- existing service-role safety pattern
- existing RLS policies
- Korean-first UI labels

## LOCK - Coach Maker Moksilgi Progress UX and Detail Panel

Completed:
- /coach-maker/moksilgi-progress page stabilization
- moksilgi progress summary cards
- moksilgi 12-month achievement view
- search by name/region/team
- region filter
- team filter
- sorting
- progress status badge
- filter reset
- responsive table layout
- detail button per row
- read-only detail panel/modal
- detail panel close button

Validation:
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script
- browser check: /coach-maker/moksilgi-progress 정상 작동 확인

Do not regress:
- existing coach-maker access flow
- existing moksilgi progress summary cards
- existing search by name/region/team
- existing region/team filters
- existing sorting
- existing progress status badge
- existing filter reset
- existing responsive 12-month table layout
- existing read-only detail panel/modal
- existing detail panel close button
- existing empty/error state handling
- existing moksilgi data structure
- existing moksilgi achievement calculation
- existing service-role safety pattern
- existing RLS policies
- no edit/delete/input actions in the progress dashboard

## LOCK - Coach Maker Dashboard Moksilgi Summary

Completed:
- coach-maker dashboard moksilgi summary cards
- total moksilgi target count
- in-progress/completed/incomplete count
- up-to-current average achievement rate
- 12-month average achievement rate
- progress status badge
- link to /coach-maker/moksilgi-progress
- empty/error state handling
- responsive dashboard card layout

Validation:
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing /coach-maker dashboard
- existing /coach-maker/moksilgi-progress functionality
- existing search/filter/sorting/detail panel in moksilgi progress
- existing moksilgi data structure
- existing coach-maker permission flow
- existing service-role safety pattern
- existing RLS policies
- no edit/delete/input actions in dashboard summary

## LOCK - Coach Maker Action Notes DB Storage

Completed:
- coach_action_notes table
- action note list
- action note create
- action note complete
- action note soft delete
- profile.id based created_by
- DB persisted action notes
- Korean label display
- permission-safe action note API

Validation:
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing /coach-maker dashboard
- existing moksilgi summary cards
- existing attention target summary
- existing attention target detail link
- existing /coach-maker/moksilgi-progress functionality
- existing action note list/create/complete/soft delete behavior
- existing profile.id based created_by behavior
- existing permission-safe action note API
- existing RLS policies
- existing admin user management functionality

## LOCK - Coach Maker Action Notes Detail Edit Panel

Completed:
- action note detail panel
- action note read-only detail view
- action note edit mode
- PATCH API based update
- editable fields: action_type, priority, status, note, due_date, team_name, region
- edit save
- edit cancel
- detail panel close button
- list refresh after update
- selected note refresh after update

Route/Area:
- /coach-maker
- ActionMemoDrafts
- /api/coach-maker/action-notes/[id]
- PATCH action note update

Validation:
- detail view: passed
- edit mode: passed
- PATCH update: passed
- edit cancel: passed
- list refresh: passed
- existing search/filter/sort/pagination: maintained
- memo create/complete/soft delete: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- action note DB storage
- profile.id based created_by
- soft delete with deleted_at
- existing action note search/filter/sort/pagination
- existing status/priority/due date badges
- existing /coach-maker dashboard
- existing moksilgi summary cards
- existing role/permission structure
- existing Supabase Auth structure
- existing RLS policies

## LOCK - Coach Maker Action Notes Full UX

Completed:
- coach_action_notes DB storage
- action note list
- action note create
- action note complete
- action note soft delete with deleted_at
- profile.id based created_by
- permission-safe action note API
- Korean action type labels
- Korean priority labels
- Korean status labels
- action note search
- status filter
- priority filter
- target type filter
- status badge
- priority badge
- sorting
- pagination
- due date display
- due date status badge
- action note detail panel
- action note edit panel
- PATCH API based update
- coach/team action note summary cards
- team-based note summary
- target-based note summary
- target-type note summary

Route/Area:
- /coach-maker
- /api/coach-maker/action-notes
- /api/coach-maker/action-notes/[id]
- coach_action_notes
- ActionMemoDrafts

Validation:
- memo create: passed
- memo list: passed
- memo refresh persistence: passed
- memo complete: passed
- memo soft delete: passed
- memo detail panel: passed
- memo edit panel: passed
- search/filter/sort/pagination: passed
- due date display: passed
- coach/team summary cards: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing /coach-maker dashboard
- existing moksilgi summary cards
- existing attention target summary
- existing /coach-maker/moksilgi-progress link
- existing action note DB storage
- existing action note API routes
- profile.id based created_by
- soft delete with deleted_at
- existing role/permission structure
- existing Supabase Auth structure
- existing RLS policies
- existing action note search/filter/sort/pagination UX
- existing action note detail/edit panel

## LOCK - Coach Maker Action Notes Drilldown UX

Completed:
- action note summary drilldown
- team-based drilldown
- target-based drilldown
- target type drilldown
- high priority drilldown
- status-based drilldown
- overdue note drilldown
- active drilldown condition display
- drilldown reset
- drilldown with search/filter/sort/pagination
- detail/edit panel maintained during drilldown

Route/Area:
- /coach-maker
- ActionMemoDrafts
- coach/team action note summary cards
- action note list drilldown

Validation:
- team drilldown: passed
- target drilldown: passed
- target type drilldown: passed
- high priority drilldown: passed
- status drilldown: passed
- overdue drilldown: passed
- reset drilldown: passed
- existing note create/edit/complete/soft delete: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- action note DB storage
- action note create
- action note detail/edit panel
- action note complete
- action note soft delete
- action note search/filter/sort/pagination
- status/priority/due date badges
- profile.id based created_by
- existing /coach-maker dashboard
- existing moksilgi summary cards
- existing RLS policies

## LOCK - Coach Maker Action Notes Drilldown Stabilization

Completed:
- action note drilldown filter
- today due note drilldown
- this week due note drilldown
- overdue note drilldown
- high priority incomplete drilldown
- status based drilldown
- drilldown reset
- filter reset
- drilldown with search/filter/sort/pagination
- archived status filter conflict fix
- notes source list preserved during drilldown reset
- currentPage reset on drilldown/filter changes

Validation:
- drilldown reset: passed
- filter reset: passed
- status filter conflict fixed
- memo create: maintained
- memo detail/edit: maintained
- memo complete: maintained
- memo soft delete: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed

Do not regress:
- original notes list must not be reset by drilldown reset
- drilldownFilter null must start from original notes
- filter reset and drilldown reset must remain separate
- existing action note DB storage
- existing action note detail/edit panel
- existing search/filter/sort/pagination
- profile.id based created_by
- soft delete with deleted_at

## LOCK - Coach Maker Action Notes Quick Update UX

Completed:
- action note status quick update
- action note priority quick update
- PATCH API based quick update
- status quick change: open / in_progress / completed / archived
- priority quick change: low / normal / high
- quick update loading state
- quick update success/error handling
- selected note refresh after quick update
- list refresh after quick update
- existing filter/drilldown behavior maintained

Route/Area:
- /coach-maker
- ActionMemoDrafts
- /api/coach-maker/action-notes/[id]
- PATCH action note quick update

Validation:
- status quick update: passed
- priority quick update: passed
- selected detail panel refresh: passed
- existing memo create/edit/complete/soft delete: maintained
- existing search/filter/sort/pagination: maintained
- existing drilldown: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- action note DB storage
- action note create
- action note detail/edit panel
- action note complete
- action note soft delete
- action note search/filter/sort/pagination
- action note drilldown
- profile.id based created_by
- existing RLS policies
- existing role/permission structure

## LOCK - Coach Maker Dashboard Full UX

Completed:
- coach-maker dashboard full UX organization
- moksilgi summary card layout
- attention target summary layout
- link to /coach-maker/moksilgi-progress
- action notes summary layout
- today/this week action notes summary
- coach/team action notes summary cards
- action note search/filter/sort/pagination UX
- action note drilldown UX
- action note quick status update
- action note quick priority update
- action note detail/edit panel
- responsive dashboard layout
- consistent button labels
- improved success/error/empty state message placement

Route/Area:
- /coach-maker
- /coach-maker/moksilgi-progress
- ActionMemoDrafts
- coach-maker dashboard
- moksilgi summary cards
- attention target summary
- action notes dashboard area

Korean Keywords:
- 코치메이커 대시보드
- 목실기 요약 카드
- 관심 필요 대상자 요약
- 전체 목실기 현황 보기
- 관리 액션 메모
- 오늘/이번 주 처리 필요
- 코치/팀별 메모 요약
- 메모 검색/필터/정렬
- 메모 드릴다운
- 메모 빠른 상태 변경
- 메모 빠른 우선순위 변경
- 메모 상세보기/수정 패널

Validation:
- /coach-maker browser check: passed
- moksilgi summary cards: passed
- attention target summary: passed
- action notes create/edit/complete/soft delete: passed
- action notes search/filter/sort/pagination: passed
- action notes drilldown: passed
- action notes quick status/priority update: passed
- responsive dashboard layout: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing login flow
- existing coach-maker access flow
- existing moksilgi data structure
- existing moksilgi summary calculation
- existing /coach-maker/moksilgi-progress page
- existing action note DB storage
- existing action note API routes
- profile.id based created_by
- soft delete with deleted_at
- existing action note detail/edit panel
- existing action note search/filter/sort/pagination
- existing action note drilldown
- existing role/permission structure
- existing Supabase Auth structure
- existing RLS policies

## LOCK - Coach Maker Report Export CSV

Completed:
- action notes CSV export
- action notes current filtered result export
- action notes UTF-8 BOM CSV support
- action notes CSV escape handling
- action notes Korean label export
- moksilgi progress CSV export
- moksilgi current filtered result export
- moksilgi search/filter/sort result export
- moksilgi monthly progress CSV columns
- moksilgi UTF-8 BOM CSV support
- moksilgi CSV escape handling
- empty export state handling
- CSV file name with date

Route/Area:
- /coach-maker
- /coach-maker/moksilgi-progress
- ActionMemoDrafts
- MoksilgiProgressClientTable
- action notes CSV export
- moksilgi progress CSV export

Korean Keywords:
- 코치메이커 보고서
- CSV 내보내기
- 관리 액션 메모 CSV
- 목실기 현황표 CSV
- 현재 필터 결과 내보내기
- 한글 CSV 깨짐 방지
- UTF-8 BOM
- 월별 목실기 진행 현황 내보내기

Validation:
- action notes CSV export: passed
- action notes filtered result export: passed
- moksilgi progress CSV export: passed
- moksilgi filtered result export: passed
- Korean CSV display: passed
- empty export state: passed
- existing action notes features: maintained
- existing moksilgi progress features: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing /coach-maker dashboard
- existing action notes DB storage
- existing action notes search/filter/sort/pagination
- existing action notes detail/edit panel
- existing action notes quick status/priority update
- existing /coach-maker/moksilgi-progress page
- existing moksilgi search/region filter/team filter/sort
- existing moksilgi detail panel
- existing moksilgi summary cards
- existing role/permission structure
- existing Supabase Auth structure
- existing RLS policies
- CSV export must not expose tokens, passwords, service keys, or internal secrets

## LOCK - Coach Maker Printable Report View

Completed:
- /coach-maker/report printable report page
- coach-maker operation report layout
- moksilgi summary report section
- attention target report section
- action notes summary report section
- priority/overdue action notes report section
- print button with client component
- PrintReportButton component
- window.print() based print action
- script tag console error fixed
- dashboard return button
- print-friendly layout

Route/Area:
- /coach-maker/report
- /coach-maker
- PrintReportButton
- printable report layout
- browser print/PDF flow

Validation:
- /coach-maker/report browser check: passed
- print button: passed
- script tag console error fixed: passed
- dashboard return button: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing /coach-maker dashboard
- existing action notes features
- existing moksilgi summary data
- existing CSV export
- existing print report layout
- print button must remain client component
- do not reintroduce script tag inside React component

### 코칭 관계 흐름
- coaching relationships table
- coach relationships
- my-coaching

### 주간 기록 흐름
- weekly_logs table
- weekly log creation
- coach weekly logs list page
- /coach/weekly-logs
- coach home to weekly logs navigation
- 코치용 주간 기록 목록 조회
- 코치 홈 → 주간 기록 보기 연결
- coach feedback writing for weekly logs
- /coach/weekly-logs/[id]/feedback
- coach feedback draft save
- coach feedback publish
- 코치 주간 기록 피드백 작성 기능
- 코치 피드백 임시 저장
- 코치 피드백 게시
- coachee feedback read-only view
- /my-coaching/feedback
- coachee received feedback view
- 코치이 받은 피드백 보기 기능
- 코치이 피드백 읽기 전용 페이지
- coachee goals management v1
- /my-coaching/goals
- coachee goal create
- coachee goal list
- coachee goal status update
- 코치이 목표 관리 1차 기능
- 코치이 목표 작성
- 코치이 목표 목록
- 코치이 목표 상태 변경
- moksilgi personal achievement summary
- /my-coaching/moksilgi/summary
- moksilgi yearly summary table
- moksilgi cumulative achievement row
- moksilgi total achievement rate
- 목실기 개인 성취표
- 목실기 연간 요약표
- 목실기 누적 성취율
- coach moksilgi read-only detail
- /coach/moksilgi/[planId]
- coach assigned coachee moksilgi detail
- coach moksilgi yearly summary detail
- 코치용 목실기 상세 보기
- 담당 코치이 목실기 상세 조회
- coach-maker moksilgi progress dashboard
- /coach-maker/moksilgi-progress
- moksilgi team progress table
- moksilgi 12-month team achievement view
- moksilgi up-to-current achievement summary
- 코치메이커 전체 목실기 성취 현황
- 목실기 지역/팀 성취 현황표

### UI/라벨 구조
- Korean-first UI
- i18n label structure

원칙:
- 위 항목은 **작동 중인 기준 흐름**이다.
- 새 기능이 이 영역과 충돌하면 먼저 설계를 다시 확인한다.
- LOCK 대상은 “전면 재작성” 금지, “최소 수정”만 허용한다.


---

## 4. Single Source of Truth

이 프로젝트에서 출처가 분명해야 하는 핵심 파일들:

### DB schema
- `supabase/migrations`

### Type source
- `src/types/database.ts`

### RPC types
- `src/types/rpc.ts`

### Route access
- `src/lib/auth/route-access.ts`

### UI labels / i18n
- `src/lib/ui/labels.ts`

규칙:
- 스키마는 migration을 기준으로 본다.
- 타입은 `src/types/database.ts`를 기준으로 본다.
- 라우트 접근 규칙은 `src/lib/auth/route-access.ts`를 기준으로 본다.
- 표시용 라벨은 `src/lib/ui/labels.ts`를 기준으로 본다.
- AI가 임의로 새로운 truth source를 만들지 않도록 한다.


---

## 5. 개발 흐름

프로젝트의 표준 AI 개발 흐름:

### [1] 설계
- ChatGPT로 작업 단위를 쪼갠다.
- 영향을 받는 파일만 좁힌다.
- LOCK 대상과 충돌하는지 먼저 확인한다.

### [2] 기능 생성
- Claude에게 **작은 범위**로 기능 생성을 맡긴다.
- 페이지 1개, helper 1개, API 1개 정도의 단위가 적당하다.

### [3] 코드 통합
- Cursor 또는 사람이 diff를 확인한다.
- 파일 범위가 설계와 맞는지 본다.
- 불필요한 광범위 수정이 없는지 본다.

### [4] 오류 수정
- Codex로 타입 에러, 빌드 에러, 런타임 오류를 최소 수정한다.
- 에러 메시지 기준으로 해결한다.

### [5] 테스트
- `npm run typecheck`
- `npm run check:all`
- `npm run build`
- 브라우저 수동 테스트

### [6] LOCK
- 기능이 안정화되면 해당 흐름을 LOCK으로 간주한다.
- 다음 기능부터는 이 영역을 함부로 다시 쓰지 않는다.

### [7] 다음 기능
- 다음 기능은 기존 LOCK 흐름을 최대한 재사용하는 방향으로 진행한다.


---

## 6. 비용 절약 규칙

- 전체 프로젝트 재생성을 요청하지 않는다.
- 수정 파일 범위를 명확히 제한한다.
- 에러 메시지를 그대로 주고 그 문제만 고치게 한다.
- LOCK 모듈은 건드리지 않게 명시한다.
- 한 번에 하나의 모듈만 작업한다.
- 이미 동작하는 모듈을 여러 AI에게 반복해서 다시 쓰게 하지 않는다.
- 같은 기능을 Claude, Codex, Gemini에게 동시에 재작성 요청하지 않는다.
- “작은 기능 생성 → 최소 수정 → 검증” 순서를 지킨다.

좋은 예:
- “`src/app/my-coaching/weekly-log/page.tsx`와 `src/lib/api/my-coaching/weekly-log.ts`만 수정”

좋지 않은 예:
- “이 프로젝트 전체를 정리해서 다시 만들어줘”


---

## 7. Claude 프롬프트 템플릿

아래 템플릿을 새 기능 생성용 기본값으로 사용한다.

```md
You are working on the GOThriveCoaching platform.

Task:
<구체적인 작업 한 줄>

Files to create or update:
- <파일 1>
- <파일 2>

Do not modify:
- invitation acceptance RPC
- invitation creation logic
- auth/role security rules
- locked modules unless directly necessary

Requirements:
1. Keep the change minimal.
2. Preserve existing business logic.
3. Use existing shared types from src/types/database.ts.
4. Do not add any.
5. Do not add @ts-ignore.
6. Do not expose raw DB rows, tokens, token_hash, auth metadata.

Verification:
Run:
- npm run typecheck
- npm run check:all
- npm run build

Return:
- files changed
- exact behavior added
- anything intentionally not changed
```


---

## 8. Codex 프롬프트 템플릿

아래 템플릿을 오류 수정/안정화용 기본값으로 사용한다.

```md
You are working on the GOThriveCoaching platform.

Issue:
<실제 에러 메시지 또는 잘못된 동작>

Task:
Fix only this issue with the smallest safe change.

Files to inspect:
- <파일 1>
- <파일 2>

Do not modify:
- SQL migrations
- invitation acceptance RPC
- auth/role rules unless directly required
- locked modules unless directly necessary

Requirements:
1. Root-cause the error.
2. Fix only the unsafe or broken part.
3. Preserve business logic.
4. Do not add any.
5. Do not add @ts-ignore.

Verification:
Run:
- npm run typecheck
- npm run check:all
- npm run build

Return:
- root cause
- exact fix
- files changed
- verification result
```


---

## 9. 검증 체크리스트

기능 작업 후 기본 검증 순서:

### 자동 검증
- `npm run typecheck`
- `npm run check:all`
- `npm run build`

### 수동 브라우저 테스트
- 해당 페이지 열기
- 로그인/권한 흐름 확인
- 버튼/링크 동작 확인
- 폼 제출 확인
- 에러 문구 확인
- 브라우저 콘솔 확인

### Supabase SQL 검증
DB row 생성/변경이 있는 경우:
- SQL Editor에서 row 확인
- 필요한 index/constraint 확인
- nullable/ownership 조건 확인


---

## 10. DB 안전 수칙

- 스키마는 **명시적으로 필요할 때만** 변경한다.
- destructive command를 실행하지 않는다.
- `supabase db reset`은 **사람의 명시적 승인 없이는 절대 사용하지 않는다**.
- migration 파일은 사람이 직접 Supabase SQL Editor에서 적용하고 검증한다.
- 부분 적용된 migration은 재실행 안전성(idempotent)을 반드시 고려한다.


---

## LOCK - Coach Maker Printable Report PDF Layout

### Completed
- `/coach-maker/report` printable report page
- browser print/PDF layout
- A4 portrait print layout
- print button with `window.print()`
- `PrintReportButton` client component
- print-only button/navigation hiding
- report section flow improvement
- removed forced page breaks between sections
- moksilgi summary section continuous print flow
- attention target section continuous print flow
- action notes summary section continuous print flow
- priority/overdue action notes section continuous print flow
- print-friendly card/table styling
- long text wrapping for print

### Route/Area
- `/coach-maker/report`
- `PrintReportButton`
- printable report layout
- browser print/PDF flow

### Validation
- `/coach-maker/report` browser check: passed
- print button: passed
- A4 print preview: passed
- forced page break removal: passed
- continuous section flow: passed
- button/navigation hidden in print: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

### Do not regress
- do not reintroduce script tag inside React component
- print button must remain client component
- report sections should not force new A4 page unless explicitly required
- existing `/coach-maker` report data
- existing moksilgi summary report
- existing attention target report
- existing action notes report
- existing CSV export
- existing role/permission structure

---

## LOCK - Coach Maker Report Filters

### Completed
- `/coach-maker/report` filter support
- report year filter
- report team filter
- report date range filter
- URL query based report filters
- `ReportFilters` client component
- applied filter summary display
- print-safe filter UI hiding
- filter summary included in print output
- empty filtered report state
- report print layout maintained
- `PrintReportButton` maintained

### Route/Area
- `/coach-maker/report`
- `/coach-maker`
- `ReportFilters`
- `PrintReportButton`
- printable report filters
- browser print/PDF report flow

### Korean Keywords
- 코치메이커 보고서 필터
- 연도별 보고서
- 팀별 보고서
- 기간별 보고서
- 인쇄용 보고서
- PDF 저장용 보고서
- 적용된 필터 표시
- 필터 조건 인쇄 포함
- 필터 입력 UI 인쇄 숨김

### Validation
- `/coach-maker/report` browser check: passed
- year filter: passed
- team filter: passed
- date range filter: passed
- applied filter summary: passed
- print button: passed
- filter UI hidden in print: passed
- applied filter summary included in print: passed
- empty filtered state: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

### Do not regress
- existing `/coach-maker/report` layout
- existing `PrintReportButton` client component
- existing browser print/PDF flow
- existing report section continuous flow
- existing `/coach-maker` dashboard
- existing Action Notes features
- existing CSV export
- existing moksilgi summary report
- existing attention target report
- existing action notes report
- do not reintroduce script tag inside React component
- do not force each report section onto a new A4 page unless explicitly requested

---

## LOCK - Coach Maker Report Auto Summary

### Completed
- `/coach-maker/report` auto summary sentence
- report top summary text
- year/team/date range aware summary
- empty report data message
- NaN/Infinity/undefined/null display prevention
- print/PDF summary inclusion
- report filters connected to summary text
- existing report sections maintained
- existing browser print/PDF flow maintained

### Route/Area
- `/coach-maker/report`
- `ReportFilters`
- `PrintReportButton`
- printable report summary
- browser print/PDF report flow

### Korean Keywords
- 보고서 상단 요약 문장
- 자동 요약 문장
- 연도별 보고서 요약
- 팀별 보고서 요약
- 기간별 보고서 요약
- 선택한 조건에 해당하는 보고서 데이터가 없습니다
- 인쇄/PDF 요약 포함

### Validation
- `npm run typecheck`: passed
- `/coach-maker/report` page render: passed
- auto summary sentence display: passed
- year filter summary update: passed
- team filter summary update: passed
- date range filter summary update: passed
- empty filtered report message: passed
- no NaN/Infinity/undefined/null display: passed
- print preview summary inclusion: passed
- existing report sections maintained: passed
- existing PDF/print output maintained: passed
- `npm run lint`: passed or skipped according to current lint script

### Do not regress
- existing `/coach-maker/report` layout
- existing report filters
- existing `PrintReportButton` client component
- existing browser print/PDF flow
- existing report section continuous flow
- existing moksilgi summary report
- existing attention target report
- existing action notes report
- existing `/coach-maker` dashboard
- existing CSV export
- do not show NaN, Infinity, undefined, or null in report UI
- do not reintroduce script tag inside React component
- do not force each report section onto a new A4 page unless explicitly requested

---

## LOCK - Coach Maker Operations Checklist

### Completed
- 운영 전 최종 점검 체크리스트
- 로그인/권한 점검
- 코치메이커 대시보드 점검
- 목실기 현황 점검
- 관리 액션 메모 점검
- CSV 내보내기 점검
- 인쇄용 보고서/PDF 출력 점검
- 보고서 필터/자동 요약 점검
- 문제 발생 시 확인 항목 정리

### File
- `CHECKLIST.md`

### Do not regress
- existing `/coach-maker` dashboard
- existing `/coach-maker/moksilgi-progress`
- existing `/coach-maker/report`
- existing action notes features
- existing CSV export
- existing browser print/PDF flow
- existing role/permission structure
- existing Supabase Auth structure

---

## 11. 보안 수칙

- service role key를 절대 노출하지 않는다.
- Resend API key를 절대 노출하지 않는다.
- raw invitation token을 절대 노출하지 않는다.
- `token_hash`를 절대 노출하지 않는다.
- auth metadata를 UI에 보여주지 않는다.
- raw DB row를 그대로 UI에 넘기지 않는다.
- 역할 정보를 쿠키/localStorage/JWT에 임의로 저장하지 않는다.


---

## 12. 앞으로의 추천 로드맵

현재 상태를 기준으로 다음 우선순위를 추천한다.

1. `/coach/weekly-logs`
2. `/coach/weekly-logs/[id]`
3. coach feedback
4. `/my-coaching/goals`
5. coach dashboard metrics
6. admin dashboard metrics

권장 순서 이유:
- 이미 `weekly_logs`와 `my-coaching/weekly-log`가 있으므로
  coach가 읽는 흐름을 먼저 붙이는 것이 자연스럽다.
- 그 다음 피드백 흐름을 붙이면 coach/coachee 루프가 완성된다.
- metrics는 가장 나중에 붙여도 된다.


---

## 13. 실전 운영 규칙

### 새 기능을 시작하기 전
- 먼저 LOCK 대상인지 확인
- 영향 파일 2~4개 수준으로 줄이기
- DB 변경이 꼭 필요한지 먼저 확인

### 오류가 났을 때
- 에러 메시지를 그대로 저장
- 해당 파일만 좁혀서 Codex에 수정 요청
- “전체 리팩터링” 금지

### 동작이 성공한 뒤
- 바로 LOCK 대상으로 분류
- 다음 AI에게는 “이 흐름은 이미 동작함, 수정 금지”를 명시


---

## Cursor review checklist

Cursor는 새 기능을 직접 크게 생성하는 역할보다, **작업 범위 확인, 변경 검토, 안전성 점검** 역할에 집중한다.

### 기본 확인
- `AI_WORKFLOW.md` 파일이 프로젝트 루트에 존재하는지 먼저 확인한다.
- 이번 작업에서 **허용된 파일 범위**가 무엇인지 먼저 읽고 정리한다.
- 실제로 변경된 파일 목록이 무엇인지 확인한다.

### LOCK 검토
- 이번 변경이 LOCK된 기능 파일을 건드렸는지 확인한다.
- 아래 경로가 바뀌었는지 특히 주의해서 본다:
  - `src/`
  - `supabase/`
  - `package.json`
  - `migrations`
- 사용자가 허용하지 않은 LOCK 흐름 수정이 있으면 바로 보고한다.

### 변경 규모 검토
- 변경 파일 수가 너무 많으면 작업 중단을 권고한다.
- 한 기능 작업인데 여러 모듈을 동시에 광범위하게 수정했다면 재설계를 권고한다.
- “작은 범위, 명확한 책임” 원칙을 벗어나면 다음 단계로 넘기지 않는다.

### 읽기 전용 검토 기준
- 코드 수정 없이 읽기/확인만 수행할 때는 다음을 본다:
  - 요구사항과 실제 변경 파일이 일치하는지
  - 비허용 파일이 수정되지 않았는지
  - 기능 범위 밖의 리팩터링이 섞이지 않았는지
  - LOCK된 영역이 불필요하게 다시 작성되지 않았는지

### 수정 필요 시 원칙
- Cursor가 파일 수정을 해야 하는 경우, **반드시 사용자 승인 후 진행**한다.
- 승인 전에는 읽기, diff 확인, 문제 지적, 범위 제안까지만 한다.

### 변경 검토 방법
- `git diff` 또는 변경 파일 목록을 먼저 확인한 뒤 보고한다.
- 보고할 때는 아래 순서로 정리한다:
  1. 변경 파일 목록
  2. 허용 범위 일치 여부
  3. LOCK 파일 수정 여부
  4. 과도한 변경 여부
  5. 다음 단계 진행 가능 여부

### 다음 단계 판단
- 변경 범위가 작고, LOCK 규칙을 지켰고, 요구사항과 파일 범위가 맞으면 다음 기능 작업으로 넘어가도 된다.
- 반대로 아래 중 하나라도 해당하면 다음 기능으로 넘어가지 않는다:
  - 허용되지 않은 파일 수정
  - LOCK 모듈의 불필요한 변경
  - 지나치게 많은 파일 수정
  - 요구사항과 무관한 리팩터링
  - 검토 없이 바로 추가 작업을 이어가는 경우


---

## 14. 한 줄 운영 요약

- **ChatGPT는 설계**
- **Claude는 생성**
- **Codex는 안정화**
- **Cursor는 탐색과 검토**
- **Gemini는 보조**

그리고 항상:

> **작은 범위, 명확한 책임, 검증 후 LOCK**

## LOCK - My Coaching Daily Monthly Records Navigation

Completed:
- /my-coaching/records page
- daily record card linked to /my-coaching/records/daily
- weekly record card linked to /my-coaching/weekly-log
- monthly reflection card linked to /my-coaching/records/monthly
- daily_records API/helper maintained
- monthly_reflections API/helper maintained
- existing weekly-log maintained
- existing moksilgi monthly checklist maintained
- no DB/API/RLS changes in navigation cleanup

Route/Area:
- /my-coaching/records
- /my-coaching/records/daily
- /my-coaching/records/monthly
- /my-coaching/weekly-log
- /my-coaching/moksilgi/monthly

Validation:
- records navigation: passed
- daily record link: passed
- weekly-log link: passed
- monthly reflection link: passed
- existing weekly-log save logic: maintained
- existing moksilgi monthly checklist: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed; ESLint config not found, so lint was skipped

Do not regress:
- existing /my-coaching/weekly-log
- existing weekly_logs table
- existing /my-coaching/moksilgi/monthly
- daily_records API/helper
- monthly_reflections API/helper
- profile.id based ownership
- no other member records visible in my-coaching

## LOCK - My Coaching Weekly Log Review

Completed:
- /my-coaching/weekly-log review section
- weekly log self-review display
- weekly log draft save maintained
- weekly log submit maintained
- weekly log status badge
- weekly log refresh persistence
- current user weekly logs only
- existing daily records maintained
- existing monthly reflections maintained
- existing moksilgi monthly checklist maintained

Route/Area:
- /my-coaching/weekly-log
- /my-coaching/records
- weekly_logs
- my coaching records

Korean Keywords:
- 주간 기록
- 주간 돌아보기
- 나의 주간 기록
- 임시저장
- 제출완료
- 작성 기록 확인
- 마이코칭 기록

Validation:
- weekly log draft save: passed
- weekly log submit: passed
- weekly log review display: passed
- weekly log refresh persistence: passed
- owner-only record display: passed
- existing daily records: maintained
- existing monthly reflections: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing weekly_logs table
- existing weekly-log server action
- existing coaching relationship selection
- existing daily_records feature
- existing monthly_reflections feature
- existing moksilgi monthly checklist
- profile.id based ownership
- no other member records visible in my-coaching

## LOCK - My Coaching Records Overview

Completed:
- /my-coaching/records overview page
- daily/weekly/monthly records navigation
- recent daily records preview
- recent weekly logs preview
- recent monthly reflections preview
- Korean status badges
- Korean visibility/share badges
- empty state messages for daily/weekly/monthly records
- owner-only record display
- daily record link maintained
- weekly log link maintained
- monthly reflection link maintained

Route/Area:
- /my-coaching/records
- /my-coaching/records/daily
- /my-coaching/weekly-log
- /my-coaching/records/monthly
- daily_records
- weekly_logs
- monthly_reflections

Korean Keywords:
- 나의 기록
- 최근 나의 기록
- 하루 기록
- 주간 기록
- 월간 회고
- 기록 통합 화면
- 임시저장
- 제출완료
- 검토완료
- 나만 보기
- 코치에게 공유

Validation:
- /my-coaching/records page: passed
- recent daily records preview: passed
- recent weekly logs preview: passed
- recent monthly reflections preview: passed
- daily record navigation: passed
- weekly log navigation: passed
- monthly reflection navigation: passed
- owner-only record display: passed
- existing daily record functions: maintained
- existing weekly-log functions: maintained
- existing monthly reflection functions: maintained
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- existing /my-coaching page
- existing /my-coaching/records/daily
- existing /my-coaching/weekly-log
- existing /my-coaching/records/monthly
- existing daily_records API/helper
- existing weekly_logs save logic
- existing monthly_reflections API/helper
- profile.id based ownership
- no other member records visible in my-coaching
- existing moksilgi monthly checklist

## LOCK - My Coaching Records Print PDF

Completed:
- my-coaching records print pdf
- /my-coaching/records print range selection
- all records print
- daily record print
- weekly record print
- monthly review print
- printRange all daily weekly monthly
- filtered records print
- PDF default filename by record range
- document.title temporary print filename
- A4 portrait print layout
- multi-page print stabilization
- print after state restore
- 나의 기록 전체 인쇄
- 나의 기록 하루 기록 인쇄
- 나의 기록 주간 기록 인쇄
- 나의 기록 월간 회고 인쇄
- 나의 기록 PDF 저장 기본 파일명
- 나의 기록 인쇄 안정화

Description:
/my-coaching/records의 나의 기록 인쇄/PDF 기능은 정상 작동 확인 완료. 전체 기록, 하루 기록, 주간 기록, 월간 회고를 각각 선택하여 인쇄할 수 있으며, 검색/필터 결과 기준 인쇄, A4 세로 출력, 여러 페이지 출력, PDF 저장 기본 파일명 제안, 인쇄 후 화면 복구까지 안정화 완료. 이후 작업에서는 이 기능을 직접 수정하지 말고, 필요한 경우 별도 요청이 있을 때만 최소 범위로 수정한다.

Route/Area:
- /my-coaching/records
- PrintRecordsButton
- my coaching records print/PDF
- browser print/PDF flow

Validation:
- all records print: passed
- daily record print: passed
- weekly record print: passed
- monthly review print: passed
- filtered records print: passed
- PDF default filename suggestion: passed
- document.title restore after print: passed
- A4 portrait print layout: passed
- multi-page print stabilization: passed

Do not regress:
- existing /my-coaching/records overview page
- existing daily/weekly/monthly records navigation
- existing recent records preview
- existing records search/filter/sort
- existing print range selection
- existing PDF filename suggestion by document.title
- existing print after state restore
- existing profile.id based ownership
- no other member records visible in my-coaching
- do not reintroduce script tag inside React component
- do not add PDF library or server PDF generation

## LOCK - My Coaching Records Page Full UX

Completed:
- my-coaching records page
- /my-coaching/records
- my coaching records list
- daily records preview
- weekly records preview
- monthly review preview
- records search filter sort
- records filter reset
- filtered records result display
- records print pdf
- records print range selection
- all records print
- daily record print
- weekly record print
- monthly review print
- printRange all daily weekly monthly
- filtered records print
- PDF default filename by record range
- document.title temporary print filename
- A4 portrait print layout
- multi-page print stabilization
- print after state restore
- 나의 기록 페이지
- 나의 기록 목록
- 나의 기록 검색
- 나의 기록 필터
- 나의 기록 필터 초기화
- 하루 기록 미리보기
- 주간 기록 미리보기
- 월간 회고 미리보기
- 나의 기록 전체 인쇄
- 나의 기록 하루 기록 인쇄
- 나의 기록 주간 기록 인쇄
- 나의 기록 월간 회고 인쇄
- 나의 기록 PDF 저장 기본 파일명
- 나의 기록 인쇄 안정화

Description:
/my-coaching/records 기록 페이지는 정상 작동 확인 완료. 하루 기록, 주간 기록, 월간 회고 미리보기와 검색/필터/정렬, 필터 초기화, 선택 범위별 인쇄, PDF 저장 기본 파일명 제안, A4 세로 출력, 여러 페이지 출력, 인쇄 후 화면 복구까지 안정화 완료. 이후 작업에서는 이 페이지의 기존 기능을 직접 수정하지 말고, 명시적인 요청이 있을 때만 최소 범위로 수정한다.

Route/Area:
- /my-coaching/records
- /my-coaching/records/daily
- /my-coaching/weekly-log
- /my-coaching/records/monthly
- PrintRecordsButton
- daily_records
- weekly_logs
- monthly_reflections

Validation:
- records page render: passed
- daily records preview: passed
- weekly records preview: passed
- monthly review preview: passed
- records search/filter/sort: passed
- records filter reset: passed
- filtered records result display: passed
- all records print: passed
- daily record print: passed
- weekly record print: passed
- monthly review print: passed
- filtered records print: passed
- PDF default filename suggestion: passed
- print after state restore: passed

Do not regress:
- existing /my-coaching/records page
- existing daily records preview
- existing weekly records preview
- existing monthly review preview
- existing records search/filter/sort
- existing records filter reset
- existing filtered records result display
- existing records print/PDF flow
- existing print range selection
- existing PDF filename suggestion by record range
- existing document.title restore after print
- existing profile.id based ownership
- no other member records visible in my-coaching
- do not modify /my-coaching/records without explicit request

## LOCK - Coach Dashboard Assigned Coachee Overview

Completed:
- coach dashboard
- /coach
- assigned coachee dashboard
- coach assigned coachee overview
- coach coachee statistics
- coach active relationships
- coach weekly submitted count
- coach weekly missing count
- coach shared daily records count
- coach shared monthly reflections count
- coach feedback pending status
- coach dashboard no unshared record body access
- coach dashboard profile_id ownership
- coach dashboard active relationship scope
- 코치 대시보드
- 코치 담당 코치이 현황
- 코치 담당 코치이 통계
- 코치 활성 관계 기준 조회
- 코치 주간 기록 제출 통계
- 코치 하루 기록 공유 통계
- 코치 월간 회고 공유 통계
- 코치 피드백 대기 상태
- 코치 공유되지 않은 일지 본문 비열람

Description:
/coach 코치 대시보드는 정상 작동 확인 완료. 현재 로그인한 코치의 profiles.id를 기준으로 active coaching_relationships 안의 담당 코치이 현황을 조회하며, 담당 코치이 수, 이번 주 제출/미제출 수, 공유된 하루 기록 수, 공유된 월간 회고 수, 피드백 대기 상태를 통계 중심으로 표시한다. 공유되지 않은 개인 일지 본문은 조회하지 않는다.

Route/Area:
- /coach
- coach dashboard
- assigned coachee dashboard
- coaching_relationships
- daily_records
- weekly_logs
- monthly_reflections
- coach_feedback

Validation:
- /coach dashboard render: passed
- assigned coachee count: passed
- weekly submitted/missing count: passed
- shared daily records count: passed
- shared monthly reflections count: passed
- feedback pending status: passed
- no unshared personal record body access: passed
- profile.id based ownership: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- /coach is for the current coach's assigned coachee overview only
- active coaching_relationships must remain the relationship scope
- auth.uid() must not be used directly as profile_id
- use profiles.auth_user_id to resolve profiles.id
- do not read unshared daily_records body fields
- do not read unshared weekly_logs body fields
- do not read unshared monthly_reflections body fields
- separate admin status reporting from personal record body access
- existing /coach relationships, weekly logs, moksilgi, and goals flows

## LOCK - Coach Maker Coach Stats Dashboard

Completed:
- coach-maker dashboard
- /coach-maker
- coach maker dashboard
- coach maker coach statistics
- coach maker scope statistics
- coach maker relationship statistics
- coach maker managed coach overview
- coach maker managed coachee count
- coach maker weekly submitted count
- coach maker weekly missing count
- coach maker shared daily records count
- coach maker shared monthly reflections count
- coach maker feedback statistics
- coach maker no personal record body access
- coach maker scope_type scope_id access
- coach maker user_roles access
- 코치메이커 대시보드
- 코치메이커 코치별 통계
- 코치메이커 관리 범위 통계
- 코치메이커 관계 현황 통계
- 코치메이커 코치별 담당 코치이 수
- 코치메이커 주간 제출 미제출 통계
- 코치메이커 공유 기록 통계
- 코치메이커 피드백 통계
- 코치메이커 개인 일지 본문 비열람 원칙
- 코치메이커 scope_type scope_id 권한 범위

Description:
/coach-maker 코치메이커 대시보드는 정상 작동 확인 완료. user_roles의 coach_maker 권한과 scope_type/scope_id 범위를 기준으로 여러 코치의 담당 코치이 현황과 제출/공유/피드백 통계를 표시한다. 코치메이커는 관계와 통계는 확인할 수 있지만, 개인 일지 본문은 기본적으로 열람하지 않는다.

Route/Area:
- /coach-maker
- coach maker dashboard
- coach maker coach statistics
- user_roles
- coaching_relationships
- daily_records
- weekly_logs
- monthly_reflections
- coach_feedback

Validation:
- /coach-maker dashboard render: passed
- coach_maker user_roles access: passed
- scope_type/scope_id handling: passed
- managed coach overview: passed
- managed coachee count: passed
- weekly submitted/missing statistics: passed
- shared daily/monthly record statistics: passed
- feedback statistics: passed
- no personal record body access: passed
- `npm run typecheck`: passed
- `npm run lint`: passed or skipped according to current lint script

Do not regress:
- /coach-maker handles multiple coaches within coach_maker scope
- /coach remains the current coach's own assigned coachee dashboard
- coach_maker scope must be based on user_roles.scope_type and user_roles.scope_id
- auth.uid() must not be used directly as profile_id
- use profiles.auth_user_id to resolve profiles.id
- coach_maker must not get default personal record body access
- personal record body access must follow sharing and active coaching_relationships
- separate admin status reporting from personal record body access
- coach_maker must not gain coach_feedback write permissions
- existing /coach-maker moksilgi summary, action notes, reports, CSV, and print/PDF flows

## LOCK - Invitation Accept Extended Profile Fields

Completed:
- invitation accept extended profile fields
- /invitations/accept profile fields
- invitation country selection
- invitation ministry_position
- invitation generation_number
- invitation generation direct input
- invitation active countries only
- invitation active generation options only
- profiles.country_id
- profiles.ministry_position
- profiles.generation_number
- admin users extended profile display
- admin users country ministry generation display
- countries management integration
- generation options integration
- 회원가입 확장 필드
- 초대 수락 확장 필드
- 소속 국가 저장
- 소속 직분 저장
- 세대 저장
- 직접 입력 세대 저장
- 활성 국가만 표시
- 활성 세대만 표시
- 관리자 회원 상세 확장 정보 표시

Description:
초대 수락/회원가입 확장 필드 기능은 정상 작동 확인 완료. 초대 수락 폼에서 소속 국가, 소속 직분, 세대를 입력할 수 있으며, 소속 국가는 profiles.country_id, 소속 직분은 profiles.ministry_position, 세대는 profiles.generation_number에 저장된다. 세대는 generation_options의 활성 옵션을 표시하며 직접 입력도 가능하다. 국가 목록은 countries의 is_active=true 항목만 표시한다. 저장된 값은 /admin/users 회원 상세보기에서 확인 가능하다.

Route/Area:
- /invitations/accept
- /admin/users
- /admin/settings/countries
- /admin/settings/generations
- profiles.country_id
- profiles.ministry_position
- profiles.generation_number
- countries
- generation_options

Protection Principles:
- 소속 국가는 profiles.country_id에 countries.id를 저장한다.
- 소속 직분은 시스템 역할이 아니며 profiles.ministry_position에 저장한다.
- 세대는 profiles.generation_number에 숫자로 저장한다.
- 시스템 역할과 소속 직분을 혼동하지 않는다.
- 비활성 국가는 새 가입/초대 수락 폼에서 숨긴다.
- 비활성 세대 옵션은 새 가입/초대 수락 폼에서 숨긴다.
- 기존 회원에게 저장된 국가/세대 값은 관리자 화면에서 계속 표시 가능해야 한다.

Do not regress:
- existing invitation token validation and accept flow
- existing profiles.country_id storage
- existing profiles.ministry_position storage
- existing profiles.generation_number storage
- existing countries management integration
- existing generation options integration
- active countries only in new invitation/member signup selection
- active generation options only in new invitation/member signup selection
- direct generation input support
- admin users extended profile display
- do not mix ministry_position with system user_roles

## LOCK - Admin Users, Affiliations, Performance, and Security Stabilization

Completed date:
- 2026-05-13

Completed:
- /admin/users server-side auth guard
- getAdminUsers authorizedAdmin double guard
- admin users lazy role summary
- /api/admin/users/summary
- admin user detail lazy loading
- /api/admin/users/[profileId]
- /api/admin/users/options
- /admin/settings/affiliations
- regions/churches/groups affiliation management
- group_type_enum values: ministry_team, small_group, cohort_group, training_group, regional_group, other
- /login i18n static messages optimization
- LoginForm duplicate auth i18n fetch removed
- I18nProvider skips profile locale sync on /login
- admin settings menu cards
- unauthenticated admin route curl security check passed
- 관리자 회원관리 서버 권한 가드
- 관리자 회원 목록 이중 권한 방어
- 역할별 회원 요약 지연 로딩
- 회원 상세 지연 로딩
- 소속 선택값 관리 화면
- 지역/도시, 세부 교회, 그룹/팀/목장 관리
- 로그인 i18n 중복 호출 제거
- 비로그인 관리자 라우트 민감정보 비노출 확인

Summary:
관리자/회원관리/소속 선택값/성능/보안 안정화 작업 완료. /admin/users는 서버 컴포넌트 최상단에서 관리자 권한을 확인한 뒤에만 회원 데이터를 조회하며, service role 기반 getAdminUsers도 authorizedAdmin 이중 방어를 유지한다. 역할별 회원 요약과 회원 상세/수정 데이터는 별도 API로 지연 로딩하여 초기 렌더링 비용을 줄였다. /admin/settings/affiliations에서는 기존 regions, churches, groups 테이블을 사용해 회원정보수정 화면의 지역/도시, 세부 교회, 그룹/팀/목장 선택값을 등록/수정할 수 있다. /login은 정적 i18n 메시지를 사용하고 중복 auth namespace fetch 및 로그인 전 profile locale sync를 제거했다.

Routes and APIs:
- /admin
- /admin/users
- /admin/settings
- /admin/settings/countries
- /admin/settings/organizations
- /admin/settings/generations
- /admin/settings/affiliations
- /admin/coaching-genealogy
- /coach-maker
- /coach-maker/moksilgi-progress
- /login
- /api/admin/users/summary
- /api/admin/users/[profileId]
- /api/admin/users/options
- /api/admin/affiliations

Security conditions to keep:
- /admin/users must always call requireAdminProfile before any member data query.
- getAdminUsers must keep the authorizedAdmin double guard before returning service role queried member data.
- Unauthenticated /admin and coach-maker routes must not render member names, emails, roles, affiliations, moksilgi data, coaching relationships, or admin statistics in HTML.
- /api/admin/users/summary, /api/admin/users/[profileId], and /api/admin/users/options must remain protected for unauthenticated users.
- Service role keys must never be exposed to client components or browser-visible output.
- RLS policies, role enum values, auth structure, and login redirect policies must not be loosened as part of UI or performance changes.
- group_type values for groups must use the existing group_type_enum only: ministry_team, small_group, cohort_group, training_group, regional_group, other.

Do not regress:
- /admin/users member list
- /admin/users search/filter/pagination
- admin user role summary lazy loading
- admin user detail lazy loading
- member profile edit and save flow
- system role active/inactive management
- coachee role active/inactive management
- admin affiliations dropdown integration
- countries, organizations, generations settings pages
- affiliations create/update flow for regions, churches, and groups
- group_type_enum safe values
- /login static i18n message loading
- LoginForm without duplicate auth i18n fetch
- I18nProvider profile locale sync after login, but not on /login
- admin settings cards and navigation links
- unauthenticated curl security behavior for protected admin and coach-maker routes

Validation summary:
- /admin/users unauthenticated curl check: passed, redirects before sensitive HTML
- /admin, /admin/settings, /admin/coaching-genealogy unauthenticated curl check: passed, no sensitive HTML detected
- /coach-maker and /coach-maker/moksilgi-progress unauthenticated curl check: passed, no sensitive HTML detected
- /api/admin/users/summary unauthenticated protection: passed
- /api/admin/users/[profileId] unauthenticated protection: passed
- /api/admin/users/options unauthenticated protection: passed
- /admin/settings/affiliations manual save flow: regions/churches/groups implemented against existing tables
- `npm run typecheck`: passed during stabilization work
- `npm run build`: passed during stabilization work
