# Cursor 작업 명령어 — 이번 주 일일 점검 위젯 추가

## 작업 목표
`/my-coaching` 페이지에 **이번 주 일일 점검** 위젯(WeeklyCheckStrip)을 추가한다.
TodayTodoList 직후, 바로가기 버튼 카드 직전에 삽입한다.

## 수정 파일 (최대 2개)
- **NEW**: `src/components/coachee/WeeklyCheckStrip.tsx`
- **EDIT**: `src/app/my-coaching/page.tsx`

## 건드리지 않을 것
- `weekly_logs` 테이블 및 저장 로직
- `moksilgi_monthly_records` 저장 로직 (읽기만 사용)
- invitation / auth / role / profile 흐름
- `supabase/` 폴더 전체
- `package.json`

---

## Step 1 — 신규 컴포넌트 생성

파일: `src/components/coachee/WeeklyCheckStrip.tsx`

**역할**: 현재 주(월~일)의 각 날짜에 대해 "해당 날 1개 이상의 daily_check가 완료됐는지"를 읽기 전용으로 표시하는 순수 UI 컴포넌트.

**props**:
```ts
type Props = {
  /** 오늘 날짜 (YYYY-MM-DD) */
  todayDateKey: string;
  /** 이번 달 모든 상세목표의 daily_checks_json 배열 (이미 페이지에서 조회된 데이터) */
  records: Array<{ daily_checks_json: unknown }>;
  /** 현재 연도 */
  year: number;
  /** 현재 월 (1-12) */
  month: number;
};
```

**구현 조건**:
1. `todayDateKey`로 이번 주 월요일 ~ 일요일의 day 번호를 계산한다.
2. 각 day에 대해 `records` 배열 중 하나라도 그 날이 checked면 `done` 상태로 표시한다.
3. 오늘 day는 `today` 상태로 표시 (navy 배경, "오늘" 텍스트).
4. 오늘 이후 미래 날짜는 `future` 상태 (비활성, 회색).
5. 체크 안 된 과거 날짜는 `missed` 상태 (회색 빈 칸).
6. daily_checks_json 파싱은 아래 규칙을 따른다:
   - `{ "1": true, "2": false }` 형태 (숫자 키)
   - `{ "2024-06-01": true }` 형태 (날짜 키) 둘 다 허용
7. 컴포넌트 내부에서 `import`된 외부 라이브러리 없이 순수 Tailwind + 기존 Card 컴포넌트만 사용한다.
8. `any` 사용 금지, `@ts-ignore` 사용 금지.

**레이아웃**:
- 카드 상단에 `"이번 주 일일 점검"` 제목
- 7개 day 버튼을 `flex` row로 균등 배치
- 각 버튼 아래에 요일 레이블 (월 화 수 목 금 토 일)
- done: gt-green 배경 + 흰색 ✓
- today: navy 배경 + "오늘"
- missed: 밝은 회색 빈 칸
- future: 더 연한 회색 빈 칸

**Tailwind 클래스 참고** (프로젝트 기존 토큰 사용):
- 카드: `border-line-base bg-surface-card`
- done 버튼: `bg-emerald-500 text-white`
- today 버튼: `bg-[#1a2744] text-white`
- missed/future 버튼: `bg-surface-sunken text-ink-muted`

---

## Step 2 — page.tsx 수정

파일: `src/app/my-coaching/page.tsx`

**추가할 것**:
1. `WeeklyCheckStrip` import 추가
2. `recordsResult.data`를 `WeeklyCheckStrip`에 props로 전달 (이미 조회된 데이터 재사용, 추가 DB 쿼리 없음)
3. JSX에서 `TodayTodoList` 블록 직후, 바로가기 버튼 Card 블록 직전에 `WeeklyCheckStrip` 삽입

**삽입 위치** (현재 page.tsx 기준):
```
{todayTodos.length > 0 ? (
  <TodayTodoList ... />
) : null}

{/* ← 여기에 WeeklyCheckStrip 삽입 */}

<Card className="border-line-base bg-surface-card">  {/* 바로가기 버튼 카드 */}
```

**props 전달 예시**:
```tsx
<WeeklyCheckStrip
  todayDateKey={todayDateKey}
  records={(recordsResult.data ?? []).map((r) => ({ daily_checks_json: r.daily_checks_json }))}
  year={currentYear}
  month={currentMonth}
/>
```

**주의**: `plan`이 없을 때는 `recordsResult`가 없으므로, `plan`이 있을 때만 표시하거나 빈 배열을 기본값으로 처리한다.

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## Return 형식

- 생성/수정한 파일
- 추가된 정확한 동작
- 의도적으로 건드리지 않은 것
- typecheck / check:all / build 결과
