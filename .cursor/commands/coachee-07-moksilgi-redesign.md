# /coachee-07-moksilgi-redesign — 목실기 페이지 모바일 UI 리뉴얼 (표시 레이어만)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- 이 작업은 **표시(presentation) 레이어만 교체**한다. 데이터 흐름·저장 로직은 절대 변경하지 않는다.

## Task (한 줄)
`/my-coaching/moksilgi` 페이지를 모바일 우선으로 리뉴얼한다. 거대한 "항상 펼쳐진 단일 폼"을 "읽기 우선 + 접이식(아코디언) 섹션 + 4영역 색상 카드" 구조로 바꾸되, 모든 입력 필드·기능은 그대로 유지한다.

## Files to create or update (allowed scope)
- `src/app/my-coaching/moksilgi/page.tsx` — JSX/레이아웃/className만 교체
- (선택) `src/components/coachee/MoksilgiSection.tsx` — (신규) 접이식 섹션 presentational 컴포넌트
- (선택) `src/components/coachee/MoksilgiAreaCard.tsx` — (신규) 4영역 카드 presentational 컴포넌트

> 5개 이상 파일이 필요해지면 멈추고 보고할 것.

## 절대 변경 금지 (CRITICAL — 표시 레이어만)
- server action: `savePlanAction`, `saveDetailGoalAction` — 시그니처/로직 그대로
- 데이터 조회: `getMyMoksilgi`, 그리고 `saveMyMoksilgiPlan` / `saveMyMoksilgiDetailGoal` import 및 사용 방식
- **모든 form `<input name>` / `<select name>` 값**: plan_id, title, subtitle, period_start, period_end, written_at, author_name, region_name, regional_leader_name, coach_name, role_label, generation_label, team_name(hidden), mission_statement, mission_bible_verse, mission_description, vision_year, vision_metrics, vision_target, vision_statement, vision_description, core_value_name_{0..4}, core_value_meaning_{0..4}, core_value_practice_{0..4}, main_goal, main_goal_description, status(hidden), area_id, detail_goal_id, detail_title, detail_description, annual_target, monthly_target, unit, measurement_type, strategy_{1..3} — **이름·개수·핵심가치 5개 슬롯 구조 모두 그대로 유지**
- `<form action={savePlanAction}>` / `<form action={saveDetailGoalAction}>` 구조와 hidden 필드
- `MEASUREMENT_OPTIONS`, `AREA_TRANSLATION_KEY_BY_AREA_KEY`, `coreValuesFromPlan`, `strategiesFromGoal` 등 기존 헬퍼의 동작
- `searchParams`의 `saved`/`error` 처리, redirect 경로(`?saved=plan` 등)
- 인쇄(`PrintPageButton`, `print-root`/`print-only`/`print-report-title` 클래스), `LanguageSwitcher`, `I18nText` 사용과 모든 i18n 키
- area_key 등 DB enum 값, 저장 값

## Requirements (시안 반영)
1. 상단 앱바: 뒤로(/my-coaching), 제목 "목실기", 언어 전환, 인쇄 버튼.
2. 타이틀 블록: 기존 badge/title/subtitle/description(I18nText 키 그대로).
3. **작성 진행률 카드**: 작성된 섹션 수를 계산해 "N / 6 영역" + progress 바 표시. (plan 존재 여부 + 각 섹션 값 채움 여부로 클라이언트/서버 계산. 새 데이터 없음)
4. **가로 섹션 칩 내비**: 기본정보 · 사명 · 비전 · 핵심가치 · 목표 · 실행전략 (앵커 스크롤).
5. **접이식 섹션**: 각 섹션(기본정보/사명/비전/핵심가치/목표)은 기본 "읽기 요약 카드 + 수정" 형태. "수정"을 누르면 기존 폼(동일 input name)이 열린다.
   - 스트리밍/SSR 제약상 `<details>/<summary>` 또는 서버에서 펼침 상태를 쿼리(`?edit=mission`)로 제어하는 등, **기존 form submit이 정상 동작하는 방식**으로 구현. JS 상태로 폼을 언마운트하지 말 것(제출 보장).
   - 빈 섹션은 "작성하기" CTA, 채워진 섹션은 요약 + 완료 체크 아이콘.
6. **Ⅴ. 실행전략**: 4영역을 색·아이콘 카드로 표시. 영적(보라)·지적(파랑)·신체적(틸/브랜드)·사회적(앰버). 색은 dot/아이콘 색 + 라벨 + 아이콘을 함께 사용(색만으로 구분 금지). 각 카드에 세부목표 개수, 펼치면 기존 세부목표 리스트 + `DetailGoalForm`(동일 구조) 노출.
7. 하단 고정 저장 영역: "기본 정보 저장"(savePlanAction) 버튼 + 인쇄. 단, 실행전략의 세부목표 저장은 기존처럼 각 `DetailGoalForm`의 개별 제출 유지.
8. 디자인: 기존 토큰(`--brand-*`, `--surface-*`, `--ink-*`, `--line-*`)과 `src/components/ui`(Button, Card, Badge, ProgressBar, Icon) 재사용. 슬레이트 하드코딩 색 제거. 모바일 우선 단일 컬럼, 하단 탭(`CoacheeBottomTabs`)에 가리지 않게 여백 유지(`my-coaching/layout.tsx`).
9. 한국어 라벨(Korean-first), no `any`, no `@ts-ignore`, 기존 shared type 우선.

## Do NOT modify
- 위 "절대 변경 금지" 전체
- DB schema / RLS / API route, package.json
- 기존 컴포넌트 public props (optional prop 추가만 허용)

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인:
- 기본 정보 저장 → `?saved=plan` 정상 동작
- 세부 목표 저장 → `?saved=detail` 정상 동작
- 인쇄 출력 레이아웃 깨지지 않음
- 빈 plan(신규) 상태에서 "기본 정보를 먼저 저장" 안내 정상

## Return
- 변경한 파일 목록
- 추가/재배치한 UI 요소
- 의도적으로 그대로 둔 항목(server action·form name·i18n·print)
- 검증 결과(typecheck / check:all / build) 및 저장 동작 수동 확인 결과
