# /coachee-03-today-record — 오늘 기록 화면

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.

## Task (한 줄)
피코치 "오늘 기록" 화면을 추가한다. 감사한 일 / 오늘 배운 점 / 기도 제목 / 실행 메모를 짧게 작성하고, 코치 공유 여부를 선택한 뒤 저장하면 "오늘" 화면으로 복귀한다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/records/daily/page.tsx` 또는 신규 record 폼 페이지 (기존 `DailyRecordsClient.tsx` 패턴 재사용)
- `src/app/my-coaching/records/daily/DailyRecordsClient.tsx` (기존 저장 흐름 재사용; 의미 변경 금지)

## Data mapping (기존 `daily_records` 재사용)
- 오늘 배운 점 → `daily_records.reflection`
- 실행 메모 → `daily_records.practice`
- 기도 제목 → `daily_records.prayer_request`
- 공유 → `daily_records.shared_with_coach` (+ `visibility`)

## ⚠️ 데이터 주의 (보고 대상)
- "감사한 일"은 `daily_records`에 전용 필드가 없다(`gratitude`는 `weekly_logs`에만 존재).
  - 옵션1(권장): `daily_records`에 `gratitude` 컬럼 추가 → **스키마 변경이므로 임의 진행 금지. STOP 후 승인 요청.**
  - 옵션2(승인 전 임시): "감사한 일"을 `reflection` 상단에 합치거나, 필드 4개 중 3개로 운영.

## Requirements
1. 각 항목은 짧은 textarea + 작성 부담을 줄이는 placeholder 예시.
2. 공유 토글은 명확한 on/off + "코치가 이 기록을 볼 수 있어요" 설명.
3. 부분 입력 허용. 빈 항목은 null 처리(빈 문자열 누적 금지).
4. 저장 성공 시 `/my-coaching`(오늘)로 복귀 + 완료 피드백.
5. 기존 저장 로직/상태(status) 규칙을 따른다. 새 저장 흐름 신설 금지.
6. 한국어 라벨, enum 값 변경 금지, no `any`, no `@ts-ignore`. 기존 토큰·ui 컴포넌트 재사용. 모바일 우선.

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
- "감사한 일" 처리 방식(옵션1 승인 요청 또는 옵션2 임시) 명시
