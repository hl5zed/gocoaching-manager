# My Coaching RLS — Staging 적용 가이드

**대상 migration:** `supabase/migrations/0040_my_coaching_weekly_logs_rls.sql`  
**환경:** staging 전용 (production 적용 금지)  
**전제:** 이 문서 작성 시점 DB 미적용, 앱 코드 미수정

---

## 0. 최종 검토 요약 (0040 + docs)

### 0040 migration — 승인 가능 (staging-first)

| 영역 | 판정 | 비고 |
|------|------|------|
| weekly_logs RLS | ✅ | coachee SELECT/INSERT/UPDATE + coach submitted SELECT + super_admin SELECT |
| soft delete | ✅ | 0027 패턴(`deleted_at IS NOT NULL` OR 분기). 0037 draft의 `WITH CHECK deleted_at IS NULL` 함정 회피 |
| relationship 검증 | ✅ | INSERT/UPDATE에 `weekly_log_has_active_coachee_relationship()` + `status IN ('draft','submitted')` |
| coach SELECT | ✅ | `status = 'submitted'` + active relationship (my-coaching suggestion보다 좁음) |
| super_admin | ✅ | `is_active_super_admin_profile()` — system_settings/0037 패턴과 동일 |
| assigned coach | ✅ | profiles RLS 대신 `get_my_assigned_coach_profiles()` RPC (5컬럼) |
| org timezone | ✅ | `get_my_organization_timezone()` RPC 우선 |
| organizations RLS | ⚠️ 주의 | **최초 ENABLE**. super_admin CRUD + member own SELECT. 0037 `organizations_select_active_lookup`(전 org 노출) 의도적 제외 |
| lookup tables | ➖ 범위外 | countries/regions/churches/groups 미포함 — 별도 migration |

### 알려진 제약 (staging에서 확인)

1. **SELECT vs INSERT/UPDATE 불일치**  
   coachee SELECT는 active relationship을 요구하지 않음. preflight #7에서 inactive relationship 로그가 나와도 **기존 데이터 조회는 가능**, **신규 작성·수정은 거부**될 수 있음 → 데이터 정리 또는 허용 여부를 팀에서 결정.

2. **organizations member SELECT**  
   `organizations_select_member_own`은 **조직 행 전체**를 노출. 코드 전환 시 RPC를 우선 사용.

3. **rollback 후 RLS ON + 정책 0개**  
   `my-coaching-rls-rollback.sql`은 정책만 DROP하고 RLS DISABLE은 주석 처리. rollback 직후 JWT는 weekly_logs/organizations 접근 불가. **현재 앱은 service_role이므로 rollback 후에도 당장은 동작**하나, server client 전환 PR merge **이후** rollback 시 앱 장애 → §5 rollback 기준 참고.

4. **`is_coach_for_coachee()` (0024)**  
   `status = 'active'` 미검사. 0040 coach weekly_logs 정책은 active만 허용 — coach_feedback 등 다른 테이블과 미세한 차이 가능.

### 관련 docs 파일 — 역할

| 파일 | 상태 | 용도 |
|------|------|------|
| `docs/my-coaching-rls-migration-0040-review.sql` | 0040 사본 | SQL Editor 수동 실행·diff |
| `docs/my-coaching-rls-preflight.sql` | ✅ | 적용 **전** 진단 |
| `docs/my-coaching-rls-rollback.sql` | ✅ | 장애 시 되돌리기 |
| `docs/my-coaching-rls-staging-test-checklist.md` | ✅ | 적용 **후** 기능·보안 테스트 |
| `docs/my-coaching-rls-suggestions.sql` | 참고 | 초안 (적용 금지) |
| `docs/rls-drafts/0037_...sql` | 참고 | lookup 포함 broader draft |

---

## 1. Staging 적용 절차

### 1.1 사전 준비

- [ ] staging Supabase 프로젝트 확인 (production 아님)
- [ ] staging DB 백업 또는 point-in-time recovery 가능 확인
- [ ] 테스트 계정 9종 준비 (체크리스트 §3)
- [ ] `docs/my-coaching-rls-preflight.sql` 결과 CSV/스크린샷 저장

### 1.2 Preflight 실행

Supabase Dashboard → SQL Editor → staging → `docs/my-coaching-rls-preflight.sql` 전체 실행.

→ §2 해석 기준으로 **GO / NO-GO** 판정.

### 1.3 Migration 적용

**방법 A — Supabase CLI (권장)**

```bash
# staging linked project에서
npx supabase db push
# 또는 migration만 수동:
# npx supabase migration up --include-all
```

**방법 B — SQL Editor**

`supabase/migrations/0040_my_coaching_weekly_logs_rls.sql` 내용 전체 붙여넣기 실행.

### 1.4 적용 직후 smoke SQL (staging)

```sql
-- 정책 생성 확인
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('weekly_logs', 'organizations')
ORDER BY tablename, policyname;

-- RPC 존재 확인
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'get_my_assigned_coach_profiles',
    'get_my_organization_timezone',
    'is_active_super_admin_profile',
    'weekly_log_has_active_coachee_relationship'
  );

-- RLS enabled 확인
SELECT relname, relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('weekly_logs', 'organizations');
```

기대값:
- `weekly_logs`: 정책 5개 (SELECT×3, INSERT×1, UPDATE×1)
- `organizations`: 정책 5개 (SELECT×2, INSERT/UPDATE/DELETE super_admin)
- 위 4개 함수 모두 존재
- `weekly_logs`, `organizations` → `rls_enabled = true`

### 1.5 앱 smoke test

앱은 **아직 service_role**이므로 0040 적용 직후 **my-coaching UI는 기존과 동일**해야 함.  
변경이 보이면 service_role 경로 외 JWT 직접 조회 코드가 있는지 확인.

→ `docs/my-coaching-rls-staging-test-checklist.md` 전체 수행.

### 1.6 JWT 수동 검증 (0040 효과 확인)

service_role과 별도로, staging에서 coachee JWT로 SQL Editor **또는** supabase-js authenticated client 테스트:

```sql
-- coachee JWT 컨텍스트에서 (SQL Editor는 service role이므로
-- 앱 Route Handler 임시 로그 또는 supabase client 테스트 권장)

-- 예: 본인 weekly_logs
SELECT id, week_start, status FROM weekly_logs LIMIT 5;

-- RPC
SELECT * FROM get_my_assigned_coach_profiles();
SELECT get_my_organization_timezone();
```

---

## 2. Preflight 결과 해석 기준

각 쿼리 번호는 `docs/my-coaching-rls-preflight.sql` 순서와 대응.

| # | 쿼리 | GO (적용 가능) | WARN (적용 가능, 기록·모니터링) | NO-GO (적용 전 조치) |
|---|------|----------------|----------------------------------|----------------------|
| 1 | 기존 RLS 정책 백업 | 결과 저장 완료 | — | 백업 없이 진행 금지 |
| 2 | RLS enabled | `weekly_logs` = **false**, `organizations` = **false** (또는 org 미설정) | `profiles`/`coaching_relationships` already true (정상) | `weekly_logs`에 **이미 정책 있는데 문서와 불일치** → 0040 diff 수동 검토 |
| 3 | helper 함수 | `current_profile_id`, `get_current_profile_id`, `is_coach_for_coachee` **존재** | 0040 신규 함수 3개 **미존재** (적용 전 정상) | `current_profile_id` **없음** → 0024 미적용 DB |
| 4 | weekly_logs 건수 | baseline 기록 | soft_deleted > 0 (정상 가능) | — |
| 5 | null coachee_profile_id | **0** | — | **> 0** → 스키마/데이터 이상 |
| 6 | relationship mismatch / orphan | **0 rows** | 소량 + legacy read-only 허용 합의 | **대량** → relationship_id/coachee_profile_id 정합성 수정 후 적용 |
| 7 | active relationship 없는 active logs | **0 rows** | 소량: 과거 inactive relationship 로그 **조회만** 가능, 신규 INSERT/UPDATE 실패 예상 | coachee 대량 계정이 #7에 걸리고 **신규 weekly log 작성 필수** → relationship 활성화 또는 데이터 정리 |
| 8 | coach profile orphan | orphan **0** | — | active relationship인데 coach profile 없음 **다수** → FK/데이터 수정 |
| 9 | org ↔ profile | broken_org_links **0** | `profiles_needing_org_timezone_fallback` > 0 (RPC 대상, 정상) | broken_org_links **> 0** → organization_id 정리 |
| 10 | policy name collision | 0040 대상 정책 **없음** 또는 0040이 DROP할 이름만 존재 | 수동 적용된 suggestion 정책 존재 → 0040 DROP으로 대체 예정 | **의도하지 않은 third-party 정책**과 이름 충돌 → migration 수정 |

### GO / NO-GO 최종 판정

- **GO:** #5 = 0, #6 = 0 (또는 WARN 합의), #9 broken = 0, #1 백업 완료
- **조건부 GO:** #7 소량 WARN + 팀이 legacy read-only 수용
- **NO-GO:** #5 > 0, #6 대량, #9 broken > 0, `current_profile_id` 부재

---

## 3. Staging 테스트 체크리스트 (요약)

전체 표는 `docs/my-coaching-rls-staging-test-checklist.md` 사용.

### P0 — 반드시 통과

| ID | 시나리오 | 기대 |
|----|----------|------|
| T1 | active coachee — /my-coaching, /goals, moksilgi | 기존과 동일 (service_role) |
| T2 | coachee — /records daily/monthly | 정상 |
| T3 | coachee — /records weekly | service_role이므로 **적용 직후에도** 정상 |
| T4 | coachee A ↔ B isolation (JWT) | A가 B weekly_logs 0건 |
| T5 | coach — assigned coachee **submitted** log | JWT SELECT 성공 |
| T6 | coach — coachee **draft** log | JWT SELECT **거부** |
| T7 | super_admin — weekly_logs JWT SELECT | 허용 |
| T8 | `get_my_assigned_coach_profiles()` | 배정 coach만, 5컬럼 |
| T9 | `get_my_organization_timezone()` | timezone 문자열만 |
| T10 | /admin organizations (super_admin) | service_role 또는 JWT CRUD 정상 |
| T11 | inactive / anonymous | 차단·리다이렉트 |

### P1 — 코드 전환 후 재검증

| ID | 시나리오 | 시점 |
|----|----------|------|
| T12 | weekly-log.ts server client 전환 후 records weekly | Phase 1 PR 후 |
| T13 | coachee INSERT/UPDATE/soft delete weekly_logs JWT | Phase 1 PR 후 |
| T14 | feedback.ts 전환 후 피드백 목록 | Phase 2 PR 후 |
| T15 | home/goals org timezone RPC | Phase 4 PR 후 |

### Sign-off

- [ ] P0 전체 Pass
- [ ] Preflight 결과 archived
- [ ] Rollback SQL 경로 확인
- [ ] Phase 1 코드 PR 착수 승인

---

## 4. Rollback 기준 및 절차

### 4.1 즉시 rollback (P0)

다음 **하나라도** 발생 시 `docs/my-coaching-rls-rollback.sql` 실행:

| 트리거 | 설명 |
|--------|------|
| R1 | **service_role 경로**에서 my-coaching critical path 장애 (0040 적용 직후) |
| R2 | JWT 검증 중 **타 사용자 데이터 노출** |
| R3 | super_admin **organizations 관리** 불가 (JWT·UI) |
| R4 | coach가 **배정 coachee submitted** log를 읽지 못함 (coach UI 회귀) |
| R5 | migration 적용 SQL **자체 실패** / partial apply |

### 4.2 rollback 검토 (P1 — 코드 전환 후)

| 트리거 | 조치 |
|--------|------|
| R6 | server client 전환 후 coachee **본인** weekly_logs 403 | rollback **또는** 정책 hotfix; service_role 임시 revert |
| R7 | soft delete UPDATE 403 | `weekly_logs_update_own_coachee` WITH CHECK 검토 |
| R8 | RPC permission denied | GRANT EXECUTE / function SECURITY DEFINER 확인 |

### 4.3 rollback 절차

1. staging SQL Editor에서 `docs/my-coaching-rls-rollback.sql` 실행
2. §1.4 smoke SQL 재실행 → 0040 정책·함수 **없음** 확인
3. 앱 smoke: my-coaching **service_role 경로** 정상 확인
4. **server client PR이 이미 merge된 경우:** 해당 PR revert 또는 hotfix 필수 (RLS ON + 정책 0 = JWT 전면 거부)
5. 장애 보고: preflight #6/#7, 실패 JWT 역할, 에러 코드 기록

### 4.4 최후 수단 (팀 승인 후만)

rollback.sql 하단 주석 해제:

```sql
ALTER TABLE public.weekly_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
```

→ JWT·service_role 모두 table RLS bypass. **staging에서만**, production 금지.

---

## 5. Staging 통과 후 코드 전환 (명령어)

**원칙:** SQL staging 검증 **완료 후**, PR을 **단계별**로 분리. 각 PR 후 `npm run typecheck`, `npm run check:all`, `npm run build` 및 체크리스트 P1 재실행.

LOCK (수정 금지): auth, invitation, profile creation, role assignment, weekly log **비즈니스 규칙** 변경.

---

### Phase 1 — `weekly-log.ts` server client (최우선)

**목표:** `createSupabaseServiceClient()` → `createSupabaseServerClient()` for weekly_logs CRUD/list.

**허용 파일:**
- `src/lib/api/my-coaching/weekly-log.ts`

**Cursor 명령 예시:**

```
GOThriveCoaching /my-coaching RLS Phase 1

Read AI_WORKFLOW.md and CLAUDE.md first.

Task: After staging verified migration 0040, switch weekly-log.ts from
createSupabaseServiceClient to createSupabaseServerClient for all weekly_logs
queries (list, get, insert, update, soft delete). Keep app-level ownership
checks. Do not change save/submit business rules.

Files allowed:
- src/lib/api/my-coaching/weekly-log.ts

Do not modify: auth, getSession, other my-coaching files, migrations, package.json.

Verify:
npm run typecheck
npm run check:all
npm run build

Staging re-test: checklist T12, T13 (JWT weekly_logs read/write/soft delete).
```

**검증:**

```bash
npm run typecheck
npm run check:all
npm run build
```

---

### Phase 2 — `feedback.ts` server client + weekly_logs JWT

**목표:** feedback list의 service_role 제거. weekly_logs summary는 RLS SELECT; coach profile은 Phase 3 RPC까지 service_role 유지 가능.

**허용 파일:**
- `src/lib/api/my-coaching/feedback.ts`

**Cursor 명령 예시:**

```
GOThriveCoaching /my-coaching RLS Phase 2

Task: Switch feedback.ts weekly_logs and coach_feedback reads to
createSupabaseServerClient where RLS allows (0024 coach_feedback, 0040 weekly_logs).
Keep coach profile fetch on service_role until Phase 3 RPC is done, OR switch
to supabase.rpc('get_my_assigned_coach_profiles') if coach ids match.

Files allowed:
- src/lib/api/my-coaching/feedback.ts

Verify: npm run typecheck && npm run check:all && npm run build
Re-test: checklist T14.
```

---

### Phase 3 — `me.ts` assigned coach RPC

**목표:** `createSupabaseServiceClient().from("profiles")` → `rpc('get_my_assigned_coach_profiles')`.

**허용 파일:**
- `src/lib/api/my-coaching/me.ts`

**Cursor 명령 예시:**

```
GOThriveCoaching /my-coaching RLS Phase 3

Task: Replace service_role profiles SELECT for coach display names in me.ts
with supabase.rpc('get_my_assigned_coach_profiles'). Map to existing
coachProfileById shape. No auth/role logic changes.

Files allowed:
- src/lib/api/my-coaching/me.ts

Verify: npm run typecheck && npm run check:all && npm run build
Re-test: checklist T8, relationships UI on /my-coaching.
```

---

### Phase 4 — organization timezone RPC (pages)

**목표:** `organizations` service_role SELECT → `rpc('get_my_organization_timezone')`.

**허용 파일 (범위 승인 필요 — 2~4개):**
- `src/app/my-coaching/page.tsx`
- `src/app/my-coaching/goals/page.tsx`
- (선택) `src/app/my-coaching/check/page.tsx`, `report/weekly/page.tsx`, `report/monthly/page.tsx` — 동일 패턴이면 한 PR에 포함 가능하나 **파일 수 4개 초과 시 사용자 승인**

**Cursor 명령 예시:**

```
GOThriveCoaching /my-coaching RLS Phase 4

Task: Replace createSupabaseServiceClient organizations.default_timezone lookup
with createSupabaseServerClient.rpc('get_my_organization_timezone') on
/my-coaching home and goals pages when profile.timezone is null.
Keep fallback behavior identical.

Files allowed:
- src/app/my-coaching/page.tsx
- src/app/my-coaching/goals/page.tsx

Do not modify: auth, LOCK flows.

Verify: npm run typecheck && npm run check:all && npm run build
Re-test: checklist T15, coachee without profile.timezone.
```

---

### Phase 5 — 잔여 service_role 정리 (선택)

다음은 my-coaching **핵심 5페이지 범위外** — 별도 승인 후:

| 파일 | 용도 |
|------|------|
| `src/app/my-coaching/check/page.tsx` | org timezone |
| `src/app/my-coaching/report/weekly/page.tsx` | org timezone |
| `src/app/my-coaching/report/monthly/page.tsx` | org timezone |
| `src/app/my-coaching/records/daily/page.tsx` | service_client usage 확인 |

---

### 전환 순서 다이어gram

```
staging 0040 apply
       ↓
preflight GO + P0 checklist Pass
       ↓
Phase 1 weekly-log.ts ──→ T12, T13
       ↓
Phase 2 feedback.ts ──────→ T14
       ↓
Phase 3 me.ts RPC ────────→ T8
       ↓
Phase 4 page.tsx goals ───→ T15
       ↓
(optional) Phase 5 report/check pages
```

---

## 6. Production 적용 — 아직 금지

staging에서 다음을 **모두** 만족한 뒤에만 production migration 검토:

1. Preflight GO + P0 checklist Pass  
2. Phase 1~4 코드 PR merge + P1 재검증  
3. Rollback drill (staging) 1회 이상  
4. 팀 sign-off  

---

## 7. 참고 — 현재 service_role 잔존 목록

| 위치 | 용도 | 전환 Phase |
|------|------|------------|
| `weekly-log.ts` | weekly_logs 전체 | 1 |
| `feedback.ts` | feedback + weekly_logs + coach profiles | 2 (+3) |
| `me.ts` | coach profiles | 3 |
| `page.tsx`, `goals/page.tsx` | organizations.default_timezone | 4 |
| `check/report/*.tsx` | org timezone | 5 |

---

## 8. 문서 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-21 | 초안 — 0040 최종 검토 + staging 가이드 |
