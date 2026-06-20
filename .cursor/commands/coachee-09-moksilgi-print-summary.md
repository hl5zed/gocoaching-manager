# /coachee-09-moksilgi-print-summary — 목실기 "내 목실기 출력" 요약 인쇄 리디자인 (인쇄 표시 레이어만)

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1–4 files.
- 이 작업은 **인쇄(출력) 표시 레이어만** 바꾼다. 화면 편집 폼·저장 로직·데이터 조회는 변경하지 않는다.

## Task (한 줄)
`/my-coaching/moksilgi`의 "내 목실기 출력"(`PrintPageButton`)이, 편집 폼이 아니라 **읽기 전용 요약 문서**로 인쇄되도록 한다. 사명선언서·비전·핵심가치·목표·Ⅴ.실행전략을 한눈에 파악되도록 카드형으로 정리하고, **빈 항목은 출력에서 생략**한다.

## 배경 (현재 상태 / 재사용할 것)
- 인쇄는 `PrintPageButton`이 `window.print()` 호출 + `@media print` CSS(`print-only`/`print-hidden`/`print-section`/`print-card`/`print-report-title`)로 제어한다. 현재는 화면의 편집 아코디언/폼(빈 입력 포함)이 그대로 인쇄돼 한눈에 안 들어온다.
- 페이지에는 이미 plan 데이터와 헬퍼가 있다. **이것만 재사용**한다(필드 추정 금지):
  - 사명: `plan.mission_statement`, `plan.mission_bible_verse`, `plan.mission_description`
  - 비전: `plan.vision_year`, `plan.vision_statement`, `plan.vision_metrics`, `plan.vision_target`, `plan.vision_description`
  - 핵심가치: `coreValuesFromPlan(...)` → `MoksilgiCoreValue[]`(`value_name` / `meaning` / `practice_example`)
  - 목표: `plan.main_goal`, `plan.main_goal_description`
  - 실행전략: 영역(`result.data.areas`, `area_key`)별 세부목표(`result.data.detailGoals`) + `strategiesFromGoal(goal)` → `string[]`
  - 빈값 판정은 기존 `hasText` / `fieldValue` / `displayValue`를 사용한다.
- 섹션 제목은 기존 i18n 키/문구를 그대로 쓴다: `myCoaching.moksilgi.missionTitle`("Ⅰ. 사명선언서 (Mission)"), `...visionTitle`("Ⅱ. 비전 (Vision)"), `...coreValueTitle`("Ⅲ. 핵심가치 (Core Value)"), `...goalTitle`("Ⅳ. 목표"), 그리고 Ⅴ. 실행전략(현재 "Ⅴ. 목표에 따른 실행전략 기획안" 문구 키), 영역 라벨은 `AREA_TRANSLATION_KEY_BY_AREA_KEY`.

## Files to create or update (allowed scope)
- `src/app/my-coaching/moksilgi/page.tsx` — 인쇄용 요약 블록 추가 + 화면 편집 영역을 인쇄에서 숨김
- (선택) `src/components/coachee/MoksilgiPrintSummary.tsx` — (신규) 인쇄 전용 요약 presentational 컴포넌트

> 5개 이상 파일이 필요해지면 멈추고 보고할 것. 새 데이터 조회/스키마/필드 추가가 필요해지면 즉시 멈추고 보고할 것.

## 구현 지침
1. **인쇄 전용 요약 블록 추가** (`print-only` 컨테이너): 기존 `print-report-title print-only` 보고서 헤더 바로 아래에, plan 데이터를 읽기 전용으로 렌더한다. 각 섹션은 `print-section`/`print-card`(기존 인쇄 CSS) 또는 동일 톤의 카드로 만든다.
   - **Ⅰ. 사명선언서**: `mission_statement` 본문 + (있으면) 관련 성경구절(`mission_bible_verse`) + 사명 설명(`mission_description`).
   - **Ⅱ. 비전**: `vision_statement` 본문 + (있으면) 목표 연도(`vision_year`)·핵심 수치(`vision_metrics`)·대상(`vision_target`)·설명(`vision_description`)을 한 줄 메타로.
   - **Ⅲ. 핵심가치**: `coreValuesFromPlan` 결과 중 **내용이 있는 슬롯만**(가치명/의미/실천 중 하나라도 `hasText`) 렌더. 가치명 + 의미 + 실천 모습을 1행 카드로.
   - **Ⅳ. 목표**: `main_goal` + (있으면) `main_goal_description`.
   - **Ⅴ. 목표에 따른 실행전략 기획안**: 영역 순서대로, 각 영역의 세부목표(존재하는 것만)를 "영역 라벨 · 세부목표 제목"으로 묶고, `strategiesFromGoal(goal)`의 **비어있지 않은 전략만** 목록으로. 전략·세부목표가 없는 영역은 통째로 생략.
2. **빈 항목 생략 규칙**: 값이 비어있는 필드/슬롯/전략은 렌더하지 않는다. **해당 섹션에 표시할 내용이 하나도 없으면 그 섹션(Ⅰ~Ⅴ) 전체를 출력에서 생략**한다.
3. **화면 편집 영역을 인쇄에서 숨김**: 기존 `PlanForm`(아코디언/섹션 폼) + 진행률 카드 + 섹션 칩 내비 + Ⅴ 영역 카드(폼) + 하단 저장 바를 인쇄 시 보이지 않도록 `print-hidden`(또는 `data-print-hidden="true"`) 래퍼로 감싼다. 화면(스크린) 동작·레이아웃은 그대로 유지(이 클래스는 스크린에 영향 없음).
4. **출력 디자인**: A4 가독성 우선. 섹션 제목은 작은 강조(`text-brand-600`), 본문은 11–13px, 충분한 행간. 핵심가치/전략은 좌측 보더 또는 점 마커로 스캔 가능하게. 그리드는 인쇄에서 블록으로 떨어지는 기존 CSS와 충돌하지 않게 단순 구조 사용.
5. `PrintPageButton`의 라벨("내 목실기 출력")·`fileName`·`printOptions`·호출 방식은 변경하지 않는다.

## 절대 변경 금지 (CRITICAL)
- 데이터 조회/서버 액션: `getMyMoksilgi`, `saveMyMoksilgiPlan`, `saveMyMoksilgiDetailGoal`, `savePlanAction`, `saveDetailGoalAction` — 시그니처/호출/로직 그대로
- 모든 form `<input name>`/`<select name>`, hidden 필드, 핵심가치 5슬롯 구조, `searchParams`(`saved`/`error`/`edit`) 처리와 redirect 경로
- 기존 헬퍼(`coreValuesFromPlan`/`strategiesFromGoal`/`hasText`/`fieldValue`/`displayValue`/`isXComplete`/`xSummary`/`measurementLabel`)의 **동작** — 읽기용으로 호출만, 변경 금지
- 모든 `<I18nText>` i18n 키·fallback, `MoksilgiAppBar`/`LanguageSwitcher`/`PrintPageButton` 사용
- `AREA_TRANSLATION_KEY_BY_AREA_KEY`, area_key 등 DB enum/저장 값
- `PrintPageButton.tsx`의 `@media print` CSS 규칙(요약은 기존 `print-only`/`print-section` 클래스 위에서 동작)

## 데이터 추정 금지
- 위에 나열한 **기존 필드/헬퍼만** 사용한다. mission/vision/core_values/goal/strategy의 **새 필드명을 만들지 말 것.**
- 화면에 없는 새 수치/집계(달성률 등)를 인쇄용으로 새로 조회하거나 만들지 말 것.

## Do NOT modify
- 위 "절대 변경 금지" / "데이터 추정 금지" 전체
- DB schema / RLS / API route, `package.json`, 미들웨어/auth
- 기존 컴포넌트 public props(optional prop 추가만 허용)
- 빌드 오류 해결 목적으로 기능/필드/조건 삭제

## 품질
- Korean-first, `any` 금지, `@ts-ignore` 금지, 기존 shared type(`MoksilgiPlan`/`MoksilgiCoreValue`/`MoksilgiDetailGoal`/`MoksilgiGoalArea`) 우선.
- 토큰(`--brand/--ink/--line/--surface`) 사용, slate 하드코딩 금지.

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인(브라우저 인쇄 미리보기):
- 인쇄 미리보기에 **편집 폼/빈 입력이 보이지 않고**, Ⅰ~Ⅴ 요약만 깔끔히 출력
- 일부만 작성한 plan: 빈 핵심가치 슬롯·빈 전략·빈 섹션이 출력에서 생략됨
- 완전 미작성(plan 없음/빈 plan): 안내만 나오고 깨지지 않음
- 화면(스크린)에서는 기존 편집 흐름(섹션 펼침/저장/`?saved`)이 그대로 동작
- 영역 순서·라벨, 보고서 헤더(작성자/기간/출력일) 정상

## Return
- 변경한 파일 목록
- 추가한 인쇄 요약 구조와 빈값 생략 규칙
- 의도적으로 그대로 둔 항목(데이터·서버액션·form name·i18n·print CSS)
- 검증 결과(typecheck / check:all / build)
