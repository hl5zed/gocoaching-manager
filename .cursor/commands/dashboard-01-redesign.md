# /dashboard-01-redesign — 대시보드(나의 홈) UI 리뉴얼 (표시 레이어만)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- 이 작업은 **표시(presentation) 레이어만 교체**한다. 데이터 조회·권한 분기·redirect·perf 로깅은 절대 변경하지 않는다.
- 이미 리뉴얼된 `/my-coaching/moksilgi`(모바일 셸 + 브랜드 토큰 + `src/components/ui`)와 **같은 디자인 시스템**으로 통일해 제품 일관성을 맞춘다.

## Task (한 줄)
`/dashboard` 페이지를 `/my-coaching/moksilgi`와 동일한 디자인 언어(브랜드 토큰 + Card/Badge/Button/Icon/ProgressBar)로 리뉴얼한다. 하드코딩된 slate 색을 토큰으로 교체하고, **강조 요소는 "나의 목실기" 진입(스포트라이트) 카드 하나로 한정**해 대시보드 → 목실기 동선을 시각적으로 연결한다. 모든 데이터·권한 분기·링크·i18n 키·기능은 그대로 유지한다.

## 강조 방침 (확정)
- **상단 요약/KPI 통계 섹션은 추가하지 않는다.** (이번 달 평균 달성률, 작성 진행률 등 집계 카드 금지)
- 시각적 강조는 **"나의 목실기" 스포트라이트 카드 1개**로만 준다. 나머지 섹션(프로필·역할·바로가기·기능 카드)은 동일 톤의 차분한 카드로 정리한다.
- 데스크톱 컨테이너 폭은 **`max-w-4xl`**(중앙 정렬)로 한다.

## Files to create or update (allowed scope)
- `src/app/dashboard/page.tsx` — JSX / 레이아웃 / className만 교체
- (선택) `src/components/dashboard/DashboardHero.tsx` — (신규) 인사 히어로 presentational 컴포넌트
- (선택) `src/components/dashboard/DashboardSectionCard.tsx` — (신규) 공통 섹션 카드 presentational 컴포넌트

> 5개 이상 파일이 필요해지면 멈추고 보고할 것. 새 데이터 조회/스키마/쿼리가 필요해지면 즉시 멈추고 보고할 것.

## 절대 변경 금지 (CRITICAL — 표시 레이어만)
- 데이터 조회/세션: `getSession`, `getDashboardMe`, `getDashboardQuickLinksState`, `getActiveAnnouncementsForCurrentUser`, `createApiPerformanceLogger` 및 모든 `perf.mark(...)` 호출 — 호출 위치·인자 그대로
- 권한/역할 분기: `roleValues`, `quickLinks`(및 그 안의 `showAdminUsers` / `showCoachLink` / `showMyCoachingLink` / `showCoacheeMessage` / `showNoRoleMessage`), `showAdminCenterCard`, `showMyMoksilgiCard`, `showCoachMakerFeatureCards`, `profile?.status !== "active"` 분기, `result.ok` / `result.error.code` 분기 — 조건식·의미 그대로
- redirect 경로(`/login?redirectTo=...`), 모든 `href`(`/profile`, `/admin`, `/coach`, `/my-coaching`, `/my-coaching/moksilgi`, `/my-coaching/records`, `/coach-maker`, `/coach-maker/moksilgi-progress` 등) — 변경/추가 금지
- 라벨 헬퍼: `formatScope`, `getRoleLabel`, `getStatusLabel`의 사용 방식과 반환값 — 화면 표시만 감싸되 값은 그대로
- `coachMakerFeatureCards` 배열의 `href` / `titleKey` / `descriptionKey` 값과 매핑
- 모든 `<I18nText k="...">` 키와 fallback 텍스트, `PageNavigationButtons`의 props(`className` 등)
- DB enum 값(`active`/`inactive`/`suspended`/`archived`/`anonymized`, role 값 등) — 저장/판정 값 그대로, 번역은 화면 표시만

## 데이터 추정 금지
- 대시보드에 **현재 없는 데이터**(목실기 월별 달성률 수치, 작성 진행률 등)를 새로 가져오거나 추정하지 말 것. `getDashboardMe`가 이미 반환하는 값만 사용한다.
- "나의 목실기" 스포트라이트 카드는 **수치 없이** 아이콘 + 제목 + 설명 + 화살표로 구성한다. (달성률 바/퍼센트 표시 금지 — 대시보드가 해당 데이터를 조회하지 않음)

## Requirements (시안 반영)
1. **상단 히어로 카드**: 이니셜 아바타 + 인사(`dashboard.personalHomeBadge` 뱃지 + `dashboard.hello` + `welcomeName`) + 역할 배지(들). 우측에 기존 `PageNavigationButtons`를 그대로 배치. 역할 배지는 `result.data.roles`의 role 값을 `roles.{role}` i18n / `getRoleLabel`로 표시(없으면 생략). **요약 통계 숫자는 넣지 않는다.**
2. **나의 목실기 스포트라이트 카드** (유일한 강조 요소): `showMyMoksilgiCard`일 때 노출. 좌측 brand(teal) 보더(`border-l` + `border-brand-600`) + 아이콘 + "나의 목실기"(`dashboard.myMoksilgi`) + 설명(`dashboard.myMoksilgiDescription`) + 우측 화살표(`Icon name="arrow-right"`). `href="/my-coaching/moksilgi"` 유지. **퍼센트/ProgressBar 없음.** 이 카드는 목실기 페이지의 영역 카드와 같은 시각 언어로 만들어 두 화면의 연결감을 준다.
3. **프로필 카드**: 토큰 기반 `Card`로 교체. 표시 이름/이메일/전체 이름/상태(`getStatusLabel` + `Badge` tone 매핑: active→success, suspended→warning, inactive/archived→neutral, anonymized→danger) + "프로필 보기"(`dashboard.viewProfile`) 링크 유지. `profile === null` 분기 메시지 유지.
4. **내 역할**: 기존 표를 유지하되 토큰으로 가독성 개선하거나, 역할 칩 리스트(역할 배지 + `formatScope` + `getStatusLabel`)로 재구성. 빈 상태 메시지(`dashboard.noActiveRole` 등) 유지.
5. **시스템 공지**: `Badge`(info 톤)로 "시스템 공지"/"관리자 전용" 표시. `announcement.title`/`announcement.body` 렌더 그대로(`whitespace-pre-line break-words` 유지).
6. **바로가기**: `quickLinks` 조건은 그대로 두고, 링크들을 아이콘 타일 그리드로 재배치. 각 항목 href/i18n 키 유지.
7. **코치메이커 기능 / 관리자 센터 카드**: 토큰 기반 `Card` + 아이콘 그리드로 교체. 조건/href/i18n 그대로.
8. **디자인 토큰**: 배경 `bg-surface-app`, 카드 `bg-surface-card` + `border-line-base` + `rounded-xl`(또는 `rounded-card`), 텍스트 `text-ink-strong/base/muted`, 강조 `text-brand-600` / `bg-brand-50`. **모든 `slate-*` 하드코딩 색 제거.** 의미색(emerald/amber/red/sky)은 `Badge` tone 또는 의미 표현에만 제한적으로 사용. `profileStatusBadgeClass` 같은 색 헬퍼는 `Badge` tone 매핑으로 대체.
9. **컴포넌트 재사용**: `src/components/ui`의 `Card`, `CardContent`, `Badge`, `Button`/`ButtonLink`, `Icon`, `ProgressBar`를 사용한다. `Icon`은 기존 `IconName`(`dashboard`/`users`/`settings`/`report`/`globe`/`logout`/`search`/`arrow-right` 등) 범위에서 선택한다. 없는 아이콘이 꼭 필요하면 `src/components/ui/Icon.tsx`에 path를 **추가**(기존 항목 변경 금지)할 수 있으나, 그러면 변경 파일 수에 포함되므로 먼저 보고한다.
10. **반응형 / 폭**: 컨테이너는 **`max-w-4xl`** 중앙 정렬. 모바일은 단일 컬럼, 데스크톱은 2~3열 그리드(프로필+역할 2열, 기능 카드 3열 등). `px`/`py`는 모바일에서 과하지 않게(예: `px-4 sm:px-6 py-6 sm:py-10`).
11. 한국어 라벨(Korean-first), `any` 금지, `@ts-ignore` 금지, 기존 shared type 우선.

## Do NOT modify
- 위 "절대 변경 금지" / "데이터 추정 금지" / "강조 방침" 전체
- auth / role / profile 흐름, DB schema / RLS / API route, `package.json`
- 기존 컴포넌트의 public props (optional prop 추가만 허용)
- 빌드 오류를 해결하려고 기능/조건/링크를 삭제하지 말 것

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인:
- 비로그인 시 `/login?redirectTo=%2Fdashboard` 정상 redirect
- `result.ok === false` / 비활성 계정 / `profile === null` / 역할 없음 분기 화면 정상
- 역할별 노출(`super_admin` 관리자 카드, `coach_maker` 코치메이커 카드, 코치/코치이 목실기 카드) 정상
- 모든 바로가기 링크 목적지 동일

## Return
- 변경한 파일 목록
- 추가/재배치한 UI 요소
- 의도적으로 그대로 둔 항목(데이터 조회·perf·권한 분기·href·i18n·라벨 헬퍼)
- 검증 결과(typecheck / check:all / build)
