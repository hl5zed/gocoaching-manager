# /coachee-04-weekly-report — 주간 리포트 화면 (2단계)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows. Work on ONE feature only. 1–4 files.

## Task (한 줄)
피코치 "주간 리포트" 화면을 추가한다. 이번 주 날짜 범위, 요일별 실행률, 4영역별 주간 실행률, 가장 잘한/부족한 영역, 코치 피드백 요약, 다음 주 제안 한 줄을 보여준다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/report/weekly/page.tsx` — (신규)
- `src/lib/coaching/weekly-aggregate.ts` — (신규) 주간 집계 계산 유틸
- `src/lib/coaching/progress.ts` — 재사용

## Data sources (쿼리 의미 변경 금지)
- 일별 실행률: `moksilgi_monthly_records.daily_checks_json`에서 해당 주의 7일 집계
- 코치 피드백: `coach_feedback` (weekly_log 연결: feedback_text, encouragement, next_step)
- 주간 로그: `weekly_logs` (gratitude, message_to_coach 등 — 읽기)

## ⚠️ 데이터 주의 (보고 대상)
- 주간 집계 전용 테이블이 없다. 초기엔 클라이언트/서버 온더플라이 집계로 시작.
- 중기 제안: `weekly_summary` 신설 → **스키마 변경이므로 임의 생성 금지. STOP 후 승인 요청.**

## Requirements
1. 날짜·주 범위는 Asia/Bangkok 기준. 주 시작 요일은 기존 프로젝트 관례를 따른다(확인 후).
2. 요일별 막대(7개)·영역별 가로 바는 무거운 라이브러리 없이 div/SVG로 구현.
3. "가장 잘한/부족한 영역"·"다음 주 제안"은 규칙 기반(최고/최저 영역) 자동 산출. AI는 추후.
4. 코치 피드백이 없을 때 empty state.
5. 한국어 라벨, enum 변경 금지, no `any`/`@ts-ignore`, 기존 토큰·ui 재사용, 모바일 우선.

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
- 변경 파일 / 추가 기능 / 미변경 흐름 / 검증 결과 / 집계 방식 설명
