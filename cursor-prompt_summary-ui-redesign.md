# Cursor 작업 명령어 — 목실기 성취표 UI 리디자인

## 작업 목표

`/my-coaching/moksilgi/summary` 페이지를 디자이너 관점에서 전면 정리한다.
글씨 크기 통일, 카드 배치 정렬, 불필요한 문구 제거, 테이블 가독성 개선을 통해
자연스럽고 일목요연하며 통일성 있는 대시보드 레이아웃으로 바꾼다.

## 수정 파일 (1개)

- **EDIT**: `src/app/my-coaching/moksilgi/summary/page.tsx`

## 절대 건드리지 않을 것

- Supabase query (getMyMoksilgiSummary, goalAreasForPrint fetch)
- auth / role / profile 분기 로직
- MoksilgiPlanPrintEmbed 컴포넌트 (print-only, 이미 완성)
- `supabase/`, `package.json`

---

## 디자인 원칙 (이 기준으로 실행할 것)

| 요소 | 적용 클래스 기준 |
|------|----------------|
| 섹션 레이블 | `text-xs font-semibold uppercase tracking-widest text-ink-faint` |
| 페이지 제목 | `text-xl font-bold text-ink-strong` |
| 카드 라벨 | `text-xs font-medium text-ink-faint` |
| 카드 숫자 | `text-3xl font-bold tabular-nums text-ink-strong` |
| 테이블 헤더 | `text-xs font-semibold uppercase tracking-wide text-ink-muted` |
| 테이블 셀 숫자 | `text-sm text-right tabular-nums text-ink-base` |
| 서브 텍스트 | `text-sm text-ink-muted` |

---

## Step 1 — YearSelector 컴포넌트: 컴팩트 인라인 폼으로 교체

**수정 전:**
```tsx
function YearSelector({ year }: { year: number }) {
  return (
    <form className="print:hidden mt-5 flex flex-wrap items-end gap-3" method="get">
      <label className="block">
        <span className="text-sm font-medium text-ink-base">연도</span>
        <input
          className="mt-2 w-36 rounded-control border border-line-base bg-surface-card px-3 py-2"
          defaultValue={year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <button
        className="rounded-control bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
        type="submit"
      >
        조회
      </button>
    </form>
  );
}
```

**수정 후:**
```tsx
function YearSelector({ year }: { year: number }) {
  return (
    <form className="print:hidden flex items-center gap-2" method="get">
      <span className="text-xs font-medium text-ink-faint">연도</span>
      <input
        className="w-20 rounded-control border border-line-base bg-surface-card px-2 py-1.5 text-sm text-ink-strong"
        defaultValue={year}
        max={2100}
        min={2000}
        name="year"
        type="number"
      />
      <button
        className="rounded-control border border-line-base bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink-base hover:bg-line-soft"
        type="submit"
      >
        조회
      </button>
    </form>
  );
}
```

---

## Step 2 — 헤더 블록 전면 정리

현재 헤더는 "목실기 개인 성취표" 레이블 + `text-3xl` h1 + 설명 단락 2줄 + YearSelector + 오른쪽에 버튼 컬럼으로 나뉘어 있어 산만하다.
하나의 깔끔한 헤더 바로 통합한다.

**수정 전 (lines ~365-391):**
```tsx
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              목실기 개인 성취표
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              개인 목표와 실행전략 성취표
            </h1>
            <p className="mt-2 text-lg text-ink-base">목실기 연간 성취 요약</p>
            <p className="mt-3 max-w-3xl text-ink-muted">
              월별 체크리스트에 기록한 내용을 바탕으로 1월부터 12월까지의 성취율을 확인합니다.
            </p>
            <p className="mt-2 max-w-3xl rounded-control border border-line-base bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              이 화면은 결과를 보는 <span className="font-semibold text-ink-base">리포트</span>예요. 매일 실행 체크는 <span className="font-semibold text-ink-base">체크(월별 체크리스트)</span>에서 하세요.
            </p>
            <YearSelector year={year} />
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <PrintPageButton
              fileName={`moksilgi-my-summary-${year}`}
              label="목실기 성취표 출력"
            />
            <Link className="font-medium text-brand-600 underline" href="/my-coaching/moksilgi">
              목실기 작성으로 돌아가기
            </Link>
          </div>
        </div>
```

**수정 후:**
```tsx
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-base pb-5 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              목실기 개인 성취표
            </p>
            <h1 className="mt-1.5 text-xl font-bold text-ink-strong">
              {year}년 연간 성취 요약
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <YearSelector year={year} />
            <PrintPageButton
              fileName={`moksilgi-my-summary-${year}`}
              label="성취표 출력"
            />
            <Link
              className="text-sm font-medium text-ink-muted hover:text-brand-600"
              href="/my-coaching/moksilgi"
            >
              목실기 작성 →
            </Link>
          </div>
        </div>
```

---

## Step 3 — MonthOverMonthCard: 카드 높이 통일 + 패딩 정리

`MonthOverMonthCard`가 그리드에서 총달성률 카드와 높이를 맞추도록 `h-full`을 추가하고, `mt-6`을 그리드 gap으로 대체한다.

**수정 전:**
```tsx
  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6 print:mt-0">
      <p className="text-sm font-medium text-ink-faint">
        이번 달 종합 실행률 (전월 대비)
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-3xl font-semibold text-ink-strong">
          {formatPercent(current.total_rate)}
        </p>
        <p className={`text-lg font-semibold ${tone}`}>
          {arrow} {sign}
          {delta.toFixed(1)}%p
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        지난달 {formatPercent(previous.total_rate)} → 이번 달{" "}
        {formatPercent(current.total_rate)}
      </p>
    </section>
  );
```

**수정 후:**
```tsx
  return (
    <section className="h-full rounded-card border border-line-base bg-surface-card p-5 print:mt-0">
      <p className="text-xs font-medium text-ink-faint">
        이번 달 종합 실행률 (전월 대비)
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-bold tabular-nums text-ink-strong">
          {formatPercent(current.total_rate)}
        </p>
        <p className={`text-base font-semibold ${tone}`}>
          {arrow} {sign}{delta.toFixed(1)}%p
        </p>
      </div>
      <p className="mt-1.5 text-sm text-ink-muted">
        지난달 {formatPercent(previous.total_rate)} → 이번 달 {formatPercent(current.total_rate)}
      </p>
    </section>
  );
```

---

## Step 4 — SummaryRow: 숫자 우측 정렬 + tabular-nums 추가

**수정 전:**
```tsx
      <td className="px-3 py-2">{formatPercent(row.spiritual_rate)}</td>
      <td className="px-3 py-2">{formatPercent(row.intellectual_rate)}</td>
      <td className="px-3 py-2">{formatPercent(row.physical_rate)}</td>
      <td className="px-3 py-2">{formatPercent(row.social_rate)}</td>
      <td className="px-3 py-2">{formatPercent(row.other_rate)}</td>
      <td className="px-3 py-2">{formatPercent(row.total_rate)}</td>
      <td className="px-3 py-2">{formatPercent(row.average_rate)}</td>
```

**수정 후:**
```tsx
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.spiritual_rate)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.intellectual_rate)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.physical_rate)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.social_rate)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.other_rate)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.total_rate)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatPercent(row.average_rate)}</td>
```

---

## Step 5 — AchievementTable 전면 정리

헤더 텍스트에서 "목표N: " 접두사를 제거하고, 컬럼 헤더 스타일을 작고 통일감 있게 바꾼다.
테이블 제목도 계층을 명확히 한다. `min-w-[860px]`을 더 좁게 줄인다.

**수정 전:**
```tsx
  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
      <h2 className="text-lg font-semibold">
        개인 목표와 실행전략 성취표(연간 대비, 월별누적) (단위%)
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-base bg-surface-sunken text-left text-ink-muted">
              <th className="px-3 py-2 font-semibold">목표 / 성취</th>
              <th className="px-3 py-2 font-semibold">목표1: 영적 성장</th>
              <th className="px-3 py-2 font-semibold">목표2: 지적 성장</th>
              <th className="px-3 py-2 font-semibold">목표3: 육체적 성장</th>
              <th className="px-3 py-2 font-semibold">목표4: 사회적 성장</th>
              <th className="px-3 py-2 font-semibold">목표5: 기타</th>
              <th className="px-3 py-2 font-semibold">종합</th>
              <th className="px-3 py-2 font-semibold">평균</th>
            </tr>
          </thead>
```

**수정 후:**
```tsx
  return (
    <section className="mt-6 rounded-card border border-line-base bg-surface-card p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
          연간 성취표
        </p>
        <h2 className="mt-1 text-sm font-semibold text-ink-strong">
          개인 목표와 실행전략 성취표 (연간 대비, 월별누적) · 단위%
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-line-base text-left">
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap">월</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">영적 성장</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">지적 성장</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">육체적 성장</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">사회적 성장</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">기타</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">종합</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">평균</th>
            </tr>
          </thead>
```

---

## Step 6 — 통계 카드 섹션: 화면에서도 2열 그리드

현재 스크린에서 `space-y-6` (세로 나열)으로 되어 있다.
`md:grid-cols-2`로 바꿔서 화면에서도 가로 배열이 되도록 한다.

**수정 전 (line ~414):**
```tsx
            <div className="print:flex print:flex-row print:gap-4 print:items-stretch space-y-6 print:space-y-0">
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

**수정 후:**
```tsx
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:flex print:flex-row print:gap-4 print:items-stretch">
              {/* print-only 연도 카드 */}
              <section className="hidden print:block print:flex-1 rounded-card border border-line-base bg-surface-card p-5">
                <p className="text-xs font-medium text-ink-faint">연도</p>
                <p className="mt-3 text-3xl font-bold tabular-nums text-ink-strong">{year}년</p>
              </section>

              <section className="rounded-card border border-line-base bg-surface-card p-5 print:flex-1">
                <p className="text-xs font-medium text-ink-faint">{year}년 총 달성률</p>
                <p className="mt-3 text-3xl font-bold tabular-nums text-ink-strong">
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

## Step 7 — 하단 중복 카드 제거

총달성률이 상단 카드에 이미 표시되므로, 하단의 중복 카드를 삭제한다.

**삭제할 코드 (lines ~451-455):**
```tsx
            <section className="mt-6 rounded-card border border-line-base bg-surface-card p-6">
              <p className="text-ink-base">
                {year}년 총 달성률 {formatPercent(result.data.totalAchievementRate)}
              </p>
            </section>
```

이 블록 전체를 삭제한다.

---

## Step 8 — 데이터 없음 / 계획 없음 안내 메시지 스타일 통일

**수정 전:**
```tsx
            {!result.data.hasSummaryData ? (
              <div className="mb-5 rounded-control border border-amber-200 bg-amber-50 p-4 text-amber-900">
                아직 월별 체크리스트 기록이 없습니다.
              </div>
            ) : null}
```

**수정 후:**
```tsx
            {!result.data.hasSummaryData ? (
              <div className="mb-4 rounded-card border border-line-base bg-surface-sunken px-4 py-3 text-sm text-ink-muted">
                아직 월별 체크리스트 기록이 없습니다. 체크리스트에 기록하면 달성률이 계산됩니다.
              </div>
            ) : null}
```

---

## Step 9 — `<div className="mt-8">` 간격 조정

데이터 섹션 최상단 `mt-8` → `mt-6`으로 축소해 헤더와 카드 간격 통일.

**수정 전:**
```tsx
          <div className="mt-8">
```

**수정 후:**
```tsx
          <div className="mt-6">
```

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## 브라우저 확인 방법

1. `http://localhost:3000/my-coaching/moksilgi/summary?year=2026` 접속
2. 확인:
   - 헤더가 한 줄로 컴팩트하게 표시되는지 ✓
   - 연도 입력폼이 헤더 우측에 인라인으로 있는지 ✓
   - 총달성률 / 이번달실행률 카드가 2열 그리드로 나란히 있는지 ✓
   - 테이블 헤더가 작고 깔끔한지 ✓
   - 숫자가 우측 정렬 + tabular-nums로 세로 정렬이 맞는지 ✓
   - 하단 중복 달성률 카드가 사라졌는지 ✓

## Return 형식

- 수정한 파일
- 변경된 항목 목록
- typecheck / check:all / build 결과
