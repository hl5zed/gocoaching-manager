# Cursor 작업 명령어 — F3: `user_roles(profile_id)` 인덱스 추가 (조건부)

> ⚠️ **DB schema 변경(migration).** CLAUDE.md §8에 따라 **사용자의 명시적 승인 후에만** 진행한다.
> **전제 조건:** 아래 "0. 사전 확인"에서 `profile_id`로 시작하는 인덱스가 **없다고 확인된 경우에만** 진행한다. 있으면 이 작업은 하지 않는다.

---

## 배경

- 미들웨어(`src/proxy.ts`)는 역할 제한 경로(`/coach`, `/coach-maker`, `/admin` …)의 **모든 요청**에서 `user_roles`를 `profile_id`로 조회한다.
- 페이지 함수 대부분도 같은 조건으로 다시 조회한다.
- 저장소 migration에서 확인되는 인덱스는 `idx_user_roles_active_role_profile (role, profile_id)` 하나뿐이다. 첫 컬럼이 `role`이라 `profile_id`만으로 찾는 조회에는 효율이 낮다.
- `user_roles` 테이블 생성 migration이 저장소에 없다. 그래서 실제 DB에 이미 다른 인덱스(PK, unique 등)가 있는지 **반드시 먼저 확인**해야 한다.

## 0. 사전 확인 (사람이 Supabase SQL Editor에서 실행)

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'user_roles';
```

- `indexdef`에 `(profile_id` 또는 `(profile_id, …`로 **시작하는** 인덱스가 있으면 → **중단.** 이 작업은 필요 없다.
  예: unique `(profile_id, role, scope_type, scope_id)`가 있으면 이미 충분하다.
- 없으면 결과를 붙여 보고하고 승인을 받은 뒤 진행한다.

---

## 수정 파일 (정확히 1개)

- **NEW**: `supabase/migrations/0043_add_user_roles_profile_index.sql`
  - 번호는 `supabase/migrations/`의 마지막 번호 + 1로 정한다. 먼저 `ls`로 확인한다.

## 건드리지 않을 것

- 기존 migration 파일 전부(수정 금지)
- 테이블 구조, 컬럼, enum, RLS 정책, RPC
- `src/**` 코드 전부. 인덱스만으로 효과가 난다.

## migration 내용

```sql
-- Migration: 00XX_add_user_roles_profile_index.sql
-- Purpose: middleware 및 페이지에서 매 요청 실행되는 user_roles 조회
--   (profile_id = ? AND status = 'active' AND is_active AND deleted_at IS NULL)를 지원한다.
-- This migration does not change schema, RLS policies, table structures, columns, or enums.

CREATE INDEX IF NOT EXISTS idx_user_roles_live_profile
  ON public.user_roles (profile_id)
  WHERE deleted_at IS NULL
    AND status = 'active'
    AND is_active = true;
```

- 조건부(partial) 인덱스는 기존 `0037`의 `idx_user_roles_active_role_profile`과 같은 WHERE 조건을 쓴다.
- `user_roles` 행 수가 많지 않다면 일반 `CREATE INDEX`로 충분하다. 행 수가 수십만 이상이면 운영 중 잠금을 피하기 위해 `CONCURRENTLY`를 검토하고 보고한다.
  - 단, `CONCURRENTLY`는 트랜잭션 안에서 실행할 수 없다.

## 적용 방법

- 이 프로젝트의 기존 migration 적용 방식(Supabase CLI `db push` 또는 SQL Editor 직접 실행)을 **사용자에게 확인**한 뒤 따른다.
- 운영 DB 적용은 사람이 한다.

## 검증

1. 적용 후 인덱스 존재 확인(0번 SQL 다시 실행)
2. 실행 계획 확인(실제 profile id 하나로 실행):
   ```sql
   explain analyze
   select role from public.user_roles
   where profile_id = '<실제 profile id>'
     and status = 'active' and is_active = true and deleted_at is null;
   ```
   → `Index Scan using idx_user_roles_live_profile`이면 정상. 행이 매우 적으면 Seq Scan이 나올 수 있는데, 정상 동작이다.
3. `npm run typecheck` / `npm run check:all` / `npm run build` 통과(코드 변경이 없으니 형식 확인용)

## 보고 형식

- 0번 사전 확인 결과(원문)
- 생성한 migration 파일명
- 적용 여부(누가, 어떤 방식으로)
- explain 결과 요약
