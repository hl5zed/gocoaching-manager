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

## LOCK - Admin Users Ministry Trust Theme Phase 1

Completed date:
- 2026-05-14

Work:
- /admin/users 회원관리 화면 Ministry Trust Theme 1차 적용
- admin users Ministry Trust Theme phase 1
- admin users common Card/ButtonLink/Badge tone
- admin users common TextInput/SelectInput/Button/Card filters
- admin users status and role Badge display
- admin users affiliation Badge groups
- admin users responsive min-w-0 break-words flex-wrap overflow-x-auto
- login guide copy common Button style

Modified files:
- src/app/admin/users/page.tsx
- src/app/admin/users/AdminUsersClientFilters.tsx
- src/app/admin/users/LoginGuideCopyButton.tsx

Summary:
/admin/users 회원관리 화면에 Ministry Trust Theme 1차 공통 UI를 적용했다. 페이지 상단 제목/설명/주요 이동 버튼 영역은 공통 Card, ButtonLink, Badge 톤으로 정리했고, 검색/역할/상태/페이지 크기 필터에는 공통 TextInput, SelectInput, Button, Card를 적용했다. 회원 상태와 역할은 공통 Badge로 표시하며, 국가/지역/기관/교회/그룹/직분/세대 정보는 작은 Badge 묶음으로 표시해 다국어 환경에서도 스캔하기 쉽게 정리했다. 모바일/태블릿 대응을 위해 min-w-0, break-words, flex-wrap, overflow-x-auto를 보완했고, 로그인 안내 복사 버튼에도 공통 Button 스타일을 적용했다.

Kept unchanged:
- 기능 로직 변경 없음
- API 변경 없음
- DB schema 변경 없음
- RLS 변경 없음
- 권한 체크 변경 없음
- 저장/수정 흐름 변경 없음

Do not regress:
- /admin/users member list
- /admin/users search/filter/pagination
- admin user detail drawer opening
- role and status display
- member profile edit and save flow
- admin users auth guard and getAdminUsers authorizedAdmin double guard
- admin user role summary lazy loading
- admin user detail lazy loading
- /api/admin/users/summary, /api/admin/users/[profileId], /api/admin/users/options protection
- existing i18n translation key/fallback structure

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

## LOCK - Global Timezone Phase 2 Main Merge and Production Verification

Completed date:
- 2026-05-17

Work:
- 글로벌 timezone 2차 main merge 및 운영 확인 완료
- feature/timezone-phase-2 PR merge 완료
- Production main 배포 확인
- /profile/edit 개인 시간대 UI 운영 반영 확인
- /admin/settings 시스템 기본 시간대 UI 운영 확인
- /admin/settings/organizations 기관/조직 기본 시간대 UI 운영 확인
- organizations.default_timezone 컬럼 추가
- system_settings global default_timezone 추가
- timezone fallback 순서 확장:
  - profile timezone
  - organization timezone
  - system default timezone
  - Asia/Bangkok
- /profile/edit에서 개인 timezone 선택/저장 흐름 연결
- /profile 보기 화면에 개인 timezone 표시
- UTC timestamp 저장 흐름 유지
- 기존 record_date, week_start/week_end, year/month 데이터 변환 없음
- RLS policy 변경 없음
- Supabase/Postgres timezone 설정 변경 없음

Kept unchanged:
- 기존 timestamp UTC 저장 정책 유지
- 기존 daily record_date 데이터 변환 없음
- 기존 weekly week_start/week_end 데이터 변환 없음
- 기존 monthly year/month 데이터 변환 없음
- 기존 인증/권한 흐름 유지
- RLS policy 변경 없음
- Supabase/Postgres timezone 설정 변경 없음

Do not regress:
- profile timezone should remain the first fallback source
- organization default_timezone should remain the second fallback source
- system_settings global default_timezone should remain the third fallback source
- Asia/Bangkok should remain the final application fallback
- /profile/edit personal timezone selection and save flow
- /profile read-only personal timezone display
- /admin/settings system default timezone save flow
- /admin/settings/organizations organization default timezone save flow
- UTC timestamp storage behavior
- existing record_date, week_start/week_end, year/month data interpretation

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed
- Vercel Production 배포 정상 확인

## LOCK - Global Timezone Phase 1

Completed date:
- 2026-05-17

Work:
- 글로벌 timezone 적용 1차 완료
- 공통 timezone helper 추가
- DEFAULT_TIMEZONE = Asia/Bangkok
- profiles.timezone 우선 사용
- fallback timezone은 Asia/Bangkok
- 잘못된 timezone 값에 대한 fallback 처리
- 하루 기록 기본 record_date를 timezone 기준 오늘 날짜로 변경
- 주간 기록 week_start/week_end를 timezone 기준 월요일~일요일로 계산
- 월간 회고 기본 year/month를 timezone 기준 현재 연월로 계산
- 코치메이커 이번 주, 현재 월, 현재 연도 계산을 timezone 기준으로 통일
- /coach-maker/report 기준 시간대 표시
- /coach-maker/moksilgi-progress 기준 시간대 표시
- /coach/moksilgi 목록/상세 출력 기준 시간대 표시
- /my-coaching/records 출력 기준 시간대 표시

Kept unchanged:
- created_at, updated_at, submitted_at, expires_at 등 timestamp UTC 저장 흐름 유지
- DB schema 변경 없음
- migration 변경 없음
- RLS 변경 없음
- Supabase/Postgres timezone 변경 없음

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

Deferred:
- 조직 timezone 정책
- system settings timezone
- 초대 만료일 timezone 세분화
- 기존 date 데이터 재해석

## LOCK - Admin Settings UX Cleanup Phase 1

Completed date:
- 2026-05-16

Work:
- /admin/settings UX 1차 정리 완료
- 설정 카드별 상태 배지 추가
- 실제 적용 중 / 초대 생성에 적용 / 저장 가능 / 저장만 됨 / 준비 중 상태 구분
- 초대 만료 기간은 /admin/invitations/new 기본 만료일로 안내
- 기본 언어와 기본 국가는 저장되지만 단계적 연결 예정으로 안내
- 인쇄 기본 옵션은 저장되지만 출력 화면 반영은 단계적 연결 예정으로 안내
- 이메일 발신 설정은 현재 자동 발송 비활성/준비 중으로 명확히 표시
- 조직별 기본 권한 설정은 초대 생성 화면 기본 권한 제안에 사용됨을 안내
- 시스템 공지는 저장/수정 가능한 운영 공지 관리 기능으로 안내
- 소속 선택값 관리는 회원 정보 입력/수정 선택값으로 사용됨을 안내

Kept unchanged:
- API 변경 없음
- DB query 변경 없음
- DB schema 변경 없음
- migration 변경 없음
- RLS 변경 없음
- 인증/권한 로직 변경 없음
- 설정 데이터 구조 변경 없음
- 이메일 발신 기능 구현 없음
- 인쇄 옵션 실제 연결 로직 구현 없음
- 기본 언어/국가 실제 전역 적용 로직 구현 없음

Do not regress:
- /admin/settings status badge clarity
- default locale/default country staged connection 안내
- invitation expiration /admin/invitations/new 적용 안내
- print_options staged print connection 안내
- email sending 준비 중 안내
- organization default role invitation suggestion 안내
- system announcements management 안내
- affiliations selection value 적용 위치 안내

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed
- git push 완료

## LOCK - Mobile Output/PDF Save Guidance Update

Completed date:
- 2026-05-17

Work:
- 모바일 출력/PDF 저장 안내 보완 완료
- Safari에서 모바일 출력 기능 정상 작동 확인
- 인앱 브라우저 또는 일부 모바일 브라우저에서 인쇄창이 열리지 않을 수 있음을 고려
- /coach/moksilgi 목록 출력 안내 보완
- /coach/moksilgi 상세 출력 안내 보완
- /my-coaching/records 인쇄 안내 보완
- /coach-maker/report 인쇄 안내 보완
- “인쇄창이 열리지 않으면 Safari 또는 Chrome에서 다시 열어 주세요.” 안내 추가
- 안내 문구는 화면용으로만 표시하고 인쇄물에는 제외

Kept unchanged:
- window.print() 호출 로직 변경 없음
- document.title 파일명 힌트/복원 흐름 변경 없음
- 출력 범위 계산 로직 변경 없음
- print CSS 변경 없음
- 데이터 조회, 권한, API, DB, RLS 변경 없음

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed
- git push 완료

## LOCK - Coach Maker Report Print UX Cleanup Phase 1

Completed date:
- 2026-05-16

Work:
- /coach-maker/report 인쇄 UX 1차 정리 완료
- 출력 버튼 문구를 “보고서 인쇄/PDF 저장”으로 정리
- 보고서 기준 안내 추가
- 목실기 성취 현황은 선택 연도 기준으로 안내
- 관리 액션 메모는 작성일 기간 기준으로 안내
- 팀 필터는 목실기 대상자와 관리 메모 모두에 공통 적용됨을 안내
- 인쇄물에 남는 필터 요약에 목실기 기준, 관리 메모 기준, 팀 기준 추가
- 인쇄 전 확인 안내 추가
- 브라우저 인쇄창에서 PDF 저장 가능 안내 추가
- 화면용 인쇄 전 안내는 print:hidden으로 인쇄물에서 제외
- 빈 상태 문구를 “선택한 조건에 해당하는…” 형태로 정리

Kept unchanged:
- 보고서 순서 유지
- 보고서 레이아웃 유지
- 필터 동작 유지
- 인쇄 흐름 유지
- 데이터 계산 기준 유지
- API 변경 없음
- DB query 변경 없음
- DB schema 변경 없음
- migration 변경 없음
- RLS 변경 없음
- 인증/권한 로직 변경 없음

Do not regress:
- /coach-maker/report year/team/from/to filter flow
- report print/PDF button wording
- moksilgi selected-year basis 안내
- action notes created-at period basis 안내
- team filter common application 안내
- printed filter summary basis visibility
- print-hidden screen-only print notice
- empty state selected-condition wording

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed
- git push 완료

## LOCK - Admin Users UX Cleanup Phase 1

Completed date:
- 2026-05-16

Work:
- 관리자 회원관리 UX 1차 정리 완료
- /admin/users 회원 상세 Drawer 권한 설정 UX 개선
- 직접 회원 등록 패널 role/scope 선택 UX 개선
- coachee + global처럼 보이던 기본값 제거
- 역할 선택 전 권한 범위 선택 비활성화
- role별 허용 scope_type만 표시
- country / organization / church / group scope는 UUID 직접 입력 대신 select 기반 선택으로 개선
- scope_id 직접 입력 혼선 완화
- 권한 범위와 회원 소속 정보가 다를 수 있다는 안내 추가
- 관리자 권한 선택 주의 안내 추가
- super_admin은 이 화면에서 새로 추가할 수 없다는 안내 유지
- 역할 변경 시 기존 권한 범위가 유지된다는 안내 추가
- legacy RoleAddForm 제거
- legacy RoleChangeForm 제거
- legacy RoleStatusToggleForm 제거
- 실제 사용 중인 StatusChangeForm은 유지
- 실제 역할 추가/변경/활성/비활성 기능은 AdminUserDetailDrawer에서 유지

Kept unchanged:
- API 변경 없음
- DB 변경 없음
- RLS 변경 없음
- auth 변경 없음
- role enum 변경 없음
- 회원 목록 기능 유지
- 회원 상세 Drawer 기능 유지
- 직접 회원 등록 기능 유지
- 회원 상태 변경 StatusChangeForm 유지

Do not regress:
- /admin/users role/scope hardening
- AdminUserDetailDrawer role add/change/status toggle flow
- non-super_admin global scope 금지
- super_admin 추가 금지
- 회원 소속 정보와 권한 범위 분리 안내
- 직접 회원 등록 role/scope 선택 UX
- 회원 목록의 StatusChangeForm 빠른 상태 변경

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

## LOCK - Performance Optimization Round 1-3 Deployment

Completed date:
- 2026-05-16

Work:
- 성능 최적화 1차/2차/3차 완료 및 배포 완료
- query loading 최적화
- coach-maker dashboard summary 최적화
- moksilgi-progress DB prefilter 적용
- action-notes pagination/report filter 적용
- my-coaching records limit/grouping 최적화
- admin users role filter inner join/options cache 적용
- admin invitations new slim settings 조회 적용
- report/records 반복 계산 단일 pass 최적화
- performance indexes migration 0037 추가

Completed details:
- /coach-maker 메인 대시보드의 첫 화면 summary 조회 구조를 가볍게 정리
- /coach-maker/moksilgi-progress에서 가능한 필터를 DB query 단계로 이동
- weekly_logs 이번 주 범위 조회 적용
- /api/coach-maker/action-notes에 limit/pagination 적용
- /coach-maker/report에서 action notes report filter를 DB query 단계로 전달
- /my-coaching/records 기본 최근 3개 조회 및 검색/필터 시 limit 적용
- /my-coaching/records daily/weekly/monthly split 및 print split grouping 최적화
- /admin/users role filter inner join 개선
- /admin/users options 클라이언트 cache/promise 공유 적용
- /admin/invitations/new 초대 만료일 설정 단일 조회
- 초대 폼 조직 기본값 slim option 조회 적용
- /coach-maker/report action notes summary, overdue count, high priority count 단일 pass 계산 적용
- /coach-maker/report moksilgi rows summary, participant count, status count, attention rows 단일 pass 계산 적용

Migration:
- supabase/migrations/0037_add_performance_indexes_round1.sql 추가
- user_roles active role filter용 인덱스 추가
- profiles 관리자 회원 목록용 인덱스 추가
- invitations 초대 목록용 인덱스 추가
- coach_action_notes 목록/보고서용 인덱스 추가
- weekly_logs 코치메이커 이번 주 범위 조회용 인덱스 추가

Kept unchanged:
- DB schema 변경 없음
- RLS 변경 없음
- role enum 변경 없음
- API 응답 구조 대규모 변경 없음
- 인증/권한 로직 변경 없음
- 기존 URL query 흐름 유지
- 기존 보고서/인쇄 흐름 유지

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed
- git push 완료

Do not regress:
- /coach-maker dashboard summary performance improvements
- /coach-maker/moksilgi-progress DB prefilter behavior
- action-notes pagination and report filter behavior
- /my-coaching/records recent limit and grouping behavior
- /admin/users role filter inner join and options cache
- /admin/invitations/new slim settings loading
- report/records single pass derived calculations
- 0037 performance indexes migration

## LOCK - Performance Optimization Round 1

Completed date:
- 2026-05-16

Completed:
- 성능 최적화 1차 라운드 완료
- /coach-maker/moksilgi-progress DB prefilter 적용
- /coach-maker 메인 대시보드 summary 조회 구조 개선
- weekly_logs 이번 주 범위 조회 적용
- action-notes API limit/pagination 및 보고서 필터 DB query 적용
- /my-coaching/records 기본 최근 3개 조회 및 검색/필터 시 limit 적용
- /admin/users role filter inner join 개선
- /admin/users options 클라이언트 cache/promise 공유
- /admin/invitations/new 초대 만료일 설정 단일 조회
- 초대 폼 조직 기본값 slim option 조회 적용

Kept unchanged:
- DB schema 변경 없음
- migration 변경 없음
- RLS 변경 없음
- role enum 변경 없음
- 인증/권한 로직 변경 없음

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

Do not regress:
- 기존 pagination/search/filter 흐름 유지
- 기존 권한/RLS 전제 유지
- 목록 화면 응답은 화면에 필요한 최소 필드 중심으로 유지
- 대량 데이터 화면은 DB query 단계에서 가능한 필터를 먼저 적용
- 생성/상세 화면 설정 조회는 필요한 설정만 읽도록 유지

## LOCK: Coach-maker Dashboard UX Simplification and Flow Stabilization

완료일: 2026-05-15

범위:
- /coach-maker 메인 대시보드
- src/app/coach-maker/page.tsx
- src/app/coach-maker/ActionMemoDrafts.tsx

완료 내용:
- 코치메이커 대시보드를 작업 중심 구조로 재배치
- 화면 순서를 핵심 요약 → 오늘/이번 주 처리 필요 → 빠른 점검 → 코치별 요약 → 목실기 요약 → 주요 기능 바로가기 → 관리 액션 메모 요약으로 정리
- 상단 요약 카드 설명을 짧고 행동 중심으로 개선
- 오늘/이번 주 처리 필요 버튼 문구를 미제출 확인, 피드백 확인, 목실기 현황 보기, 메모 처리로 정리
- 코칭 진행 요약과 목실기 성취 요약 제목을 분리
- 코치별 현황 표를 요약형으로 축소
- 빠른 점검은 관심 필요 대상자 최대 5명 중심으로 단순화
- 목실기 요약은 핵심 카드 4개 중심으로 축소
- 주요 기능 바로가기를 카드형으로 정리
- 관리 액션 메모 전체 기능은 접힘 영역 안에 유지
- 메모 처리 버튼은 접힘 영역을 직접 펼치고 해당 영역으로 스크롤하도록 개선
- 새 메모 작성 버튼은 접힘 영역을 펼친 뒤 작성폼으로 스크롤하도록 개선
- 세대별 계층 계보도는 coach_maker 권한에서 잘못 이동하지 않도록 준비 중 / 관리자 권한 제공 상태로 표시
- 출력 버튼은 기존 /coach-maker/report?year=... 경로 유지

유지한 것:
- 서버 데이터 조회 변경 없음
- Supabase 호출 변경 없음
- 권한 가드 변경 없음
- API route 변경 없음
- DB schema 변경 없음
- migration 변경 없음
- RLS policy 변경 없음
- 인증/권한 로직 변경 없음
- 목실기 계산 로직 변경 없음
- 코칭 관계 집계 로직 변경 없음
- 메모 작성/검색/필터/목록/CSV/상세 수정 기능 유지

검증:
- npm run typecheck 통과
- npm run build 통과

주의:
이 LOCK 이후 /coach-maker 메인 대시보드는 작업 중심 구조를 기준으로 유지합니다.
추가 기능은 메인 화면에 무리하게 펼치지 말고, 요약 카드·접힘 영역·하위 상세 페이지 방식으로 연결합니다.

## LOCK - Admin Settings System Settings Phase 1 QA

Completed date:
- 2026-05-14

Work:
- /admin/settings 시스템 설정 1차 QA 및 active profile 권한 보완
- admin settings system_settings phase 1 QA
- active profile double guard for settings API/page
- default locale/country/invitation expiration validation review

Checked results:
- system_settings seed는 `on conflict on constraint system_settings_scope_key_unique do nothing`으로 중복 실행 안전
- `unique nulls not distinct (scope_type, scope_id, key)`로 `scope_id is null`인 global 설정 중복 방지
- default_locale은 `ko/en`만 허용
- `th`는 추가하지 않음
- unknown field는 `PATCH /api/admin/settings`에서 400 반환
- default_country_id는 null 또는 존재하는 active country만 허용
- invitation_expires_in_days는 정수 1~30만 허용
- /admin/invitations/new는 설정 조회 성공 시 기본 초대 만료일을 읽음
- 설정 조회 실패 시 7일 fallback 유지

Issue found:
- RLS는 `profiles.status='active'`까지 요구하지만, API/page 서버 가드는 기존 super_admin 확인 뒤 profile active 상태를 다시 확인하지 않았음
- service role 기반 저장 경로에서는 RLS를 우회하므로 설정 기능 안에서 active profile 확인이 필요했음

Modified files:
- src/app/api/admin/settings/route.ts
- src/app/admin/settings/page.tsx

Summary:
시스템 설정 1차 저장 기능을 QA하고 권한 경계만 최소 보완했다. `GET/PATCH /api/admin/settings`는 super_admin role 확인 후 `profiles.status='active'`와 `deleted_at is null`을 추가 확인하도록 정리했다. `/admin/settings` 서버 페이지도 active profile이 아니면 설정 데이터 조회 전에 `/dashboard`로 redirect하도록 보완했다. 이메일 발신 설정, 시스템 공지 설정, 인쇄 기본 옵션, 조직별 기본 권한 설정은 계속 "준비 중" 상태로 유지했다.

Kept unchanged:
- 새 기능 추가 없음
- DB schema 추가 변경 없음
- migration 추가 변경 없음
- 기존 RLS 정책 변경 없음
- 기존 초대 생성 business logic 변경 없음
- LanguageSwitcher 변경 없음
- messages.ts 변경 없음
- th 옵션 추가 없음
- organization별 설정 구현 없음

Do not regress:
- system_settings global seed behavior
- `system_settings_scope_key_unique` global uniqueness
- default_locale ko/en-only validation
- rejection of th and unknown PATCH fields
- default_country_id null/existing-active-country validation
- invitation_expires_in_days integer 1~30 validation
- /admin/settings active super_admin-only access
- /api/admin/settings active super_admin-only access
- /admin/invitations/new settings-based invitation expiration default
- invitation expiration fallback to 7 days when settings lookup fails

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

Notes:
- DB에 `0034_create_system_settings.sql` migration 적용 후 실제 저장/새로고침 유지 여부는 Supabase에서 수동 확인 필요

## LOCK - Dashboard My Home and Admin Center Role Split

Completed date:
- 2026-05-14

Work:
- /dashboard 나의 홈과 /admin 관리자 센터 역할 분리
- dashboard as personal home
- admin as admin center
- shared navigation labels separated for my home and admin center

Modified files:
- src/app/dashboard/page.tsx
- src/app/admin/page.tsx
- src/components/navigation/PageNavigationButtons.tsx
- src/lib/i18n/messages.ts

Summary:
/dashboard와 /admin의 목적이 비슷하게 보이지 않도록 UI 문구와 화면 구조를 분리했다. /dashboard는 모든 로그인 사용자의 개인 시작 화면으로 정리했고, 상단 성격 표시는 “개인 홈”, 제목은 “나의 홈”, 설명은 “내 역할에 맞는 코칭 기록, 목실기, 담당 현황으로 이동하는 개인 시작 화면입니다.”로 변경했다. /dashboard에서는 관리자 세부 기능 직접 노출을 줄이고, 관리자 권한이 있으면 “관리자 센터” 진입 카드만 보이도록 정리했다. /admin은 관리자 전용 운영 공간으로 정리했고, 상단 성격 표시는 “관리자 전용”, 제목은 “관리자 센터”, 설명은 “회원, 초대, 역할, 소속, 시스템 설정을 관리하는 관리자 전용 공간입니다.”로 변경했다. /admin에는 회원 관리, 초대 관리, 역할 관리, 국가/지역/기관/교회/그룹 관리, 시스템 설정 메뉴를 관리자 전용 메뉴로 모았다. 공통 이동 버튼은 /dashboard 이동 문구를 “나의 홈”, /admin 이동 문구를 “관리자 센터”로 구분했다.

Kept unchanged:
- 로그인 흐름 변경 없음
- 역할별 권한 체크 변경 없음
- 관리자 접근 제한 변경 없음
- 기존 링크 이동 변경 없음
- 데이터 조회 변경 없음
- API/Supabase 흐름 변경 없음
- DB schema 변경 없음
- migration 변경 없음
- API route 변경 없음
- RLS policy 변경 없음
- middleware 인증 로직 변경 없음
- 권한 판단 로직 변경 없음

Do not regress:
- /dashboard authenticated access flow
- /dashboard role-based quick links
- /dashboard admin center entry card for super_admin
- /admin server-side admin guard
- /admin member summary loading
- /admin users and invitations navigation
- /admin settings navigation
- PageNavigationButtons back/forward behavior
- PageNavigationButtons dashboardHref="/admin" label behavior
- i18n key parity for ko/en

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

## LOCK - Ministry Trust Theme Phase 1 QA and Print CSS Stabilization

Completed date:
- 2026-05-14

Work:
- Ministry Trust Theme 1차 QA 및 /coach/moksilgi 인쇄 CSS 보완
- Ministry Trust Theme phase 1 QA
- coach moksilgi common Card/Button/ButtonLink/Badge/TextInput/ProgressBar tone
- coach moksilgi A4 print CSS stabilization
- common PrintPageButton Button tone cleanup

Checked screens:
- /admin/users
- /coach-maker/moksilgi-progress
- /coach
- /my-coaching/records
- /coach/moksilgi
- /coach/moksilgi/[planId]

Issues found:
- /coach/moksilgi, /coach/moksilgi/[planId]에 raw 링크/버튼/카드 스타일 일부가 남아 있어 공통 UI 톤이 덜 맞았음
- 공통 PrintPageButton이 Button을 사용하면서도 별도 raw Tailwind 버튼 스타일을 덧붙이고 있었음
- 인쇄 CSS에서 본문 컨테이너 max-width, 카드 padding, 섹션 간격이 A4 출력에서 불필요한 여백을 만들 가능성이 있었음

Modified files:
- src/app/coach/moksilgi/page.tsx
- src/app/coach/moksilgi/[planId]/page.tsx
- src/components/print/PrintPageButton.tsx

Summary:
Ministry Trust Theme 1차 적용 화면들을 코드 기준으로 QA하고, 톤이 덜 맞던 /coach/moksilgi 목록/상세 화면을 최소 보완했다. /coach/moksilgi 목록/상세 화면에는 Card, Button, ButtonLink, Badge, TextInput, ProgressBar를 적용했고, 상단 제목/설명/버튼 영역은 Card 기반 구조로 정리했다. 상태값은 Badge로 표시하고 성취율은 ProgressBar로 표시했다. 긴 이름/이메일/설명 대응을 위해 min-w-0, break-words, flex-wrap, overflow-x-auto를 보완했다. PrintPageButton은 공통 Button 톤으로 정리했고, print 전용 CSS에서 A4 출력 시 max-width 해제, 카드 간격/패딩 축소, table width 안정화, print-color-adjust 적용, 버튼/내비게이션/액션 영역 print 숨김 유지를 적용했다.

Kept unchanged:
- DB schema 변경 없음
- migration 변경 없음
- API route 변경 없음
- RLS 변경 없음
- 인증/권한 로직 변경 없음
- Supabase 조회 로직 변경 없음
- 저장/수정 business logic 변경 없음
- 기존 계산 로직 변경 없음

Do not regress:
- /admin/users Ministry Trust Theme phase 1 UI
- /coach-maker/moksilgi-progress Ministry Trust Theme phase 1 UI
- /coach Ministry Trust Theme phase 1 UI
- /my-coaching/records Ministry Trust Theme phase 1 UI
- /coach/moksilgi list data loading and print flow
- /coach/moksilgi/[planId] detail data loading and print flow
- PrintPageButton document.title PDF filename behavior
- A4 portrait print layout with natural content flow
- print-hidden/no-print hiding of buttons, navigation, filters, and action areas

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

Notes:
- 브라우저 인쇄 미리보기는 자동 실행하지 않았으므로, 최종 배포 전 수동 QA에서 확인 필요

## LOCK - My Coaching Records Ministry Trust Theme Phase 1

Completed date:
- 2026-05-14

Work:
- /my-coaching/records 나의 코칭 기록 화면 Ministry Trust Theme 1차 적용
- my coaching records Ministry Trust Theme phase 1
- my coaching records common Card/Badge/ButtonLink tone
- my coaching records daily weekly monthly Card actions
- my coaching records common TextInput/SelectInput/Button/FieldLabel filters
- my coaching records status, visibility, and record type Badge display
- my coaching records Card-based record list sections
- my coaching records responsive min-w-0 break-words flex-wrap
- my coaching records print Button style

Modified files:
- src/app/my-coaching/records/page.tsx
- src/app/my-coaching/records/PrintRecordsButton.tsx

Summary:
/my-coaching/records 나의 코칭 기록 화면에 Ministry Trust Theme 1차 공통 UI를 적용했다. 페이지 상단 제목/설명/이동 버튼 영역은 공통 Card, Badge, ButtonLink 톤으로 정리했고, 하루기록/주간기록/월간기록 이동 영역은 Card 기반 액션으로 정리했다. 검색/필터 영역에는 공통 TextInput, SelectInput, Button, FieldLabel을 적용했으며, 기록 상태, 공개/공유 상태, 기록 유형은 공통 Badge로 표시했다. 기록 목록 섹션은 Card 기반으로 정리했고, min-w-0, break-words, flex-wrap 등 반응형 보완을 적용했다. 인쇄 버튼은 공통 Button 스타일로 통일했다.

Kept unchanged:
- 하루/주간/월간 기록 조회 변경 없음
- 작성/수정/저장 흐름 변경 없음
- API/Supabase 데이터 흐름 변경 없음
- 인증/권한 로직 변경 없음
- DB schema 변경 없음
- migration 변경 없음
- RLS 변경 없음
- 기록 계산 및 business logic 변경 없음

Do not regress:
- /my-coaching/records overview page loading
- daily, weekly, and monthly record previews
- search/filter/sort flow
- reset filter flow
- print range selection and window.print flow
- PDF default filename behavior
- daily record create/edit/save flow
- weekly record create/edit/save flow
- monthly reflection create/edit/save flow
- shared/private state display
- existing API and Supabase data flow
- existing auth and role-based access checks

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

## LOCK - Coach Dashboard Ministry Trust Theme Phase 1

Completed date:
- 2026-05-14

Work:
- /coach 코치 대시보드 Ministry Trust Theme 1차 적용
- coach dashboard Ministry Trust Theme phase 1
- coach dashboard common Card/Badge/ButtonLink tone
- coach dashboard summary Card metrics
- coach dashboard weekly submitted/missing ProgressBar metrics
- coach dashboard weekly status and feedback Badge display
- coach dashboard coachee table Card wrapper
- coach dashboard responsive overflow-x-auto min-w break-words
- coach dashboard action links as ButtonLink cards

Modified files:
- src/app/coach/page.tsx

Summary:
/coach 코치 대시보드 화면에 Ministry Trust Theme 1차 공통 UI를 적용했다. 페이지 상단 제목/설명/이동 버튼 영역은 공통 Card, Badge, ButtonLink 톤으로 정리했고, 담당 코치이 현황 요약은 공통 Card 기반 요약 카드로 변경했다. 이번 주 제출/미제출 지표에는 ProgressBar를 추가했으며, 최근 주간 기록 상태와 피드백 대기 상태는 공통 Badge로 표시했다. 담당 코치이 목록은 기존 table 구조를 유지하면서 Card 래핑, overflow-x-auto, min-w, break-words를 보완했고, 하단 주요 이동 링크는 공통 ButtonLink 카드형 액션으로 정리했다.

Kept unchanged:
- 데이터 조회 변경 없음
- 권한 체크 변경 없음
- API/Supabase 흐름 변경 없음
- 기록 계산 로직 변경 없음
- DB schema 변경 없음
- RLS 변경 없음

Do not regress:
- /coach dashboard data loading
- assigned coachee overview
- weekly submitted/missing summary
- shared daily/monthly record summary
- feedback pending summary
- assigned coachee list
- latest weekly status display
- feedback pending status display
- links to /coach/relationships, /coach/weekly-logs, /coach/moksilgi
- existing auth and role-based data exposure
- existing API and Supabase data flow

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

## LOCK - System Announcements Migration Applied

Completed date:
- 2026-05-14

Work:
- system_announcements migration 적용 및 /admin/settings 시스템 공지 정상 작동 확인
- system announcements DB migration applied
- /admin/settings system announcement management verified
- /dashboard active announcement inline Card verified

Confirmed:
- supabase/migrations/0035_create_system_announcements.sql을 Supabase DB에 적용
- public.system_announcements 테이블 생성 확인
- /admin/settings 시스템 공지 설정 섹션 정상 표시
- 시스템 공지 생성 기능 정상 작동
- /dashboard에서 active 공지 inline Card 표시 정상 작동
- 테이블 없음 오류 “Could not find the table 'public.system_announcements' in the schema cache” 해결

Kept unchanged:
- 기존 system_settings 구조 변경 없음
- 기본 언어/국가/초대 만료 기간 기능 유지
- 초대 생성 기본값 연결 유지
- 인증/권한 구조 변경 없음
- 기존 RLS 불필요한 변경 없음

Do not regress:
- public.system_announcements table availability
- /admin/settings system announcement create/edit/toggle/soft delete flow
- /dashboard active announcement inline Card display
- system_settings default locale/default country/invitation expiration settings
- invitation expiration default connection
- existing auth and role-based access checks
- existing RLS behavior

Notes:
- 0035 migration은 Supabase SQL Editor에서 직접 적용함
- 추후 Supabase CLI migration 관리 방식 정비 필요

## LOCK - Admin Settings Print Options Phase 1

Completed date:
- 2026-05-14

Work:
- /admin/settings 인쇄 기본 옵션 1차 저장 기능 구현
- system_settings print_options seed migration
- print options validation
- /admin/settings print options UI
- PrintPageButton fallback-safe print options support

Migration:
- supabase/migrations/0036_add_print_options_to_system_settings.sql

Modified files:
- src/lib/print/print-options.ts
- src/lib/api/admin/system-settings.ts
- src/app/api/admin/settings/route.ts
- src/app/admin/settings/page.tsx
- src/app/admin/settings/SystemSettingsForm.tsx
- src/components/print/PrintPageButton.tsx
- supabase/migrations/0036_add_print_options_to_system_settings.sql

print_options structure:
```json
{
  "paper_size": "a4",
  "orientation": "portrait",
  "margin": "normal",
  "show_logo": true,
  "show_title": true,
  "show_people_info": true,
  "show_date": true,
  "show_signature": false,
  "show_page_numbers": false
}
```

API validation:
- paper_size는 a4만 허용
- orientation은 portrait, landscape만 허용
- margin은 compact, normal, wide만 허용
- show_logo, show_title, show_people_info, show_date, show_signature, show_page_numbers는 boolean만 허용
- 알 수 없는 print_options key는 400 반환
- 기존 default_locale, default_country_id, invitation_expires_in_days 검증 유지

/admin/settings UI:
- “인쇄 기본 옵션” 준비 중 카드를 실제 설정 카드로 전환
- 용지 크기 SelectInput 추가
- 방향 SelectInput 추가
- 여백 SelectInput 추가
- 제목/작성자·대상자/날짜/로고/서명란/페이지 번호 체크박스 추가
- 기존 기본 언어/국가/초대 만료 기간 저장 흐름과 함께 저장되도록 유지

PrintPageButton:
- PrintPageButton이 printOptions prop을 받을 수 있게 확장
- normalizePrintOptions()로 fallback-safe 처리
- 실제 CSS 반영은 orientation, margin만 제한 적용
- compact/normal/wide를 각각 6mm/10mm/15mm로 매핑
- 저장값이 없으면 기존과 동일하게 A4 portrait, 10mm fallback

Applied vs stored:
- 실제 적용 가능: orientation, margin
- 저장 및 향후 문서별 연결용: show_logo, show_title, show_people_info, show_date, show_signature, show_page_numbers

Kept unchanged:
- 기존 system_settings 테이블 구조 변경 없음
- system_announcements 변경 없음
- 기본 언어/국가/초대 만료 기간 기능 유지
- 시스템 공지 기능 변경 없음
- RLS 변경 없음
- 인증/권한 구조 변경 없음
- 기존 인쇄 CSS 대규모 재작성 없음
- 계보도/지도/records 전용 인쇄는 변경 없음

Do not regress:
- /admin/settings default locale/default country/invitation expiration settings
- /admin/settings print_options save and reload persistence
- PrintPageButton existing A4 portrait 10mm fallback
- PrintPageButton document.title PDF filename behavior
- coach moksilgi print flow
- coach-maker moksilgi progress print flow
- my-coaching moksilgi print flow
- genealogy/map and records dedicated print CSS

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed

Notes:
- DB에는 supabase/migrations/0036_add_print_options_to_system_settings.sql migration 적용 필요
- 적용 후 /admin/settings에서 인쇄 기본 옵션 저장/새로고침 유지 확인 필요
- /coach/moksilgi/[planId] 등 PrintPageButton 기반 화면에서 margin/orientation 수동 확인 필요

## LOCK - Prelaunch Admin Settings and Security Checklist

Completed date:
- 2026-05-14

Work:
- 정식 운영 전 관리자 설정/보안 점검표 작성
- prelaunch admin settings checklist
- prelaunch security checklist
- system_settings/system_announcements/print_options operational checks
- invitation default expiration operational checks

Completed feature summary:
- /dashboard는 모든 로그인 사용자의 “나의 홈” 역할로 정리됨
- /admin은 관리자 전용 “관리자 센터” 역할로 정리됨
- /admin/settings에서 기본 언어, 기본 국가, 초대 만료 기간 저장 기능 구현됨
- system_settings에 default_locale, default_country_id, invitation_expires_in_days, print_options 저장 구조 준비됨
- system_announcements에 시스템 공지 생성/수정/활성/비활성/soft delete 및 /dashboard 표시 기능 구현됨
- print_options 저장/조회 및 PrintPageButton의 orientation, margin 제한 적용 구현됨
- /admin/invitations/new는 초대 만료 기본값을 설정값에서 읽고 실패 시 7일 fallback 유지
- 관리자 관련 주요 페이지 비로그인 HTML 노출 보안 가드 보완됨

Prelaunch required checks:
- super_admin 운영 이메일 존재 여부
- profiles.status = active 확인
- user_roles.role = super_admin, status = active, is_active = true 확인
- /admin, /admin/users, /admin/settings 비로그인 접근 차단 확인
- 일반 사용자 /admin/settings 접근 차단 확인
- /dashboard 로그인 사용자 접근 확인
- /admin/settings 저장 후 새로고침 유지 확인
- /dashboard active 공지 표시 확인
- inactive/미래 시작/만료 공지 숨김 확인
- 초대 생성 후 /admin/invitations 목록 반영 확인
- 초대 만료 기간 1~30일 검증 확인
- 잘못된 /coach-maker/admin/invitations/new 링크 잔존 여부 검색

Supabase DB/migration checks:
- 0034_create_system_settings.sql 적용 여부
- 0035_create_system_announcements.sql 적용 여부
- 0036_add_print_options_to_system_settings.sql 적용 여부
- public.system_settings 존재 확인
- public.system_announcements 존재 확인
- system_settings key 존재 확인:
  - default_locale
  - default_country_id
  - invitation_expires_in_days
  - print_options
- system_announcements RLS enabled 확인
- Supabase SQL Editor로 수동 적용한 migration과 git migration 파일 일치 여부 확인

Auth/RLS checks:
- system_settings는 active super_admin만 조회/수정 가능한지 확인
- system_announcements는 active super_admin만 생성/수정/삭제 가능한지 확인
- 일반 로그인 사용자는 audience='all' active 공지만 조회 가능한지 확인
- 관리자 권한 사용자는 audience='admin' 공지도 조회 가능한지 확인
- service role 기반 서버 API가 active profile 상태를 별도 확인하는지 확인
- Supabase Advisor RLS Disabled 경고는 테이블별로 분류 후 정책 설계 필요
- 무작정 RLS enable 금지

Remaining risks:
- SQL Editor로 적용한 migration과 로컬 migration 이력 불일치 가능성
- Supabase Advisor RLS Disabled 경고 잔존 가능성
- 테스트 데이터와 기준 데이터 혼합 가능성
- service role 기반 admin API의 서버 권한 가드 누락 위험
- 이메일 발신 설정은 아직 준비 중
- print_options 일부 항목은 저장만 되고 실제 출력 반영은 제한적
- 시스템 공지 읽음 처리/팝업/다국어는 미구현

Next priorities:
1. Supabase Advisor RLS Disabled 경고 테이블별 분류 및 정책 설계
2. 테스트 데이터 정리 전략 확정 및 백업
3. 이메일 발신 설정 설계 및 Resend 운영 키 점검
4. 초대 메일 실제 발송 QA
5. print_options 문서별 단계 적용
6. 시스템 공지 다국어/읽음 처리 여부 결정
7. 운영용 seed/base data 문서화

Validation:
- 현재 단계는 코드 수정 없음
- migration 생성 없음
- RLS 즉시 활성화 없음
- 점검표 작성 단계

## LOCK - Coach Maker Moksilgi Progress Ministry Trust Theme Phase 1

Completed date:
- 2026-05-14

Work:
- /coach-maker/moksilgi-progress 전체 목실기 성취 현황 화면 Ministry Trust Theme 1차 적용
- coach-maker moksilgi progress Ministry Trust Theme phase 1
- coach-maker moksilgi progress common Card/Badge/Button tone
- coach-maker moksilgi progress common FieldLabel/TextInput/Button/ButtonLink filters
- coach-maker moksilgi progress summary Card metrics
- coach-maker moksilgi progress ProgressBar achievement metrics
- coach-maker moksilgi progress common Button/ButtonLink actions
- coach-maker moksilgi progress Badge status tone cleanup
- coach-maker moksilgi progress responsive overflow-x-auto min-w Card table wrappers

Modified files:
- src/app/coach-maker/moksilgi-progress/page.tsx
- src/app/coach-maker/moksilgi-progress/MoksilgiProgressClientTable.tsx

Summary:
/coach-maker/moksilgi-progress 전체 목실기 성취 현황 화면에 Ministry Trust Theme 1차 공통 UI를 적용했다. 페이지 상단 제목/설명/인쇄/이동 버튼 영역은 공통 Card, Badge, Button 톤으로 정리했고, 서버 필터 영역에는 공통 Card, FieldLabel, TextInput, Button, ButtonLink를 적용했다. 요약 지표 카드는 공통 Card 기반으로 변경했으며 성취율 지표에는 ProgressBar를 추가했다. 보기 전환, CSV 내보내기, 필터 초기화, 상세/기록 보기, 메모 작성 버튼은 공통 Button/ButtonLink 톤으로 통일했다. 상태값은 기존 공통 Badge 표시를 유지하면서 전체 톤을 정리했고, 월별 성취 현황 표와 관계별/돌봄 필요자 표에는 overflow-x-auto, min-w, Card 래핑을 보완해 모바일/태블릿 화면 깨짐을 줄였다.

Kept unchanged:
- 기능 로직 변경 없음
- API 변경 없음
- Supabase 조회 로직 변경 없음
- 권한 체크 변경 없음
- 성취율 계산 로직 변경 없음
- DB schema 변경 없음
- RLS 변경 없음

Do not regress:
- /coach-maker/moksilgi-progress progress data loading
- team view, relationship view, care needed view
- existing filters and sorting
- CSV export
- action note creation
- print/PDF flow
- achievement and care assessment calculation
- super_admin and coach_maker access checks
- existing API and Supabase data flow
- existing i18n translation key/fallback structure

Validation:
- `npm run typecheck`: passed
- `npm run build`: passed
