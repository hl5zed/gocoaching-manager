# Cursor 작업 명령어 — /my-coaching/check → /my-coaching/moksilgi/monthly 전환

## 작업 목표

`/my-coaching/check` 페이지를 `/my-coaching/moksilgi/monthly` 형식으로 전환한다.
두 가지를 변경한다.

1. `CoacheeBottomTabs.tsx` — "체크" 탭 href를 `/my-coaching/moksilgi/monthly`로 직접 변경
2. `check/page.tsx` — 페이지 전체를 `/my-coaching/moksilgi/monthly`로 redirect

`TodayCheckClient.tsx`는 수정하지 않는다.  
`moksilgi/monthly/page.tsx`는 수정하지 않는다.

## 수정 파일 (2개)

- **EDIT**: `src/components/navigation/CoacheeBottomTabs.tsx`
- **EDIT**: `src/app/my-coaching/check/page.tsx`

## 건드리지 않을 것

- `src/app/my-coaching/check/TodayCheckClient.tsx`
- `src/app/my-coaching/moksilgi/monthly/page.tsx`
- `src/lib/api/my-coaching/` 전체
- `supabase/`, `package.json`

---

## Step 1 — CoacheeBottomTabs.tsx 수정

파일: `src/components/navigation/CoacheeBottomTabs.tsx`

아래 부분만 변경한다.

**수정 전:**
```ts
{
  key: "check",
  label: "체크",
  href: "/my-coaching/check",
  match: "prefix",
  icon: <IconCheck />,
},
```

**수정 후:**
```ts
{
  key: "check",
  label: "체크",
  href: "/my-coaching/moksilgi/monthly",
  match: "prefix",
  icon: <IconCheck />,
},
```

---

## Step 2 — check/page.tsx 교체

파일: `src/app/my-coaching/check/page.tsx`

파일 전체 내용을 아래로 교체한다.  
기존 로직(TodayCheckClient, saveTodayCheckAction 등)은 삭제해도 되지만,  
`TodayCheckClient.tsx`는 건드리지 않는다.

```ts
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MyCoachingCheckPage() {
  redirect("/my-coaching/moksilgi/monthly");
}
```

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## Return 형식

- 수정한 파일 목록
- 변경된 동작
- 의도적으로 건드리지 않은 것
- typecheck / check:all / build 결과
