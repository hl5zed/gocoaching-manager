# /coachee-06-my-growth — 나의 성장 화면

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows. Work on ONE feature only. 1–4 files.

## Task (한 줄)
피코치 "나의 성장" 화면을 추가한다. 미션 / 비전 / 핵심가치 / 장기 목표 / 4영역 목표를 보여주고, 각 4영역 목표를 현재(이번 달) 실행률과 연결해 보여준다. 공개/비공개(코치 확인 가능) 구분을 표시한다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/goals/page.tsx` — "나의 성장"으로 재구성 (또는 신규 `growth/page.tsx`; 위치는 보고 후 결정)
- `src/components/coachee/GrowthSection.tsx` — (신규) presentational 섹션 컴포넌트

## Data sources (쿼리 의미 변경 금지)
- 미션/비전/핵심가치/목표: `moksilgi_plans` (mission_statement, vision_statement, **core_values_json**, main_goal) — **이미 존재**
- 4영역 목표: `moksilgi_goal_areas` + `moksilgi_detail_goals`
- 실행률: `moksilgi_monthly_summaries`

## ⚠️ 데이터 주의
- `core_values_json`의 실제 구조를 **추정하지 말 것**(CLAUDE.md 15항). 실제 데이터를 확인한 뒤 렌더링.
- mission/vision/core_values 필드명을 임의로 가정/변경 금지.

## Requirements
1. 미션/비전/핵심가치는 읽기 중심. "수정"은 명시적 진입이며, 편집은 기존 moksilgi 편집 화면 재사용을 우선(중복 편집 UI 신설 지양).
2. 4영역 목표 옆에 미니 실행률 바로 "방향 ↔ 실천" 연결을 시각화.
3. 공개/비공개: 기존 `visibility` 패턴 차용. 코치 확인 가능 항목엔 "코치 확인 가능" 배지, 비공개엔 자물쇠 아이콘. (기본 공개 정책은 운영자 확인 필요 — 불확실하면 보고)
4. 한국어 라벨, enum 변경 금지, no `any`/`@ts-ignore`, 기존 토큰·ui 재사용, 모바일 우선.

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
- core_values_json 실제 구조와 렌더 방식 설명
