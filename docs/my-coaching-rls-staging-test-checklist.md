# My Coaching RLS — staging test checklist

**Migration:** `0040_my_coaching_weekly_logs_rls.sql`  
**Environment:** staging only (not production)

## Pre-test

- [ ] `docs/my-coaching-rls-preflight.sql` executed, results saved
- [ ] Migration 0040 applied on staging
- [ ] App deployed against staging Supabase (or local + staging env)
- [ ] Test accounts prepared (see below)

## Test accounts

| # | User type | Notes |
|---|-----------|--------|
| 1 | active coachee | status=active, profile exists |
| 2 | coachee with weekly_logs | at least 1 active row |
| 3 | coachee without weekly_logs | no weekly_logs rows |
| 4 | coachee with assigned coach | active coaching_relationships |
| 5 | coachee without coach | no active relationship |
| 6 | inactive profile | status inactive/suspended |
| 7 | anonymous | logged out |
| 8 | coach | assigned to test coachee |
| 9 | super_admin | global super_admin role |

---

## Page smoke tests

### /my-coaching

| User | Check | Pass | Notes |
|------|-------|------|-------|
| active coachee | Home loads, today goals | [ ] | moksilgi server client |
| coachee (no profile timezone) | Org timezone fallback | [ ] | service_role until code uses RPC |
| inactive | Blocked before page | [ ] | middleware → /unauthorized |
| anonymous | Redirect login | [ ] | |

### /my-coaching/goals

| User | Check | Pass |
|------|-------|------|
| active coachee | Goals/moksilgi summary | [ ] |
| active coachee | Save moksilgi (if UI) | [ ] |

### /my-coaching/moksilgi/monthly

| User | Check | Pass |
|------|-------|------|
| active coachee | Monthly read | [ ] |
| active coachee | Monthly save | [ ] |

### /my-coaching/moksilgi/summary

| User | Check | Pass |
|------|-------|------|
| active coachee | Summary read | [ ] |

### /my-coaching/records

| User | Check | Pass |
|------|-------|------|
| coachee w/ logs | daily list | [ ] |
| coachee w/ logs | weekly list | [ ] | service_role until weekly-log.ts switched |
| coachee w/ logs | monthly list | [ ] |
| coachee w/o logs | empty states, no error | [ ] |

---

## Security / isolation

| # | Test | Expected | Pass |
|---|------|----------|------|
| 1 | Coachee A cannot read coachee B weekly_logs (SQL or UI) | 0 rows / denied | [ ] |
| 2 | Coachee cannot read unassigned coach profile (direct SELECT) | denied without RPC | [ ] |
| 3 | `get_my_assigned_coach_profiles()` returns only assigned coaches | limited columns | [ ] |
| 4 | `get_my_organization_timezone()` returns only timezone string | no org name leak via RPC | [ ] |
| 5 | Coachee org SELECT (if used) exposes only own org row | not all orgs | [ ] |
| 6 | Coach sees submitted logs only for assigned coachee | submitted status | [ ] |
| 7 | super_admin can SELECT weekly_logs (JWT) | allowed | [ ] |

---

## Feature matrix (active coachee)

| Feature | Pass | Regression notes |
|---------|------|------------------|
| 목표 조회 | [ ] | |
| 목표 저장 | [ ] | |
| 묵실기 계획 조회 | [ ] | |
| 묵실기 목표 저장 | [ ] | |
| 월간 묵실기 기록 조회 | [ ] | |
| 월간 묵실기 기록 저장 | [ ] | |
| records daily | [ ] | |
| records weekly | [ ] | |
| records monthly | [ ] | |
| weekly soft delete (if UI) | [ ] | UPDATE deleted_at |

---

## Admin / coach (non-regression)

| Area | Check | Pass |
|------|-------|------|
| /admin organizations list | super_admin JWT or service_role | [ ] |
| /coach weekly logs | coach submitted read | [ ] |

---

## Rollback trigger

If any of these occur, run `docs/my-coaching-rls-rollback.sql` and stop code migration:

- Coachee cannot read **own** weekly_logs after server client switch
- Save/submit/soft-delete returns 403 for valid coachee
- Cross-user data visible
- Admin org management broken for super_admin
- build/typecheck unrelated but app critical paths fail

---

## Sign-off

- [ ] All P0 tests passed
- [ ] Rollback script verified on staging copy (optional)
- [ ] Ready for weekly-log.ts server client PR
