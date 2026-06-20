# /coachee-01-today-home — 오늘의 목표(홈) 화면

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- If another file or a schema change is required, STOP and report why before editing.

## Task (한 줄)
피코치 "오늘의 목표(홈)" 화면을 추가한다. 오늘 날짜(Asia/Bangkok), 오늘 전체 실행률, 4영역(영적/지적/신체적/사회적) 목표 카드와 진행 상태, "오늘 기록하기" CTA, 주간/월간 리포트 바로가기를 보여준다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/page.tsx` — 기존 관계 정보 페이지를 "오늘의 목표" 홈으로 재구성 (기존 데이터 조회 의미는 변경하지 말 것; 표시 레이어만 교체)
- `src/lib/coaching/progress.ts` — (신규) 실행률 계산 공용 유틸
- (선택) `src/components/coachee/TodayAreaCard.tsx` — (신규) 4영역 카드 presentational 컴포넌트

> 5개 이상 파일이 필요해지면 멈추고 보고할 것.

## Data sources (read-only, 쿼리 의미 변경 금지)
- 4영역 정의: `moksilgi_goal_areas` (area_key: 'spiritual' | 'intellectual' | 'physical' | 'social' | 'other', area_title, sort_order)
- 영역별 세부목표: `moksilgi_detail_goals` (plan_id, area_id, title)
- 활성 계획: `moksilgi_plans` (profile_id 기준, status)
- 오늘 체크 상태: `moksilgi_monthly_records.daily_checks_json` (year, month, 그리고 오늘 날짜 키)
- 현재 사용자/관계: 기존 `getSession`, `getMyCoachingMe` 등 기존 헬퍼 재사용

## Requirements
1. 오늘 날짜·날짜 키는 반드시 사용자 로컬(Asia/Bangkok) 기준으로 생성한다. UTC 자정 경계 버그 주의. (profile timezone → org → 기본 'Asia/Bangkok' 순)
2. 실행률 계산은 `src/lib/coaching/progress.ts` 한 곳에서만 한다. 기본식: `완료 세부목표 수 / 오늘 대상 세부목표 수 × 100`.
3. 4영역은 색 + 아이콘 + 라벨을 항상 함께 사용(색만으로 구분 금지). 한국어 라벨, area_key 등 DB enum 값은 변경 금지.
4. 목표가 0개인 신규 피코치용 empty state 포함 ("아직 목표가 없어요").
5. 기존 디자인 토큰(`--brand-*`, `--surface-*`, `--ink-*`, `--line-*`)과 기존 `src/components/ui`(Button, Card, Badge, ProgressBar) 재사용.
6. 모바일 우선, 단일 컬럼, 4영역 2×2 그리드(좁으면 1열). 하단 탭(`CoacheeBottomTabs`)에 가리지 않도록 기존 `my-coaching/layout.tsx`의 하단 여백 유지.
7. "오늘 기록하기" → `/my-coaching/records/daily`, "주간 리포트" → `/my-coaching/moksilgi/monthly`(또는 신설 시 교체), "월간 리포트" 링크 포함.
8. no `any`, no `@ts-ignore`. 기존 shared type(`src/types/database.ts`, `src/types/rpc.ts`) 우선.

## Do NOT modify
- auth / role / profile / invitation RPC / weekly log save logic
- Supabase query 의미, DB schema / RLS / API route
- package.json, 기존 컴포넌트의 public props (optional prop 추가만 허용)

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```

## Return
- 변경한 파일 목록
- 추가한 기능
- 의도적으로 건드리지 않은 흐름
- 검증 결과(typecheck / check:all / build 각각)
