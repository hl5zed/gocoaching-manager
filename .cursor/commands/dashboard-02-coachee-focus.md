# /dashboard-02-coachee-focus — 대시보드 코치이 중심 재구성 (표시 레이어 + 코치이 동선 강화)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- `/my-coaching/moksilgi`와 같은 디자인 시스템(브랜드 토큰 + `src/components/ui`)으로 통일한다.
- 이 명령은 `dashboard-01-redesign`과 함께(또는 그 이후) 적용 가능하며, **단독으로도** 동작하도록 디자인 토큰 규칙을 포함한다.

## Task (한 줄)
`/dashboard`를 **코치이 사용자가 가장 먼저 자기 코칭 동선을 보도록** 재구성한다. 코치이에게는 "내 코칭" 액션 허브(오늘·목실기·기록·성장)를 상단에 크게 배치하고, 프로필/역할 표는 아래로 내려 간결하게 정리한다. 관리자/코치메이커 섹션과 모든 데이터·권한 분기·기존 링크·i18n은 그대로 유지한다.

## 핵심 방침 (확정)
- **코치이 우선**: `quickLinks.showMyCoachingLink`(= 역할에 `coachee` 포함, 기존 플래그)가 true일 때, 인사 히어로 바로 아래에 "내 코칭" 액션 허브를 노출한다.
- **새 데이터/통계 금지**: `getDashboardMe`는 profile/roles만 반환한다. 진행률·달성률·오늘 체크 여부 같은 수치를 **새로 조회하거나 추정하지 않는다.** 허브 카드는 아이콘 + 제목 + 한 줄 설명 + 이동(네비게이션)만 한다.
- **새 역할 로직 금지**: 노출 판단은 기존 `quickLinks`/`showMyMoksilgiCard`만 사용한다. 새 role 계산/쿼리를 추가하지 않는다.

## "내 코칭" 액션 허브 (코치이 동선)
- `quickLinks.showMyCoachingLink`일 때 노출. 2×2(모바일 2열, 데스크톱 4열) 카드 그리드.
- 각 카드는 기존 **코치이 하단탭(`CoacheeBottomTabs`)과 동일한 경로**로만 링크한다(새 라우트 신설 금지):
  - 오늘 체크 → `/my-coaching`
  - 나의 목실기 → `/my-coaching/moksilgi` (살짝 강조: `border-info` 2px 또는 brand 강조)
  - 나의 기록 → `/my-coaching/records/daily`
  - 나의 성장 → `/my-coaching/goals`
- 라벨/설명: 기존 i18n 키가 있으면 재사용(`dashboard.myMoksilgi`, `dashboard.myMoksilgiDescription`, `dashboard.myCoachingSpace`, `dashboard.myRecords` 등). 없는 항목(오늘·성장 등)은 `<I18nText k="..." fallback="..." />` 형태로 **한국어 fallback과 함께** 새 키를 쓰되, 키 네임스페이스는 기존 `dashboard.*` 규칙을 따른다. 라벨 텍스트는 임의로 영어화하지 말 것(Korean-first).
- 각 카드 아이콘은 `src/components/ui`의 `Icon`(`IconName`) 범위에서 선택(`report`/`dashboard`/`users`/`arrow-right` 등). 없는 아이콘이 꼭 필요하면 `Icon.tsx`에 path 추가(기존 항목 변경 금지)할 수 있으나 변경 파일 수에 포함되므로 먼저 보고한다.

## Files to create or update (allowed scope)
- `src/app/dashboard/page.tsx` — 섹션 순서/레이아웃/className 교체, 코치이 허브 추가
- (선택) `src/components/dashboard/CoacheeActionHub.tsx` — (신규) 액션 허브 presentational 컴포넌트
- (선택) `src/components/dashboard/DashboardSectionCard.tsx` — (신규) 공통 섹션 카드 presentational 컴포넌트

> 5개 이상 파일이 필요해지면 멈추고 보고할 것. 새 데이터 조회/스키마/쿼리/role 계산이 필요해지면 즉시 멈추고 보고할 것.

## 섹션 우선순위 (코치이 기준, 재배치)
1. 인사 히어로(이니셜 아바타 + `dashboard.hello` + `welcomeName` + 역할 배지)
2. **내 코칭 액션 허브** (코치이일 때) — 가장 크게
3. 시스템 공지(있을 때, `Badge` info 톤)
4. 내 프로필 — 간결한 요약 카드(표시 이름/이메일/상태 배지 + `dashboard.viewProfile` 링크). `profile === null` 분기 유지
5. 내 역할 — 역할 칩 리스트로 간결화(표 유지도 가능). 빈 상태 메시지 유지
6. 코치메이커 기능 / 관리자 센터 카드 — `showCoachMakerFeatureCards` / `showAdminCenterCard` 조건 **그대로**, 코치이 동선 아래에 둔다
- 비코치이(관리자/코치메이커만)는 허브가 숨겨지고 기존 섹션 위주로 보이도록 자연스럽게 분기(기존 조건만 사용).

## 절대 변경 금지 (CRITICAL)
- 데이터/세션: `getSession`, `getDashboardMe`, `getDashboardQuickLinksState`, `getActiveAnnouncementsForCurrentUser`, `createApiPerformanceLogger`/`perf.mark(...)` — 호출/인자 그대로
- 권한 분기: `roleValues`, `quickLinks`의 모든 플래그, `showAdminCenterCard`, `showMyMoksilgiCard`, `showCoachMakerFeatureCards`, `profile?.status !== "active"`, `result.ok`/`result.error.code` — 의미 그대로 (재사용만)
- redirect(`/login?redirectTo=...`), 기존 모든 `href`, `coachMakerFeatureCards` 배열, `PageNavigationButtons` props
- 라벨 헬퍼 `formatScope`/`getRoleLabel`/`getStatusLabel` 동작, 모든 기존 i18n 키
- DB enum 값, `package.json`, DB schema / RLS / API route, middleware

## Do NOT modify
- 위 "절대 변경 금지" / "핵심 방침" 전체
- `CoacheeBottomTabs`(허브는 같은 경로를 링크만 함, 탭 컴포넌트 자체는 수정 금지)
- 기존 컴포넌트 public props(optional prop 추가만 허용)
- 빌드 오류 해결 목적의 기능/조건/링크 삭제

## 디자인 / 품질
- 배경 `bg-surface-app`, 카드 `bg-surface-card` + `border-line-base` + `rounded-xl`, 텍스트 `text-ink-strong/base/muted`, 강조 `text-brand-600`/`bg-brand-50`. slate 하드코딩 제거, `profileStatusBadgeClass`는 `Badge` tone 매핑으로 대체.
- 컨테이너 `max-w-4xl` 중앙 정렬, 모바일 단일/2열·데스크톱 다열 반응형, 모바일 패딩 과하지 않게.
- Korean-first, `any` 금지, `@ts-ignore` 금지, 기존 shared type 우선. 접근성 `aria-label` 보강.

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인:
- 코치이 계정: 히어로 아래 "내 코칭" 허브(오늘/목실기/기록/성장) 노출, 각 카드 목적지 정확(`/my-coaching`, `/my-coaching/moksilgi`, `/my-coaching/records/daily`, `/my-coaching/goals`)
- 관리자/코치메이커 전용 계정: 허브 미노출 + 기존 코치메이커/관리자 카드 정상 노출
- 비로그인 redirect, `result.ok === false`, 비활성 계정, `profile === null`, 역할 없음 분기 화면 정상
- 새 통계/수치가 화면에 없는지(추정 데이터 없음) 확인

## Return
- 변경한 파일 목록
- 추가/재배치한 UI 요소(특히 코치이 허브)와 재사용한 권한 플래그
- 의도적으로 그대로 둔 항목(데이터·perf·권한 분기·href·i18n·라벨 헬퍼·탭)
- 검증 결과(typecheck / check:all / build)
