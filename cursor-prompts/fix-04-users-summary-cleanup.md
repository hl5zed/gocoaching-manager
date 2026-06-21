# Fix 04 — Users 목록 응답의 dead summary 필드 제거

## 현재 문제

`getAdminUsers` (`src/lib/api/admin/users.ts`)는
`AdminUsersResult` 타입에 `summary` 필드를 포함해 반환한다.

```typescript
export type AdminUsersResult = {
  users: AdminUserSummary[];
  summary: {           // ← 항상 { totalCount: 0, roleCounts: { ...모두 0 } }
    totalCount: number;
    roleCounts: Record<UserRole, number>;
  };
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
};
```

그런데 실제 값은 항상 `createEmptySummary()`(전부 0)로 초기화되고
**실제 카운트를 채우는 코드가 없다.**

```typescript
// users.ts 내부
const summary = createEmptySummary();   // 생성만 하고
// ... 이후 어디서도 summary를 업데이트하지 않음
return { users, summary, ... };         // 항상 0으로 반환
```

호출부 (`src/app/admin/users/page.tsx`, `src/app/admin/page.tsx`)는
반환된 `summary`를 **전혀 읽지 않는다.**

실제 요약 카드는 `AdminUserRoleSummaryCards` 컴포넌트가
`/api/admin/users/summary` 엔드포인트를 별도로 fetch해서 사용한다.

즉, `getAdminUsers`의 `summary` 필드는 완전한 데드 코드다.

---

## 작업 목표

`summary` 필드를 `AdminUsersResult` 타입과 `getAdminUsers` 함수에서 제거한다.

---

## 허용 수정 파일

- `src/lib/api/admin/users.ts` **한 파일만**

**절대 수정 금지:**

- `src/app/api/admin/users/summary/route.ts` (별도 엔드포인트 — 건드리지 않음)
- `src/app/admin/users/AdminUserRoleSummaryCards.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/page.tsx`
- `supabase/` 하위 모든 파일
- auth / role / invitation 흐름
- `package.json`

---

## 변경 내용

### 1. `AdminUsersResult` 타입에서 `summary` 제거

```typescript
// BEFORE
export type AdminUsersResult = {
  users: AdminUserSummary[];
  summary: {
    totalCount: number;
    roleCounts: Record<UserRole, number>;
  };
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
};

// AFTER
export type AdminUsersResult = {
  users: AdminUserSummary[];
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
};
```

### 2. `getAdminUsers` 함수 내 `summary` 관련 코드 제거

아래 세 곳에서 `summary` 관련 코드를 제거한다.

**에러 반환 블록들 (auth 실패, service client 실패):**

```typescript
// BEFORE
return {
  users: [],
  summary: createEmptySummary(),
  error: "...",
  page: safePage,
  limit: safeLimit,
  hasNext: false,
};

// AFTER
return {
  users: [],
  error: "...",
  page: safePage,
  limit: safeLimit,
  hasNext: false,
};
```

**쿼리 성공 후 반환 블록:**

```typescript
// BEFORE
const summary = createEmptySummary();
// ...
return {
  users: ...,
  summary,
  error: null,
  ...
};

// AFTER
// summary 변수 선언 줄 자체를 삭제
// 반환 블록에서도 summary 필드 제거
return {
  users: ...,
  error: null,
  ...
};
```

### 3. `createEmptySummary` 함수 사용 여부 확인

`createEmptySummary` 함수가 이 파일에서 `getAdminUsers` 외 다른 곳에서 사용되지 않는다면
함수 선언도 함께 제거한다.

단, `createEmptyRoleCounts`는 다른 곳에서 쓰일 수 있으므로 **확인 후** 판단한다.

---

## 주의사항

- `/api/admin/users/summary` 라우트는 **별개의 엔드포인트**로 정상 동작 중이다. 건드리지 않는다.
- `AdminUserRoleSummaryCards`의 fetch 로직도 건드리지 않는다.
- `AdminUserRoleSummaryCounts` 타입도 별개이므로 건드리지 않는다.

---

## 타입 규칙

- `any` 사용 금지
- `@ts-ignore` 사용 금지

---

## 검증 (수정 후 반드시 실행)

```bash
npm run typecheck
npm run check:all
npm run build
```

---

## 완료 후 보고 형식

```
- 수정한 파일: users.ts
- 제거한 것: AdminUsersResult.summary 필드, getAdminUsers의 summary 코드, createEmptySummary (미사용 시)
- 변경하지 않은 것: /summary 엔드포인트, AdminUserRoleSummaryCards, LOCK 흐름 전체
- typecheck: 통과 / 실패
- check:all: 통과 / 실패
- build: 통과 / 실패
```
