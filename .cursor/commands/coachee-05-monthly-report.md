# /coachee-05-monthly-report — 월간 리포트 화면 (2단계)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows. Work on ONE feature only. 1–4 files.

## Task (한 줄)
피코치 "월간 리포트" 화면을 추가한다. 월간 전체 실행률, 4영역별 실행률, 일자별 실행률 그래프, 연속 실행일(스트릭), 가장 꾸준한/보완 필요 영역, 코치 피드백 목록, "월간 회고 작성" 버튼을 보여준다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/report/monthly/page.tsx` — (신규) 또는 기존 `moksilgi/monthly` 재사용 여부 보고 후 결정
- `src/lib/coaching/monthly-view.ts` — (신규) 일자별 실행률·스트릭 계산 유틸

## Data sources (쿼리 의미 변경 금지)
- 월간 영역별 집계: `moksilgi_monthly_summaries` (spiritual_rate, intellectual_rate, physical_rate, social_rate, total_rate, average_rate) — **이미 존재, 그대로 활용**
- 일자별 실행률·스트릭: `moksilgi_monthly_records.daily_checks_json`에서 계산(별도 필드 없음)
- 코치 피드백: `coach_feedback`
- 월간 회고: `monthly_reflections` (summary, growth_points, difficulty, next_month_plan)

## Requirements
1. 월 선택(이전/다음 달) 가능. 날짜는 Asia/Bangkok 기준.
2. 일자별: 라인 차트 또는 미니 히트맵 달력(잔디형). 영역별: 도넛/가로 바. 경량 구현(가능하면 SVG 직접).
3. 연속 실행일은 일일 체크에서 파생 계산.
4. `monthly_summaries`의 집계 최신성(재계산 시점) 확인 후 표시.
5. "월간 회고 작성" → `monthly_reflections` 작성 폼으로 연결(기존 흐름 재사용).
6. 한국어 라벨, enum 변경 금지, no `any`/`@ts-ignore`, 기존 토큰·ui 재사용, 모바일 우선.

## Do NOT modify
- auth / role / profile / invitation RPC / weekly log save logic
- DB schema / RLS / API route, Supabase query 의미, package.json
- 기존 컴포넌트 public props (optional prop 추가만 허용)

## Verification
```bash
npm run typecheck
npm run check:all
npm run build
```

## Return
- 변경 파일 / 추가 기능 / 미변경 흐름 / 검증 결과
