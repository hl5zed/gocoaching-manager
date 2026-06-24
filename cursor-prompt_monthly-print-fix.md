# Cursor 작업 명령어 — 월별 목실기 출력 품질 개선

## 작업 목표

`/my-coaching/moksilgi/monthly` 페이지의 "월별 목실기 출력" 클릭 시 인쇄 출력물을 아래 4가지 기준으로 개선한다.

1. **인트로 블록 숨김**: "목실기 월별 체크리스트 / 월별 실행 기록과 달성률 자동 계산..." 텍스트 블록이 출력물에 나타나지 않도록
2. **좌우 여백 확대**: 인쇄 시 `max-w-md` 제한을 해제하고 좌우 padding을 px-4 → px-6 (40% 확대)로 조정
3. **영역 카드 숨김**: 영적/지적/신체적/사회적 네모 카드 전체가 출력물에 나타나지 않도록
4. **월별 요약 표 컬럼 균등**: 8개 열(월/영적/지적/신체적/사회적/기타/종합/평균)이 동일 너비가 되도록 수정

## 수정 파일 (1개)

- **EDIT**: `src/app/my-coaching/moksilgi/monthly/page.tsx`

## 건드리지 않을 것

- `savePlanAction`, `saveMonthlyRecordAction` 등 서버 액션
- `MonthlyRecordForm`, `MoksilgiAreaCard`, `Summary` 컴포넌트의 비-print 동작
- Supabase query, auth 로직, role 로직
- `supabase/`, `package.json`

---

## Step 1 — 인트로 블록에 print:hidden 추가

파일: `src/app/my-coaching/moksilgi/monthly/page.tsx`

**수정 전 (line ~763):**
```tsx
        <div className="pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
```

**수정 후:**
```tsx
        <div className="pt-2 print:hidden">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
```

---

## Step 2 — 인쇄 시 좌우 여백 확대 및 max-w-md 해제

### 2a. `<main>` 태그 수정

**수정 전 (line ~728):**
```tsx
    <main className="print-root min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
```

**수정 후:**
```tsx
    <main className="print-root min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base print:px-6 print:py-2 print:pb-0 print:bg-white">
```

### 2b. `<section>` 태그 수정

**수정 전 (line ~762):**
```tsx
      <section className="mx-auto w-full max-w-md space-y-4">
```

**수정 후:**
```tsx
      <section className="mx-auto w-full max-w-md space-y-4 print:max-w-none">
```

---

## Step 3 — 영역 카드 전체를 print:hidden으로 감싸기

파일: `src/app/my-coaching/moksilgi/monthly/page.tsx`

아래의 `<div className="space-y-3">` 블록 (areaStats.map 시작 부분) 전체를 `print:hidden` div로 감싼다.

**수정 전 (line ~901):**
```tsx
            <div className="space-y-3">
              {areaStats.map(({ area, areaGoals, areaAverage }) => (
                <MoksilgiAreaCard
```

**수정 후:**
```tsx
            <div className="print:hidden">
            <div className="space-y-3">
              {areaStats.map(({ area, areaGoals, areaAverage }) => (
                <MoksilgiAreaCard
```

그리고 해당 `</div>` 닫힘 태그 (areaStats.map 끝 부분, line ~950) 아래에 닫힘 태그 하나 추가:

**수정 전 (line ~950):**
```tsx
            </div>

            <Summary selectedMonth={month} summaries={result.data.yearlySummaries} />
```

**수정 후:**
```tsx
            </div>
            </div>

            <Summary selectedMonth={month} summaries={result.data.yearlySummaries} />
```

---

## Step 4 — 월별 요약 표 컬럼 균등 너비

파일: `src/app/my-coaching/moksilgi/monthly/page.tsx`

### 4a. `<table>` 에 print:table-fixed 추가

**수정 전 (line ~567):**
```tsx
          <table className="min-w-[680px] w-full border-collapse text-sm">
```

**수정 후:**
```tsx
          <table className="min-w-[680px] w-full border-collapse text-sm print:table-fixed">
```

### 4b. thead 안 모든 `<th>` 에 print:w-[12.5%] 추가

`<thead>` 안에 `<th>` 가 총 8개 있다 (월, 영적, 지적, 신체적, 사회적, 기타, 종합, 평균).  
각 `<th>` 의 className 에 `print:w-[12.5%]` 를 추가한다.

**수정 전:**
```tsx
                <th className="px-3 py-2 font-medium">
                  <I18nText k="myCoaching.moksilgi.monthly.month" fallback="월" />
                </th>
                {headerCols.map((col) => (
                  <th className="px-3 py-2 font-medium" key={col.key}>
```

```tsx
                <th className="px-3 py-2 font-medium">
                  <I18nText k="myCoaching.moksilgi.monthly.total" fallback="종합" />
                </th>
                <th className="px-3 py-2 font-medium">
                  <I18nText k="myCoaching.moksilgi.monthly.average" fallback="평균" />
                </th>
```

**수정 후:**
```tsx
                <th className="px-3 py-2 font-medium print:w-[12.5%]">
                  <I18nText k="myCoaching.moksilgi.monthly.month" fallback="월" />
                </th>
                {headerCols.map((col) => (
                  <th className="px-3 py-2 font-medium print:w-[12.5%]" key={col.key}>
```

```tsx
                <th className="px-3 py-2 font-medium print:w-[12.5%]">
                  <I18nText k="myCoaching.moksilgi.monthly.total" fallback="종합" />
                </th>
                <th className="px-3 py-2 font-medium print:w-[12.5%]">
                  <I18nText k="myCoaching.moksilgi.monthly.average" fallback="평균" />
                </th>
```

> **주의**: `headerCols.map` 안의 `<th>` 는 map 렌더링이므로 className 수정이 5개 열 전체에 적용된다. 합계: 1(월) + 5(headerCols) + 1(종합) + 1(평균) = 8개 열 = 100%.

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## 브라우저 확인 방법

1. `http://localhost:3000/my-coaching/moksilgi/monthly` 접속
2. "월별 목실기 출력" 버튼 클릭
3. 인쇄 미리보기에서 확인:
   - "목실기 월별 체크리스트 / 월별 실행 기록과 달성률 자동 계산..." 텍스트 사라졌는지 ✓
   - 본문이 A4 종이 좌우를 더 넓게 채우는지 ✓
   - 영적/지적/신체적/사회적 카드가 사라졌는지 ✓
   - 월별 요약 표의 8개 열 너비가 동일한지 ✓

## Return 형식

- 수정한 파일
- 변경된 동작
- typecheck / check:all / build 결과
