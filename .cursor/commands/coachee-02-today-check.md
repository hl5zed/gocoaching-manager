# /coachee-02-today-check — 오늘 실행 체크 화면

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- 스키마 변경이 필요하면 STOP 후 보고(아래 ⚠️ 참고).

## Task (한 줄)
피코치 "오늘 실행 체크" 화면을 추가한다. 4영역별 세부목표 체크박스, 완료/미완료 상태, "오늘 4개 중 N개 완료" 문구, 자동 저장을 제공한다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/check/page.tsx` — (신규) 체크 화면 (라우트 신설 시 하단 탭 경로도 함께 보고)
- `src/app/my-coaching/check/TodayCheckClient.tsx` — (신규) 체크 토글 클라이언트 컴포넌트
- `src/lib/coaching/progress.ts` — coachee-01에서 만든 실행률 유틸 재사용(없으면 함께 생성)
- (저장 API 필요 시) STOP 후 보고

## Data sources (쿼리 의미 변경 금지)
- 체크 항목: `moksilgi_goal_areas` + `moksilgi_detail_goals`
- 체크 상태 저장 위치: 현재는 `moksilgi_monthly_records.daily_checks_json` (월 레코드 JSON 안의 일별 키)

## ⚠️ 데이터 구조 주의 (보고 대상)
일별 체크가 월 레코드 JSON 안에 있어 "오늘만 빠르게 토글"에 비효율적이다.
- 단기: 기존 `daily_checks_json`에 오늘 날짜 키만 부분 머지(동시성 주의).
- 중기 제안: `daily_checklist`(또는 `daily_checks`) 테이블 분리 → **스키마 변경이므로 이 명령에서 임의 생성 금지. 필요하면 STOP 후 승인 요청.**

## Requirements
1. 행(row) 전체를 큰 터치 영역으로 토글. 체크박스 최소 44×44px.
2. 자동 저장(디바운스 ~800ms) + "저장됨" 토스트. 낙관적 UI, 실패 시 재시도. 명시적 "저장" 버튼은 보조로 유지.
3. 상단에 미니 진행 바 + "오늘 N개 중 M개 완료" 카운트. 토글 시 실시간 갱신.
4. 실행률은 `progress.ts`의 동일 식으로 계산(중복 계산 금지).
5. 날짜 키는 Asia/Bangkok 로컬 기준. enum 값 변경 금지, 한국어 라벨.
6. 기존 디자인 토큰·ui 컴포넌트 재사용. 모바일 우선 단일 컬럼.
7. no `any`, no `@ts-ignore`.

## Do NOT modify
- auth / role / profile / invitation RPC / weekly log save logic
- Supabase query 의미, DB schema / RLS / API route, package.json
- 기존 컴포넌트 public props (optional prop 추가만 허용)

## Verification
```bash
npm run typecheck
npm run check:all
npm run build
```

## Return
- 변경 파일 목록 / 추가 기능 / 미변경 흐름 / 검증 결과
- daily_checks_json 부분 머지 방식과 동시성 처리 설명
