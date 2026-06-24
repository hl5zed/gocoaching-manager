# Cursor 작업 명령어 — "다음 단계에서 추가됩니다" 문구 제거

## 작업 목표

`/my-coaching/moksilgi` 페이지의 "Ⅴ. 목표에 따른 실행전략 기획안" 섹션에서
임시 안내 문구(amber 박스)를 제거하고,
이미 구현된 `/my-coaching/moksilgi/monthly` 페이지로 연결하는 링크로 교체한다.

## 수정 파일 (1개)

- **EDIT**: `src/app/my-coaching/moksilgi/page.tsx`

## 건드리지 않을 것

- `savePlanAction`, `saveDetailGoalAction`
- `PlanForm`, `DetailGoalForm`
- `supabase/`, `package.json`

---

## 변경 내용

파일: `src/app/my-coaching/moksilgi/page.tsx`

### 수정 전 (line 723~728)

```tsx
<p className="rounded-control border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
  <I18nText
    k="myCoaching.moksilgi.monthlyComingSoon"
    fallback="월별 체크리스트와 달성률 계산은 다음 단계에서 추가됩니다."
  />
</p>
```

### 수정 후

```tsx
<p className="rounded-control border border-line-soft bg-surface-sunken p-3 text-sm text-ink-muted">
  세부 목표를 저장하면{" "}
  <a
    className="font-medium text-brand-600 underline"
    href="/my-coaching/moksilgi/monthly"
  >
    월별 체크리스트
  </a>
  에서 매일 실행을 체크하고 달성률을 확인할 수 있습니다.
</p>
```

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## Return 형식

- 수정한 파일
- 변경된 내용
- typecheck / check:all / build 결과
