# Cursor 작업 명령어 — 목실기 출력 품질 개선

## 작업 목표

`/my-coaching/moksilgi` "내 목실기 출력" 시 두 가지를 수정한다.

1. **하단 탭 숨김**: "오늘/목표/체크/기록/리포트" 탭 바가 출력물에 나타나지 않도록
2. **인쇄 여백 축소**: `max-w-md` 제한을 인쇄 시 해제해 본문이 A4 종이에 꽉 차도록

## 수정 파일 (3개)

- **EDIT**: `src/components/navigation/CoacheeBottomTabs.tsx`
- **EDIT**: `src/app/my-coaching/layout.tsx`
- **EDIT**: `src/app/my-coaching/moksilgi/page.tsx`

## 건드리지 않을 것

- 탭의 href, label, icon, 활성 상태 로직
- `savePlanAction`, `PlanForm`, `DetailGoalForm`
- `supabase/`, `package.json`
- `globals.css` (다른 페이지에 영향 없도록 수정하지 않음)

---

## Step 1 — CoacheeBottomTabs.tsx: 하단 탭에 print:hidden 추가

파일: `src/components/navigation/CoacheeBottomTabs.tsx`

**수정 전:**
```tsx
<nav
  aria-label="피코치 하단 메뉴"
  className={cn(
    "fixed inset-x-0 bottom-0 z-40 border-t border-line-base bg-surface-card",
    "pb-[env(safe-area-inset-bottom)]",
  )}
>
```

**수정 후:**
```tsx
<nav
  aria-label="피코치 하단 메뉴"
  className={cn(
    "fixed inset-x-0 bottom-0 z-40 border-t border-line-base bg-surface-card",
    "pb-[env(safe-area-inset-bottom)]",
    "print:hidden",
  )}
>
```

---

## Step 2 — layout.tsx: 인쇄 시 max-w-md 제한 해제

파일: `src/app/my-coaching/layout.tsx`

**수정 전:**
```tsx
export default function MyCoachingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-app">
      <div className="mx-auto w-full max-w-md pb-24">
        <CoacheeTopBar />
        {children}
      </div>
      <CoacheeBottomTabs />
    </div>
  );
}
```

**수정 후:**
```tsx
export default function MyCoachingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-app print:bg-white">
      <div className="mx-auto w-full max-w-md pb-24 print:max-w-none print:pb-0">
        <CoacheeTopBar />
        {children}
      </div>
      <CoacheeBottomTabs />
    </div>
  );
}
```

---

## Step 3 — moksilgi/page.tsx: 인쇄 시 내부 section 여백 축소

파일: `src/app/my-coaching/moksilgi/page.tsx`

### 3a. `<main>` 태그 수정

**수정 전:**
```tsx
<main className="print-root min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
```

**수정 후:**
```tsx
<main className="print-root min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base print:px-2 print:py-2 print:pb-0 print:bg-white">
```

### 3b. 내부 `<section>` 태그 수정

**수정 전:**
```tsx
<section className="mx-auto w-full max-w-md space-y-4">
```

**수정 후:**
```tsx
<section className="mx-auto w-full max-w-md space-y-4 print:max-w-none">
```

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## 브라우저 확인 방법

1. `http://localhost:3000/my-coaching/moksilgi` 접속
2. "내 목실기 출력" 버튼 클릭
3. 인쇄 미리보기에서 확인:
   - 하단 탭(오늘/목표/체크/기록/리포트) 사라졌는지 ✓
   - 본문이 용지 좌우를 더 넓게 채우는지 ✓

## Return 형식

- 수정한 파일 목록
- 변경된 동작
- typecheck / check:all / build 결과
