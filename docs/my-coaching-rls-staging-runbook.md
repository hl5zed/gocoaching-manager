# My Coaching 0040 RLS staging 적용 실행 안내서

**대상:** staging Supabase DB만  
**금지:** production DB 적용, 앱 코드 수정  
**소요:** 약 30~60분 (JWT 수동 테스트 포함)

이 문서는 Supabase Dashboard **SQL Editor**에서 **무엇을, 어떤 순서로** 실행할지 정리한 **초보자용 실행 안내서**입니다.  
상세 배경·Phase별 코드 전환은 [`my-coaching-rls-staging-guide.md`](./my-coaching-rls-staging-guide.md)를 참고하세요.

---

## 전체 흐름 (한눈에)

```
[사전 확인] → [1차 preflight] → [판정 GO?] → [2차 0040 적용] → [적용 후 SQL] → [P0 UI] → [JWT 확인] → [통과 / rollback]
                  ↓ NO-GO
              여기서 중단
```

---

## 1. 적용 전 반드시 확인할 것

아래를 **SQL 실행 전**에 모두 확인하세요. 하나라도 불확실하면 **중단**하고 팀에 확인합니다.

### 1.1 Supabase 프로젝트 = staging인지

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 좌측 상단 **프로ject 이름** 확인
3. production용 프로젝트 이름·URL과 **다른지** 대조  
   - 예: `gothrive-staging` vs `gothrive-prod` (팀에서 쓰는 이름에 맞게 확인)
4. **Settings → General → Reference ID**를 메모해 두세요 (실수 방지용)

> **중단 기준:** production 프로젝트에 연결되어 있으면 **절대 진행하지 마세요.**

### 1.2 production이 아닌지 (이중 확인)

| 확인 방법 | staging이면 | production이면 |
|-----------|-------------|----------------|
| 프로젝트 이름 | staging/dev/test 포함 또는 팀 지정 staging명 | prod/production/live |
| 앱 `.env`의 `NEXT_PUBLIC_SUPABASE_URL` | staging URL과 일치 | **중단** |
| SQL Editor 상단 프로젝트 표시 | staging 프로젝트 | **중단** |

### 1.3 Git branch 확인

로컬 터미널에서:

```bash
git branch --show-current
git status
```

- 0040 migration 파일이 **포함된 branch**에서 작업 중인지 확인
- 아직 merge 전이어도 **staging DB에만** SQL을 적용하는 것은 가능 (코드는 service_role 유지)

> **참고:** staging DB 적용과 Git branch는 별개입니다. 다만 **문서·migration 파일 버전**이 맞는 branch인지 확인하세요.

### 1.4 아직 코드 전환 전인지

0040 적용 **직후**에는 앱이 **service_role**을 쓰므로 UI가 그대로여야 합니다.  
코드를 먼저 server client로 바꾼 뒤 SQL을 적용하면 장애 원인 분리가 어렵습니다.

**코드 전환 전 상태 확인 (읽기만):**

| 파일 | 아직 `createSupabaseServiceClient` 사용 중이면 OK |
|------|---------------------------------------------------|
| `src/lib/api/my-coaching/weekly-log.ts` | weekly_logs 조회·저장 |
| `src/lib/api/my-coaching/feedback.ts` | 피드백 |
| `src/lib/api/my-coaching/me.ts` | coach profiles |
| `src/app/my-coaching/page.tsx`, `goals/page.tsx` | organizations timezone |

> **중단 기준:** weekly-log.ts가 **이미** server client만 사용하도록 merge된 상태라면, SQL 적용 전에 팀과 **적용 순서**를 다시 합의하세요.

### 1.5 service_role 경로 유지 확인

- my-coaching 주요 페이지는 아직 **서버에서 service_role**로 DB 접근
- 0040은 **JWT(RLS) 경로**를 열어 두는 작업
- 따라서 **0040 적용 직후 UI smoke test**에서 my-coaching이 깨지면 → 예상 밖 (조사 필요)

### 1.6 사전 준비 체크리스트

- [ ] staging Supabase 프로젝트 확인 완료
- [ ] production **아님** 확인 완료
- [ ] preflight 결과 저장할 방법 준비 (스크린샷 / CSV Export)
- [ ] 테스트용 coachee / coach / super_admin 계정 로그인 정보 준비 (§7 JWT 테스트용)
- [ ] staging 앱 URL 접속 가능

---

## 2. 1차 실행: preflight SQL

### 사용 파일

`docs/my-coaching-rls-preflight.sql`

### SQL Editor 실행 방법

1. Supabase Dashboard → **SQL Editor**
2. **New query**
3. 로컬에서 `docs/my-coaching-rls-preflight.sql` 파일 **전체** 복사 → 붙여넣기
4. **Run** (또는 Ctrl+Enter)
5. 결과 탭이 **여러 개** 나옵니다 (쿼리 1~10). **각 탭 결과를 저장**하세요.

### 이 SQL이 하는 일

- **DB를 변경하지 않습니다** (SELECT만 실행)
- 현재 RLS·정책·데이터 정합성·함수 존재 여부를 **스냅샷**으로 남깁니다
- 0040 적용 **전** baseline으로 쓰고, 문제 시 rollback 판단에도 사용합니다

### 결과에서 특히 볼 항목

| preflight # | 무엇을 보는지 | 결과 위치 |
|-------------|---------------|-----------|
| **#5** | `null_coachee_profile_id` | **0**이어야 함 |
| **#6** | relationship 불일치 / orphan weekly_logs | **행 0개** ideal |
| **#7** | active relationship 없는 active weekly_logs | **행 0개** ideal (WARN 가능) |
| **#9** | `broken_org_links` | **0**이어야 함 |
| **#3** | helper 함수 | `current_profile_id`, `is_coach_for_coachee` **있어야 함**; 0040 신규 함수 3개는 **없어도 정상** |
| **#10** | 0040과 이름 충돌할 정책 | 없거나, 0040이 DROP할 이름만 |

### 이 단계에서 중단해야 할 때

- production 프로젝트에서 실행 중이면 → **즉시 중단**
- preflight SQL **에러** (테이블 없음 등) → **0040 적용하지 말고** migration 히스토리 확인
- `#5 null_coachee_profile_id > 0` → **0040 적용 중단**, 데이터 정리 후 재실행
- `#9 broken_org_links > 0` → **0040 적용 중단**, organization_id 정리 후 재실행
- `#3`에 `current_profile_id` **없음** → **0040 적용 중단** (0024 미적용 DB)

---

## 3. preflight 결과 판정

아래 표로 **GO / WARN / NO-GO**를 기록하세요.  
**NO-GO가 하나라도 있으면 §4(0040 적용)로 가지 마세요.**

| 항목 | GO 기준 | WARN 기준 | NO-GO 기준 | 조치 |
|------|---------|-----------|------------|------|
| **#5 null coachee_profile_id** | `0` | — | `> 0` | 데이터·스키마 수정 후 preflight 재실행 |
| **#6 relationship 불일치** | 결과 **0 rows** | 1~몇 건, legacy read-only 수용 합의 | **다수** rows | relationship_id / coachee_profile_id 정합성 수정 |
| **#7 active relationship 없는 logs** | **0 rows** | 소량, 조회만 필요·신규 작성 적음 | 대량 + 신규 weekly log 작성 필수 | relationship 활성화 또는 데이터 정리 |
| **#9 broken_org_links** | `0` | — | `> 0` | profiles.organization_id 수정 |
| **#3 current_profile_id** | 존재 | — | 없음 | 0024 migration 누락 확인 |
| **#3 is_coach_for_coachee** | 존재 | — | 없음 | 0024 migration 누락 확인 |
| **#3 0040 신규 함수 3개** | 적용 전 **없음** (정상) | — | — | — |
| **#2 weekly_logs RLS** | `rls_enabled = false` (일반적) | 이미 true + 정책 있음 | 의도不明 정책 다수 | 0040 diff·팀 검토 |
| **#2 organizations RLS** | `false` (일반적) | — | — | — |
| **#10 정책 이름 충돌** | 0040 DROP 대상만 또는 없음 | 수동 suggestion 정책 존재 | 예상外 정책과 충돌 | migration·팀 검토 |
| **#1 정책 백업** | 결과 저장함 | — | 저장 안 함 | preflight 다시 실행·저장 |

### 최종 판정 규칙

| 판정 | 조건 | 다음 단계 |
|------|------|-----------|
| **GO** | NO-GO 없음, WARN 없거나 팀 합의 | §4 진행 |
| **WARN** | NO-GO 없음, WARN 있음 + **팀이 “staging 적용 OK”** | §4 진행 (WARN 내용 메모) |
| **NO-GO** | NO-GO 항목 1개 이상 | **§4 진행 금지** |

판정 메모 (직접 기록):

```
판정: [ ] GO  [ ] WARN  [ ] NO-GO
날짜:
실행자:
WARN/NO-GO 사유:
```

---

## 4. 2차 실행: 0040 migration 적용

### 사용 파일

`supabase/migrations/0040_my_coaching_weekly_logs_rls.sql`

### 실행 전 주의

- preflight **NO-GO** → **실행하지 마세요**
- SQL Editor에 붙여넣기 전, 파일 첫 줄 주석에 **`0040_my_coaching_weekly_logs_rls`** 인지 확인
- **전체** 실행 (일부만 실행하면 정책·함수가 불완전)

### SQL Editor 실행 방법

1. SQL Editor → **New query**
2. `supabase/migrations/0040_my_coaching_weekly_logs_rls.sql` **전체** 복사 → 붙여넣기
3. 한 번 더 **staging 프로젝트**인지 확인
4. **Run**
5. 하단에 **Success** / 에러 메시지 확인

### 적용 후 에러가 났을 때

1. **에러 메시지 전문** 복사·저장
2. **어디까지 적용됐는지** §5 확인 SQL 실행
3. **0040 재실행 금지** (중복 CREATE 오류 가능)
4. 팀 공유 후:
   - 부분 적용이면 → `docs/my-coaching-rls-rollback.sql` 검토
   - rollback 후 원인 수정 → preflight부터 다시

### 이 단계에서 중단해야 할 때

| 상황 | 조치 |
|------|------|
| Run 후 **ERROR** | §5 확인 SQL → rollback 여부 판단 → **P0 UI 테스트 보류** |
| Success인데 §5에서 정책/함수 **누�락** | **중단**, rollback 검토 |
| 실수로 **production**에 실행 | **즉시 중단**, 팀 에스컬레이션, rollback·복구 절차 |

---

## 5. 적용 후 확인 SQL

0040 **Success** 후, SQL Editor **New query**에 아래를 붙여넣고 실행하세요.

```sql
-- =============================================================================
-- 0040 적용 후 확인 (staging)
-- =============================================================================

-- (A) weekly_logs / organizations RLS 활성 여부
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('weekly_logs', 'organizations')
ORDER BY c.relname;

-- (B) 추가된 policy 목록
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('weekly_logs', 'organizations')
ORDER BY tablename, policyname, cmd;

-- (C) RPC 및 helper 함수 존재
SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'get_my_assigned_coach_profiles',
    'get_my_organization_timezone',
    'is_active_super_admin_profile',
    'weekly_log_has_active_coachee_relationship'
  )
ORDER BY proname;

-- (D) super_admin organizations 정책 존재 (이름으로 확인)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'organizations'
  AND policyname LIKE '%super_admin%'
ORDER BY policyname;
```

### 기대 결과 (통과 기준)

| 확인 | 기대값 |
|------|--------|
| **(A) rls_enabled** | `weekly_logs` = **true**, `organizations` = **true** |
| **(B) weekly_logs 정책** | **5개**: `weekly_logs_select_own_coachee`, `weekly_logs_insert_own_coachee`, `weekly_logs_update_own_coachee`, `weekly_logs_select_assigned_coach_submitted`, `weekly_logs_select_active_super_admin` |
| **(B) organizations 정책** | **5개**: `organizations_select_active_super_admin`, `organizations_select_member_own`, `organizations_insert/update/delete_active_super_admin` |
| **(C) 함수** | 위 **4개 함수 모두** 존재 |
| **(D) super_admin** | SELECT + INSERT + UPDATE + DELETE 정책 존재 |

### 이 단계에서 중단해야 할 때

- weekly_logs 정책 **5개 미만** → rollback 검토, §6·§7 **보류**
- RPC 함수 **하나라도 없음** → rollback 검토
- organizations RLS **false** → rollback 검토

---

## 6. P0 smoke test (앱 UI)

0040 적용 직후, **코드는 아직 service_role**이므로 **UI는 기존과 같아야** 합니다.  
staging 앱 URL에 **테스트 계정**으로 로그인해 확인하세요.

### 확인할 페이지

| 페이지 | 확인 |
|--------|------|
| `/my-coaching` | 홈 로드, 오늘 목표·묵실기 영역 |
| `/my-coaching/goals` | 목표·묵실기 요약 |
| `/my-coaching/moksilgi/monthly` | 월간 묵실기 |
| `/my-coaching/moksilgi/summary` | 묵실기 요약 |
| `/my-coaching/records` | daily / weekly / monthly 탭 |

### 확인할 것

- [ ] 위 페이지 **접속 가능** (500/빈 화면 없음)
- [ ] **records weekly** 목록이 적용 전과 **동일하게** 보임
- [ ] 목표·묵실기 **조회** 정상
- [ ] 목표·묵실기 **저장** (가능한 화면) 정상
- [ ] **admin** — organizations 목록·관리 (super_admin 계정)
- [ ] **coach** — 배정 coachee 관련 화면 (가능하면)

### 이 단계에서 중단해야 할 때

| 상황 | 의미 | 조치 |
|------|------|------|
| my-coaching **전면 500/조회 실패** | service_role 경로 회귀 | **rollback** 검토 (§8) |
| admin organizations **깨짐** | org RLS 영향 | **rollback** 검토 |
| my-coaching만 깨지고 admin 정상 | 원인 분리 필요 | 로그 확인, 팀 공유 |

> JWT(RLS) 문제는 §7에서 확인합니다. §6에서 UI가 깨지면 **코드 전환 전**이므로 rollback 우선 검토.

---

## 7. JWT/RLS 직접 확인

### 중요: SQL Editor는 service_role

Supabase **SQL Editor**는 **RLS를 우회**합니다.  
coachee/coach **권한** 테스트는 아래 중 하나로 하세요.

**방법 A (권장):** staging 앱 + 브라우저 Network (server client 경로가 있으면)  
**방법 B:** 로컬에서 coachee JWT로 `@supabase/supabase-js` 스크립트  
**방법 C:** Supabase Dashboard → **Authentication** → 사용자 JWT로 API 테스트 (팀 절차)

아래는 **authenticated JWT 컨텍스트**에서의 기대 동작입니다.

### 7.1 coachee — 본인 weekly_logs만

```sql
-- JWT 컨텍스트에서 실행 (SQL Editor 아님)
SELECT id, week_start, status, coachee_profile_id
FROM weekly_logs
WHERE deleted_at IS NULL
ORDER BY week_start DESC
LIMIT 10;
```

**기대:** 본인 `coachee_profile_id` 행만 보임.

### 7.2 coachee — 다른 사람 weekly_logs 불가

다른 coachee의 `profile_id`를 알고 있을 때:

```sql
SELECT id FROM weekly_logs
WHERE coachee_profile_id = '<다른-피코치-profile-uuid>'
  AND deleted_at IS NULL;
```

**기대:** **0 rows** (또는 permission denied).

### 7.3 coach — submitted만

coach JWT로:

```sql
SELECT id, status, coachee_profile_id
FROM weekly_logs
WHERE deleted_at IS NULL;
```

**기대:** 배정 coachee의 **`status = 'submitted'`** 만 보임.

### 7.4 coach — draft 불가

배정 coachee에게 **draft** weekly_log가 있을 때 coach JWT로:

```sql
SELECT id FROM weekly_logs
WHERE status = 'draft'
  AND deleted_at IS NULL;
```

**기대:** **0 rows**.

### 7.5 RPC — assigned coach (컬럼 제한)

coachee JWT:

```sql
SELECT * FROM get_my_assigned_coach_profiles();
```

**기대:** 컬럼 `id`, `display_name`, `full_name`, `email`, `status` 만. 배정 coach만.

### 7.6 RPC — organization timezone

coachee JWT (`organization_id` 있음):

```sql
SELECT get_my_organization_timezone();
```

**기대:** timezone **문자열 하나** (예: `Asia/Seoul`). org 이름·전체 row 아님.

### 7.7 soft delete (코드 전환 후 재검증, 선택)

0040 적용 직후 앱은 service_role이라 UI에서 soft delete는 **기존과 동일**해야 합니다.  
JWT로 UPDATE `deleted_at` 테스트는 **Phase 1 코드 전환 후** 체크리스트에서 다시 해도 됩니다.

### JWT 확인 체크리스트

- [ ] coachee — 자기 weekly_logs만 조회
- [ ] coachee — 타인 weekly_logs 0건
- [ ] coach — submitted만 조회
- [ ] coach — draft 0건
- [ ] `get_my_assigned_coach_profiles()` — 필요한 컬럼만
- [ ] `get_my_organization_timezone()` — timezone만

### 이 단계에서 중단해야 할 때

| 문제 | 조치 |
|------|------|
| coachee가 **타인** weekly_logs 조회 | **즉시 중단**, §8 rollback |
| coach가 **draft** 조회 | **즉시 중단**, §8 rollback |
| RPC permission denied | GRANT/함수 정의 확인, 해결 안 되면 rollback |

---

## 8. 문제가 생겼을 때 rollback 기준

### rollback 해야 하는 상황

아래 **하나라도** 해당하면 `docs/my-coaching-rls-rollback.sql` 실행을 검토하세요.

| # | 상황 |
|---|------|
| 1 | (코드 전환 후) coachee **본인** weekly_logs 조회가 **전부** 막힘 |
| 2 | soft delete UPDATE **실패** (403) — Phase 1 이후 |
| 3 | coach가 coachee **draft** weekly_logs를 볼 수 있음 |
| 4 | **다른 피코치** 데이터가 보임 |
| 5 | **admin organization** 기능 깨짐 (super_admin) |
| 6 | RPC **권한 오류** (authenticated 실행 불가) |
| 7 | §4 적용 **ERROR** / §5 기대값 **미달** |
| 8 | §6 P0 — my-coaching 또는 admin **전면 회귀** |

### rollback 실행 방법

1. **staging** 프로젝트인지 다시 확인
2. SQL Editor → `docs/my-coaching-rls-rollback.sql` **전체** 실행
3. §5 확인 SQL 재실행 → 0040 정책·함수 **사라졌는지** 확인
4. §6 P0 smoke test 재실행 → **service_role 경로** 정상인지 확인
5. 장애 내용·preflight 결과·에러 로그 저장

> **주의:** rollback 후에도 `weekly_logs` RLS는 **켜진 채** 정책 0개일 수 있습니다. **현재 앱(service_role)은 동작**하지만, **코드 전환 PR merge 후** rollback하면 JWT 경로가 막힙니다.

### rollback 후 최후 수단 (팀 승인 후만)

`my-coaching-rls-rollback.sql` 하단 주석:

```sql
-- ALTER TABLE public.weekly_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
```

**staging에서만**, production **절대 금지**.

---

## 9. staging 통과 후 다음 단계

§3 **GO/WARN**, §5 **통과**, §6 **P0 통과**, §7 **JWT 통과**, rollback **불필요** → 코드 전환 시작.

**순서 (한 번에 하나씩 PR 권장):**

| 순서 | 작업 | 허용 파일 (예) |
|------|------|----------------|
| 1 | `weekly-log.ts` **read-only** → server client | `weekly-log.ts` |
| 2 | `weekly-log.ts` **save/remove** → server client | `weekly-log.ts` |
| 3 | `feedback.ts` 전환 | `feedback.ts` |
| 4 | `me.ts` coachProfiles → `get_my_assigned_coach_profiles()` RPC | `me.ts` |
| 5 | `page.tsx` / `goals/page.tsx` → `get_my_organization_timezone()` RPC | 해당 page 2개 |
| 6 | `createSupabaseServiceClient` **my-coaching 잔여** 검색 | — |
| 7 | `npm run typecheck` | — |
| 8 | `npm run check:all` | — |
| 9 | `npm run build` | — |

상세 Cursor 명령어: [`my-coaching-rls-staging-guide.md` §5](./my-coaching-rls-staging-guide.md)

---

## 10. 최종 체크리스트

실행하면서 체크하세요.

### 사전

- [ ] staging Supabase 프로젝트 확인
- [ ] production **아님** 확인
- [ ] Git branch / migration 파일 버전 확인
- [ ] 코드 전환 **전** (service_role 유지) 확인

### 1차 preflight

- [ ] `docs/my-coaching-rls-preflight.sql` 실행 완료
- [ ] 결과 저장 (스크린샷/Export)
- [ ] GO / WARN / NO-GO 판정 완료
- [ ] **NO-GO 없음** (또는 NO-GO 해소 후 재실행)

### 2차 0040 적용

- [ ] `supabase/migrations/0040_my_coaching_weekly_logs_rls.sql` staging 적용 완료
- [ ] Run **Success** (에러 없음)

### 적용 후 확인

- [ ] §5 확인 SQL 실행 완료
- [ ] weekly_logs RLS **true**
- [ ] weekly_logs 정책 **5개**
- [ ] organizations RLS **true**
- [ ] organizations super_admin 정책 존재
- [ ] RPC 4종 존재

### 테스트

- [ ] §6 P0 smoke test 완료 (my-coaching 5페이지 + admin)
- [ ] §7 JWT/RLS 확인 완료
- [ ] rollback **필요 없음**

### 마무리

- [ ] `docs/my-coaching-rls-staging-test-checklist.md` P0 sign-off
- [ ] **코드 전환 진행 가능** (팀 공유)

---

## 부록: 실행 순서 요약표

| 단계 | 파일 | DB 변경 | 실패 시 |
|------|------|---------|---------|
| 0 | — | 없음 | staging/prod 확인 |
| 1 | `my-coaching-rls-preflight.sql` | **없음** | NO-GO → §4 금지 |
| 2 | `0040_my_coaching_weekly_logs_rls.sql` | **있음** | rollback 검토 |
| 3 | §5 확인 SQL | 없음 | rollback 검토 |
| 4 | 앱 P0 UI | 없음 | rollback 검토 |
| 5 | JWT 테스트 | 없음 | rollback |
| (장애) | `my-coaching-rls-rollback.sql` | **있음** | 팀 에스컬레이션 |

---

**관련 문서**

- [`my-coaching-rls-staging-guide.md`](./my-coaching-rls-staging-guide.md) — 상세 판정·Phase별 코드 전환
- [`my-coaching-rls-staging-test-checklist.md`](./my-coaching-rls-staging-test-checklist.md) — 전체 테스트 표
- [`my-coaching-rls-preflight.sql`](./my-coaching-rls-preflight.sql)
- [`my-coaching-rls-rollback.sql`](./my-coaching-rls-rollback.sql)
