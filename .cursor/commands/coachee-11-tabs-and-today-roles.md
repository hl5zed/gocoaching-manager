# /coachee-11-tabs-and-today-roles — 코치이 하단탭 재연결 + 라벨(계획) + '오늘' CTA 역할 정리

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files (여기서는 2개).
- 이 작업은 **내비게이션 연결(href)·활성 매칭·표시 라벨만** 바꾼다. 라우팅/권한/데이터 로직, 진행률 계산은 건드리지 않는다.
- `coachee-10-tabs-check-report-swap`을 포함·확장한다(이 명령 하나만 실행해도 됨).

## 목적 / 정보구조(IA) 정리
- 코치이가 **매일 목표 실행을 체크**하는 곳은 `/my-coaching/moksilgi/monthly`(일별 체크 달력)이다.
- 각 화면의 역할을 아래로 명확히 한다:
  - **오늘**(`/my-coaching`): 오늘 하루 실행 요약 홈(오늘 실행률 + 영역 카드 + 오늘 기록).
  - **체크**(`/my-coaching/moksilgi/monthly`): 이번 달 **일별 실행 체크**(달력 그리드 누적).
  - **계획**(`/my-coaching/moksilgi`): 사명·비전·핵심가치·목표·실행전략 기획안.
  - **월간 리포트**(`/my-coaching/moksilgi/summary`): 월별 성취 요약.

## Task (한 줄)
하단탭에서 "체크"를 일별 체크 페이지(monthly)로, "리포트"를 기획안 페이지로 재연결하고 라벨을 **"계획"**으로 바꾼다. 그리고 '오늘' 페이지의 라벨-목적지 불일치 CTA를 역할에 맞게 정리한다.

## Files to update (allowed scope)
- `src/components/navigation/CoacheeBottomTabs.tsx` — `tabs` 배열의 두 항목 `href`/`match`/`label`만 수정
- `src/app/my-coaching/page.tsx` — 하단 CTA 버튼의 **인라인 라벨 문자열만** 수정(아래 명시 항목)

> 그 외 파일 수정이 필요해지면 멈추고 보고할 것.

## 변경 1 — CoacheeBottomTabs.tsx
1. `key: "check"`(체크): `href: "/my-coaching/moksilgi/monthly"`, `match: "prefix"`(또는 `"exact"`). 라벨 "체크"·아이콘(`IconCheck`) 유지.
2. `key: "report"`(현재 "리포트"): `href: "/my-coaching/moksilgi"`, **`match: "exact"`**, **`label: "계획"`**. 아이콘(`IconReport`)·`key`는 그대로 둔다(내부 식별자라 변경 불필요).
   - `match: "exact"`가 핵심: `prefix`로 두면 `/moksilgi/monthly`에서 체크·계획이 **동시에 활성**된다. exact면 `/moksilgi`에서만 계획이 활성된다.
3. 나머지 탭(`today`/`record`/`growth`)과 마크업/스타일/`aria`/`isActive` 함수 규칙은 그대로 둔다.

## 변경 2 — my-coaching/page.tsx ('오늘' 페이지 CTA 역할 정리)
- 현재 CTA(스크린): "오늘 기록하기"→`/my-coaching/records/daily`, "주간 리포트"→`/my-coaching/moksilgi/monthly`, "월간 리포트"→`/my-coaching/moksilgi/summary`.
- 라벨-목적지 불일치 정리(목적지 `href`는 모두 **그대로**, 라벨 텍스트만 변경):
  1. "주간 리포트"(→ `/my-coaching/moksilgi/monthly`) → **"이번 달 체크"** 로 변경. (해당 페이지는 일별 체크 달력이며, 하단 "체크" 탭과 같은 목적지·역할)
  2. "월간 리포트"(→ `/my-coaching/moksilgi/summary`) → 그대로 두거나 **"월별 요약"** 으로 변경(요약/리포트 의미 명확화). 둘 중 하나만, 임의 영어화 금지.
  3. "오늘 기록하기"(→ `/my-coaching/records/daily`)는 그대로 둔다.
- 진행률(`overallRate`/`totalGoals` 등) 계산·`TodayAreaCard`·데이터 흐름은 변경 금지. **라벨 문자열만** 바꾼다.

## 절대 변경 금지
- 모든 CTA/탭의 **목적지 `href`**(라벨만 변경), 다른 탭(`today`/`record`/`growth`)
- `isActive` 함수 동작 의미, `CoacheeBottomTabs`/`my-coaching/page.tsx`의 레이아웃·스타일·`aria`
- 라우팅/미들웨어/권한/데이터, 대상 페이지들의 내용·로직, 서버 액션
- DB enum, `package.json`

## Requirements
1. 변경 최소화(경로/매칭/라벨 수준), 작동 중인 코드 리팩터링 금지.
2. Korean-first, `any` 금지, `@ts-ignore` 금지, 기존 타입(`CoacheeTab`) 그대로.

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인:
- `/my-coaching/moksilgi/monthly`: 하단 "체크"만 활성(계획 비활성)
- `/my-coaching/moksilgi`: 하단 "계획"만 활성(체크 비활성)
- '오늘' 페이지 CTA: "이번 달 체크" 클릭 → monthly로 이동, 라벨이 목적지와 일치
- 일별 체크 달력에서 오늘 체크 → 저장(`?saved=1`) 정상
- 나머지 탭(오늘/기록/성장) 경로·활성 정상

## Return
- 변경한 파일과 변경 항목(탭 href·match·label, '오늘' CTA 라벨)
- 활성 상태(중복 강조) 검증 결과
- 검증 결과(typecheck / check:all / build)
