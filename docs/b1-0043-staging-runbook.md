# B1 / 0043 staging 적용 실행 안내서

**대상:** staging Supabase DB → 검증 후 production  
**금지:** `supabase db push`, `db reset`, legacy SQL 재실행  
**소요:** 약 20~40분 (브라우저 JWT 테스트 포함)

CRITICAL_REVIEW **B1** — `is_coach_for_coachee` / `is_coach_for_weekly_log`에 `status = 'active'` 조건 추가.

---

## 전체 흐름

```
[staging 프로젝트 확인] → [preflight SQL] → [0043 적용] → [verify SQL] → [브라우저 테스트] → [prod 동일 적용]
                              ↓ NO-GO
                          중단 / 이미 적용됨 확인
```

---

## 1. 적용 전 확인

| 항목 | 확인 |
|------|------|
| Supabase Dashboard 프로젝트 | **staging** (production 아님) |
| Git | `main`에 `0043_is_coach_for_coachee_require_active_status.sql` 포함 |
| 0024 helpers | staging에 `is_coach_for_coachee` 존재 (0040과 별개) |
| 롤백 준비 | `docs/b1-0043-rollback.sql` 경로 확인 |

---

## 2. Preflight (SQL Editor)

파일: [`b1-0043-staging-preflight.sql`](./b1-0043-staging-preflight.sql)

1. SQL Editor에서 **전체 실행**
2. 결과 **Export / 스크린샷** 저장
3. `has_active_status_filter`가 **이미 true**이면 → 0043 적용됨 가능성. prod/staging 대조 후 중복 적용 금지.

**NO-GO:** production 프로젝트, helper 함수 없음(0024 미적용 DB)

---

## 3. 0043 적용 (SQL Editor)

1. repo 파일 열기:  
   `supabase/migrations/0043_is_coach_for_coachee_require_active_status.sql`
2. **27행 이후** `CREATE OR REPLACE FUNCTION` 블록 전체를 SQL Editor에 붙여넣기
3. **Run** → success 확인

> app 코드 변경 없음. service_role 경로는 RLS를 우회하므로 **0043 직후에도 UI가 그대로일 수 있음**.  
> RLS 효과 확인은 **코치 JWT(로그인)** 로 `/coach/goals` 등을 테스트해야 함.

---

## 4. Post-apply verify (SQL Editor)

파일: [`b1-0043-staging-verify.sql`](./b1-0043-staging-verify.sql)

- 두 helper 모두 `has_active_status_filter = true` → SQL 검증 통과

---

## 5. 브라우저 테스트 (staging 앱 + staging JWT)

테스트 계정 준비:

| 계정 | 관계 status | 기대 |
|------|-------------|------|
| 코치 A | `active` | 코치이 goals·feedback **조회 가능** |
| 코치 B | `ended` / `paused` / `archived` | 동일 코치이 goals·feedback **조회 불가** |
| 코치이 | — | 본인 goals·feedback **변화 없음** |

확인 경로:

- `/coach/goals`
- `/coach/weekly-logs` → feedback
- 코치이 `/my-coaching/goals`

---

## 6. Rollback (staging)

문제 시 SQL Editor에서 [`b1-0043-rollback.sql`](./b1-0043-rollback.sql) 실행 → preflight 재실행으로 0024 baseline 복원 확인.

---

## 7. Production 승격

staging **SQL + 브라우저** 모두 통과 후:

1. production Supabase **프로젝트 이중 확인**
2. preflight → 0043 → verify **동일 순서**
3. production 앱에서 spot check (active 코치 1건, ended 코치 1건)

---

## 관련 파일

| 파일 | 용도 |
|------|------|
| `supabase/migrations/0043_is_coach_for_coachee_require_active_status.sql` | forward |
| `docs/b1-0043-rollback.sql` | rollback |
| `docs/b1-0043-staging-preflight.sql` | 적용 전 |
| `docs/b1-0043-staging-verify.sql` | 적용 후 |
