# Cursor 작업 명령어 — 목실기 성취표 출력 개선

## 작업 목표

`/my-coaching/moksilgi/summary` 페이지의 "목실기 성취표 출력" 클릭 시 인쇄 출력물을 아래 4가지 기준으로 개선한다.

1. **인트로 블록 숨김**: "목실기 개인 성취표 / 개인 목표와 실행전략 성취표..." 텍스트가 출력물에 나타나지 않도록
2. **통계 카드 가로 배열**: "연도 / {year}년 총 달성률 / 이번 달 종합 실행률" 3개 칸을 세로 → 가로로 균등 배치
3. **좌우 여백 50% 확대**: 인쇄 시 `px-6` → `px-9`
4. **목실기 계획 내용 삽입**: `MonthOverMonthCard`와 `AchievementTable` 사이에, 목실기 계획의 영역별 세부 목표+실행전략을 **인쇄 전용(print:block hidden)** 섹션으로 추가

## 수정 파일 (1개)

- **EDIT**: `src/app/my-coaching/moksilgi/summary/page.tsx`

## 건드리지 않을 것

- Supabase auth, role, profile 로직
- `getMyMoksilgiSummary` 함수 내부
- AchievementTable, SummaryRow 컴포넌트의 기존 동작
- `supabase/`, `package.json`

---

## Step 0 — 타입 및 데이터 fetch 추가

### 0a. 파일 상단에 타입 추가

기존 `OrganizationTimezoneRow` 타입 정의 아래에 아래 타입을 추가한다.

```tsx
type GoalAreaForPrint = {
  id: string;
  area_key: string;
  area_title: string | null;
  sort_order: number;
  moksilgi_detail_goals: Array<{
    id: string;
    goal: string | null;
    strategy: string | null;
    sort_order: number;
  }>;
};
```

### 0b. `MoksilgiSummaryPage` 함수 내부: result fetch 이후, return 이전에 plan 영역 데이터 fetch 추가

다음 코드를 `const result = await getMyMoksilgiSummary(...)` 와 `return (` 사이에 삽입한다.

```tsx
// print-only 목실기 계획 영역 데이터 fetch
const goalAreasForPrint: GoalAreaForPrint[] =
  result.ok && result.data.plan && serviceClient
    ? (
        (
          await serviceClient
            .from("moksilgi_goal_areas")
            .select(
              "id, area_key, area_title, sort_order, moksilgi_detail_goals(id, goal, strategy, sort_order)",
            )
            .eq("plan_id", result.data.plan.id)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true })
        ).data ?? []
      ) as GoalAreaForPrint[]
    : [];
```

---

## Step 1 — 새 함수 컴포넌트: MoksilgiPlanPrintEmbed 추가

`AchievementTable` 함수 정의 위에 아래 컴포넌트를 추가한다. 화면에서는 `hidden`, 인쇄 시에만 `print:block`으로 보인다.

```tsx
function MoksilgiPlanPrintEmbed({
  areas,
  planTitle,
}: {
  areas: GoalAreaForPrint[];
  planTitle: string | null;
}) {
  if (areas.length === 0) return null;

  return (
    <section className="hidden print:block mt-6 rounded-card border border-line-base bg-surface-card p-6">
      <h2 className="text-base font-semibold text-ink-strong">
        {planTitle ?? "목실기 계획"} — 목표 및 실행전략
      </h2>
      {areas.map((area) => (
        <div className="mt-4" key={area.id}>
          <h3 className="text-sm font-semibold text-ink-base">
            {area.area_title ?? area.area_key}
          </h3>
          {area.moksilgi_detail_goals.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">세부 목표 없음</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-ink-base">
              {area.moksilgi_detail_goals.map((dg) => (
                <li key={dg.id}>
                  <p className="font-medium">{dg.goal ?? "—"}</p>
                  {dg.strategy ? (
                    <p className="mt-0.5 text-xs text-ink-muted">{dg.strategy}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
```

---

## Step 2 — YearSelector: print-hidden → print:hidden 수정 (버그 수정)

`YearSelector` 컴포넌트의 className을 수정해서 인쇄 시 실제로 숨겨지도록 한다.

**수정 전:**
```tsx
function YearSelector({ year }: { year: number }) {
  return (
    <form className="print-hidden mt-5 flex flex-wrap items-end gap-3" method="get">
```

**수정 후:**
```tsx
function YearSelector({ year }: { year: number }) {
  return (
    <form className="print:hidden mt-5 flex flex-wrap items-end gap-3" method="get">
```

---

## Step 3 — MonthOverMonthCard: 인쇄 시 mt-6 제거

`MonthOverMonthCard` 내부 `<section>`에 `print:mt-0`를 추가해서 가로 flex 정렬 시 상단 여백이 생기지 않도록 한다.

**수정 전:**
```tsx
  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
```

**수정 후:**
```tsx
  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6 print:mt-0">
```

---

## Step 4 — 헤더 블록 print:hidden 추가

인트로 텍스트 + 버튼 영역 전체를 인쇄 시 숨긴다.

**수정 전 (line ~265):**
```tsx
        <div className="flex flex-wrap items-start justify-between gap-4">
```

**수정 후:**
```tsx
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
```

> print-report-title 블록(lines 260-264)도 `print-only` 클래스가 CSS에 정의되어 있지 않아 항상 노출된다.
> 이 블록에 `hidden print:block` 을 적용해 인쇄 시에만 보이도록 수정한다.
>
> **수정 전:**
> ```tsx
>         <div className="print-report-title print-only">
> ```
>
> **수정 후:**
> ```tsx
>         <div className="hidden print:block print-report-title">
> ```

---

## Step 5 — 통계 카드 3개를 인쇄 시 가로로 배열

현재 JSX 구조 (lines ~307-326):
```tsx
          <div className="mt-8">
            {!result.data.hasSummaryData ? (...) : null}

            <section className="rounded-card border border-line-base bg-surface-card p-6">
              <p className="text-sm font-medium text-ink-faint">{year}년 총 달성률</p>
              <p className="mt-2 text-4xl font-semibold text-ink-strong">
                {formatPercent(result.data.totalAchievementRate)}
              </p>
            </section>

            {year === currentYear ? (
              <MonthOverMonthCard
                currentMonth={currentMonthInTimezone}
                rows={result.data.rows}
              />
            ) : null}
```

**수정 후**: 인쇄 전용 "연도" 카드를 추가하고, 3개 카드를 flex-row로 감싼다.

```tsx
          <div className="mt-8">
            {!result.data.hasSummaryData ? (...) : null}

            <div className="print:flex print:flex-row print:gap-4 print:items-stretch space-y-6 print:space-y-0">
              {/* 인쇄 전용 연도 카드 */}
              <section className="hidden print:block flex-1 rounded-card border border-line-base bg-surface-card p-6">
                <p className="text-sm font-medium text-ink-faint">연도</p>
                <p className="mt-2 text-4xl font-semibold text-ink-strong">{year}년</p>
              </section>

              <section className="rounded-card border border-line-base bg-surface-card p-6 print:flex-1">
                <p className="text-sm font-medium text-ink-faint">{year}년 총 달성률</p>
                <p className="mt-2 text-4xl font-semibold text-ink-strong">
                  {formatPercent(result.data.totalAchievementRate)}
                </p>
              </section>

              {year === currentYear ? (
                <div className="print:flex-1">
                  <MonthOverMonthCard
                    currentMonth={currentMonthInTimezone}
                    rows={result.data.rows}
                  />
                </div>
              ) : null}
            </div>
```

---

## Step 6 — MoksilgiPlanPrintEmbed 삽입 위치 + 좌우 여백 확대

### 6a. MonthOverMonthCard 이후, AchievementTable 이전에 MoksilgiPlanPrintEmbed 삽입

**수정 전:**
```tsx
            <AchievementTable
              cumulativeRow={result.data.cumulativeRow}
              currentMonth={currentMonthForYear}
              rows={result.data.rows}
              year={year}
            />
```

**수정 후:**
```tsx
            {goalAreasForPrint.length > 0 ? (
              <MoksilgiPlanPrintEmbed
                areas={goalAreasForPrint}
                planTitle={result.data.plan.title}
              />
            ) : null}

            <AchievementTable
              cumulativeRow={result.data.cumulativeRow}
              currentMonth={currentMonthForYear}
              rows={result.data.rows}
              year={year}
            />
```

### 6b. `<main>` 좌우 여백 50% 확대

**수정 전 (line ~258):**
```tsx
    <main className="print-root min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
```

**수정 후:**
```tsx
    <main className="print-root min-h-screen bg-surface-app px-6 py-10 text-ink-strong print:px-9 print:py-4 print:bg-white">
```

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## 브라우저 확인 방법

1. `http://localhost:3000/my-coaching/moksilgi/summary` 접속
2. "목실기 성취표 출력" 버튼 클릭
3. 인쇄 미리보기에서 확인:
   - "목실기 개인 성취표 / 개인 목표와 실행전략 성취표..." 사라졌는지 ✓
   - 연도 / 총달성률 / 이번달종합실행률 카드가 가로로 나란히 있는지 ✓
   - 좌우 여백이 넓어졌는지 ✓
   - MonthOverMonthCard와 AchievementTable 사이에 영역별 세부목표+전략이 보이는지 ✓

## Return 형식

- 수정한 파일
- 변경된 동작
- typecheck / check:all / build 결과
