# /coachee-08-shell-topbar — 코치이 셸 상단 유틸바 추가 (나의 홈 + 로그아웃)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- 이 작업은 **신규 표시 컴포넌트 추가 + 레이아웃 마운트**만 한다. 기존 인증/세션 로직은 새로 작성하지 않고 **이미 검증된 패턴을 재사용**한다.

## Task (한 줄)
`/my-coaching` 코치이 셸(하위 페이지 전체)에서 **"나의 홈"(상위 메뉴, `/dashboard`) 이동 버튼**과 **로그아웃 버튼**에 항상 접근할 수 있도록, `my-coaching/layout.tsx` 상단에 슬림 유틸바(`CoacheeTopBar`)를 추가한다.

## 배경 (현재 상태)
- `my-coaching/layout.tsx`는 콘텐츠를 감싸고 하단에 `CoacheeBottomTabs`(오늘/체크/기록/리포트/성장) 5탭만 둔다. **상위 메뉴 복귀(대시보드)나 로그아웃 입구가 없다.**
- 로그아웃 표준 구현이 이미 `src/components/navigation/PageNavigationButtons.tsx`에 있다: `createSupabaseBrowserClient().auth.signOut()` 성공 시 `router.replace("/login")` + `router.refresh()`, 실패 시 `window.alert(t("auth.signOutFailed", ...))`. **이 패턴을 그대로 따른다.**

## Files to create or update (allowed scope)
- `src/components/navigation/CoacheeTopBar.tsx` — (신규) 클라이언트 컴포넌트("나의 홈" 링크 + 로그아웃 버튼)
- `src/app/my-coaching/layout.tsx` — 상단에 `CoacheeTopBar` 마운트(레이아웃 래퍼 className 최소 조정)

> 5개 이상 파일이 필요해지면 멈추고 보고할 것. 새 데이터 조회/스키마/미들웨어 변경이 필요해지면 즉시 멈추고 보고할 것.

## 구현 지침 (CoacheeTopBar)
1. `"use client"` 컴포넌트. `useRouter`, `useI18n`(`t`), `createSupabaseBrowserClient` 사용.
2. 로그아웃 핸들러는 `PageNavigationButtons.handleSignOut`과 **동일하게** 구현(새 인증 로직 작성 금지):
   - `setIsSigningOut(true)` → `const { error } = await supabase.auth.signOut()`
   - error 있으면 `setIsSigningOut(false)` + `window.alert(error.message || t("auth.signOutFailed", "로그아웃하지 못했습니다."))` 후 return
   - 성공 시 `router.replace("/login")` + `router.refresh()`
3. UI 구성(우측 정렬):
   - "나의 홈": `ButtonLink href="/dashboard" icon="dashboard" size="sm"` + 라벨 `t("nav.dashboard", "나의 홈")`
   - "로그아웃": `Button icon="logout" size="sm" variant="ghost" type="button" disabled={isSigningOut}` + 라벨 `isSigningOut ? t("auth.signingOut", "로그아웃 중...") : t("auth.signOut", "로그아웃")`
   - `src/components/ui`의 `Button` / `ButtonLink` / `Icon`만 사용한다(신규 버튼 스타일 금지).
4. 스타일: 이미 리뉴얼된 목실기 셸의 `MoksilgiAppBar`와 같은 톤. 예) `sticky top-0 z-40 border-b border-line-base bg-surface-app/95 px-4 py-2 backdrop-blur`, 내부는 `mx-auto flex w-full max-w-md items-center justify-between gap-2`. 좌측에는 짧은 셸 라벨(예: `t("nav.myCoachingSpace", "내 코칭 공간")` 또는 기존 i18n 키)을 `text-sm font-medium text-ink-strong`로 둔다.
5. `aria-label`로 내비 영역 표기(예: `aria-label="코치이 상단 메뉴"`). 인쇄 시 숨김: `print:hidden`.
6. **LanguageSwitcher는 넣지 않는다.** (목실기/일부 하위 페이지가 자체 앱바에 언어 전환을 이미 가지고 있어 중복을 피한다.)

## 레이아웃 마운트 (my-coaching/layout.tsx)
- `children` 위, 스크롤 컨테이너 안쪽 최상단에 `<CoacheeTopBar />`를 렌더한다.
- 기존 `mx-auto w-full max-w-md pb-24` 래퍼와 `CoacheeBottomTabs` 구조/여백은 유지한다(하단 탭이 콘텐츠를 가리지 않도록).
- 인증/세션 호출이나 서버 데이터 패칭을 레이아웃에 새로 추가하지 말 것. `CoacheeTopBar`는 순수 표시/클라이언트 동작만 한다.

## 절대 변경 금지 (CRITICAL)
- `supabase.auth.signOut()` 외의 인증/세션/미들웨어/role/profile 로직 — 일절 수정 금지 (새 로직 작성도 금지, 기존 패턴 재사용만)
- `middleware.ts`, `getSession`, `createSupabaseServerClient`, route-access 규칙
- `CoacheeBottomTabs`(탭 구성/href/라벨), `MoksilgiAppBar` 및 모든 하위 페이지의 콘텐츠·데이터 흐름
- 기존 컴포넌트의 public props (optional prop 추가만 허용), 모든 기존 `href`·라우트
- 모든 기존 `<I18nText>`/`t(...)` i18n 키 — 재사용만 하고 의미 변경 금지
- DB enum 값, `package.json`

## Do NOT modify
- 위 "절대 변경 금지" 전체
- DB schema / RLS / API route
- 빌드 오류 해결 목적으로 기능/링크/조건 삭제

## Requirements 요약
1. 변경 최소화, 요청 기능(나의 홈 + 로그아웃)만 추가.
2. 작동 중인 코드 리팩터링 금지.
3. Korean-first 라벨, 기존 i18n 키 재사용.
4. `any` 금지, `@ts-ignore` 금지, 기존 shared type 우선.
5. 토큰(`--brand/--surface/--ink/--line`)과 `src/components/ui` 재사용, slate 하드코딩 금지.

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인:
- `/my-coaching`, `/my-coaching/moksilgi`, `/my-coaching/moksilgi/monthly`, `/my-coaching/records/daily`, `/my-coaching/goals` 상단에 유틸바 노출
- "나의 홈" 클릭 시 `/dashboard` 이동
- "로그아웃" 클릭 시 세션 종료 후 `/login`으로 이동, 실패 시 alert
- 하단 탭이 콘텐츠를 가리지 않음(여백 유지), 인쇄 시 유틸바 숨김
- 자체 앱바가 있는 목실기 페이지에서 상단 바 **중복/겹침**이 어색하지 않은지 확인(겹치면 보고 — `MoksilgiAppBar`는 수정하지 말 것)

## Return
- 변경한 파일 목록
- 추가한 UI 요소(나의 홈/로그아웃)와 재사용한 로그아웃 패턴 출처
- 의도적으로 그대로 둔 항목(인증/미들웨어/탭/하위 페이지·i18n)
- 검증 결과(typecheck / check:all / build)
