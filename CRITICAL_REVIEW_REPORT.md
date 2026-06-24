# GOThriveCoaching 2라운드 비판 리뷰 보고서

**날짜:** 2026-06-23  
**검토 방식:** 8개 병렬 서브에이전트 × 2라운드 + 메인 세션 재검증  
**코드 수정 여부:** 없음 (이 보고서는 분석 전용)

---

## 전체 요약

| 구분 | 건수 |
|------|------|
| A (즉시 수정 권장) | 3건 |
| B (다음 단계 — 비즈니스 결정 또는 검증 후) | 7건 |
| C (보류 — 부작용 검토 필요) | 7건 |
| D (기각 — 근거 불충분 또는 오판) | 2건 |

**가장 긴급한 위험:**

1. `saveTodayCheckAction` INSERT 시 `achievement_rate: 0` 하드코딩 → 목실기 달성률 데이터 영구 오염 (High)
2. `/api/invitations/accept` — 인증 체크가 DB 조회 **이후**에 위치 (High)
3. CoacheeBottomTabs "체크" 탭이 잘못된 경로로 연결 (Medium, UX 즉각 손상)

**재분류 (1차 과대평가):**

- Next.js 16.x / TypeScript 6.x "존재하지 않는 버전" → **기각** (실제 설치 확인됨)
- `profiles_update_own` RLS 컬럼 무제한 → **Low로 하향** (앱 레이어 화이트리스트 확인)

---

## 1차 비판 결과

### 8개 에이전트 원본 발견 목록

| ID | 에이전트 | 발견 | 위험도 | 검증 |
|----|---------|------|--------|------|
| R1-01 | Agent 3 (RLS) | `is_coach_for_coachee()` — `cr.status = 'active'` 조건 누락 | High | ✅ 코드 확인 (0024 migration L382) |
| R1-02 | Agent 1 (Admin) | `findAuthUserByEmail` O(N) — 최대 50,000 user 스캔 | High | ✅ 코드 확인 (admin/users/route.ts) |
| R1-03 | Agent 6 (Infra) | CI/CD 파이프라인 없음 | Medium | ✅ `.github/`, `vercel.json` 부재 확인 |
| R1-04 | Agent 6 (Infra) | Migration 0014 누락 / 0001-0012 루트에 산재 | Medium | ✅ 파일 목록 직접 확인 |
| R1-05 | Agent 5 (Deps) | SUPABASE_SERVICE_ROLE_KEY 누락 시 런타임에만 감지 | Critical | ✅ service.ts 코드 확인 |
| R1-06 | Agent 8 (UX) | CoacheeBottomTabs "체크" → `/my-coaching/moksilgi/monthly` (잘못된 경로) | Medium | ✅ CoacheeBottomTabs.tsx 직접 확인 |
| R1-07 | Agent 2 (Perf) | Middleware profiles 테이블 2회 조회 (3~4 DB queries/request) | Medium | ✅ middleware.ts + get-user-roles.ts 확인 |
| R1-08 | Agent 4 (CSP) | CSP `script-src 'unsafe-inline'` | Medium | ✅ next.config.ts 확인 |
| R1-09 | Agent 5 (Deps) | `@xyflow/react`, `dagre`, `nodemailer` 미사용 패키지 | Medium | ✅ src/ 전체 grep — import 없음 |
| R1-10 | Agent 1 (Admin) | `revalidateTag("admin-user-role-summary", { expire: 0 })` 비표준 2번째 인자 | Low | ✅ 코드 확인 |
| R1-11 | Agent 8 (UX) | `check/page.tsx` — `getMyCoachingMe()` 이후 profiles 재조회 | Low | ✅ 코드 확인 (redundant query) |
| R1-12 | Agent 3 (RLS) | `updateProfile.ts`, `invitations/route.ts` — `as any` 캐스팅 (CLAUDE.md §12 위반) | Medium | ✅ 코드 확인 (line 267, 305) |
| R1-13 | Agent 7 (Env) | `.env.local` 실제 키 포함 → Critical 주장 | ~~Critical~~ | ❌ **재검증: `.gitignore` 포함 확인 → Low로 하향** |
| R1-14 | Agent 6 (Infra) | Next.js `^16.2.4` / TypeScript `^6.0.3` "존재하지 않는 버전" | Medium | ❌ **재검증: 실제 설치 확인 → 기각** |
| R1-15 | Agent 3 (RLS) | `profiles_update_own` RLS — 컬럼 제한 없음 | High | ⚠️ **재검증: 앱 레이어 화이트리스트 확인 → Low로 하향** |

---

## 2차 비판 결과

### 1차 제안 부작용 + 놓친 문제

| ID | 출처 | 발견 | 위험도 | 비고 |
|----|------|------|--------|------|
| R2-01 | 2차 Agent A | `saveTodayCheckAction` INSERT: `achievement_rate: 0` 하드코딩, UPDATE에서도 재계산 없음 | **High** | 1차 미발견 — 신규 |
| R2-02 | 2차 Agent A | Server Action 클로저: 렌더링 시점 날짜 고정 → 자정 경계 이후 실행 시 전월 기록에 쓰임 | Medium | 1차 미발견 — 신규 |
| R2-03 | 2차 Agent A | service_role → session client 교체 후 RLS UPDATE WITH CHECK 3-way JOIN 검증 미완 | Medium | 1차 제안 부작용 |
| R2-04 | 2차 Agent A | `daily_checks_json` ISO date key + day number key 이중 저장 혼재 | Low | 1차 미발견 — 신규 |
| R2-05 | 2차 Agent B | `/api/invitations/accept` — 인증 체크(L410) 이후 DB 조회(L442) 순서 역전 + rate limiting 부재 | **High** | 1차 미발견 — 신규 |
| R2-06 | 2차 Agent B | `is_coach_for_coachee()` status='active' 추가 시 종료된 관계의 goals/feedback 접근 차단 | Medium | 1차 제안 부작용 |
| R2-07 | 2차 Agent C | Vercel 빌드 시 `check:debug-routes`가 `NODE_ENV=production` strict 모드로 실행 → 예기치 않은 배포 차단 가능 | Medium | 1차 미발견 — 신규 |
| R2-08 | 2차 Agent C | `@xyflow/react` + `dagre` 미사용 재확인 — coaching-genealogy 폴더는 Leaflet으로 구현됨 | Medium | 1차 확인 강화 |

---

## 최종 수정 우선순위 (A/B/C/D 분류)

### A — 즉시 수정 (코드 변경 최소, 기능 손상 명확, LOCK 해당 없음)

---

**A1. `saveTodayCheckAction` INSERT `achievement_rate: 0` 하드코딩**

- **파일:** `src/app/my-coaching/check/page.tsx` L278-L291 (INSERT), L308-L319 (UPDATE)
- **근거:** INSERT 시 `achievement_rate: 0` 하드코딩. UPDATE 시 `achievement_rate` 갱신 없음. `moksilgi-monthly.ts`의 `saveMyMoksilgiMonthlyRecord`는 실제 달성률을 계산해 저장하나, 오늘 체크 경로에서는 전혀 계산하지 않음. 사용자가 check 페이지에서만 체크하면 `achievement_rate`가 영구적으로 0이 됨.
- **영향:** 목실기 달성률 데이터 오염 → 월간 요약, spiritual_rate 등 모든 집계 오류
- **수정 방법:** UPDATE 실행 후 `countTrue(dailyChecks) / daysInMonth`로 `achievement_rate`를 재계산하여 업데이트 추가
- **변경 파일:** 1개 (`check/page.tsx`)
- **LOCK 여부:** 해당 없음 (check 페이지는 별도 흐름)
- **확신도:** 높음

---

**A2. CoacheeBottomTabs "체크" 탭 잘못된 경로**

- **파일:** `src/components/navigation/CoacheeBottomTabs.tsx`
- **근거:** "체크" 탭 href = `/my-coaching/moksilgi/monthly` (월별 달력). 실제 오늘 체크 페이지는 `/my-coaching/check`. 사용자가 "체크" 버튼을 누르면 오늘 체크 화면이 아닌 월별 달력으로 이동함.
- **수정 방법:** `href="/my-coaching/moksilgi/monthly"` → `href="/my-coaching/check"`
- **변경 파일:** 1개
- **LOCK 여부:** Korean-first UI/i18n label structure LOCK이 있으나, 이는 라벨 문자열이 아닌 경로 버그 수정이므로 해당 없음
- **확신도:** 높음

---

**A3. `/api/invitations/accept` 인증 체크 순서 역전**

- **파일:** `src/lib/api/invitations/accept.ts` L410 vs L442
- **근거:** 현재 실행 순서: `input validation(L394)` → `findInvitationPreview() DB 조회(L442)` → `auth check(L410)`. 인증되지 않은 요청도 DB를 쿼리함. 또한 응답에서 `INVITE_NOT_FOUND` vs `INVITATION_PREVIEW_FAILED` 구분이 미인증 상태에서도 노출됨.
- **수정 방법:** auth check 코드 블록(L410 부근)을 `findInvitationPreview()` 호출(L442) 이전으로 이동
- **변경 파일:** 1개
- **LOCK 여부:** invitation acceptance RPC는 LOCK이지만, 인증 체크 순서 조정은 RPC 로직 변경이 아님. 단, 이 파일 수정 시 LOCK 흐름 내 파일이므로 주의 필요 — **사용자 승인 후 진행**
- **확신도:** 높음

---

### B — 다음 단계 (비즈니스 결정 또는 추가 검증 후 진행)

---

**B1. `is_coach_for_coachee()` `cr.status = 'active'` 조건 추가**

- **파일:** `supabase/migrations/0024_enable_rls_for_new_tables.sql` (SQL function)
- **근거:** 현재 `cr.deleted_at IS NULL`만 체크. 종료된 관계(status = 'completed', 'terminated')의 코치도 coachee의 goals, coach_feedback 데이터에 접근 가능.
- **부작용 (2차 발견):** `status = 'active'` 추가 시, 종료된 관계의 코치가 과거 데이터를 조회할 수 없게 됨. "코칭 관계 종료 후 코치의 과거 데이터 접근 허용 여부"를 비즈니스 레벨에서 먼저 결정해야 함.
- **선행 조건:** 비즈니스 결정 + 롤백 플랜 포함 migration 작성
- **확신도:** 높음

---

**B2. `findAuthUserByEmail` O(N) 스캔 개선**

- **파일:** `src/app/api/admin/users/route.ts`
- **근거:** Supabase Admin API에 이메일 직접 검색 기능이 없어 최대 50페이지(50,000 user) 전체 스캔. admin 전용 기능이므로 즉각적 위험은 낮으나, 사용자 수 증가 시 API timeout 위험.
- **권장 방법:** DB `profiles` 테이블에서 email로 검색 후 `auth_user_id`를 통해 역참조하는 방식으로 전환 (Supabase service_role + DB 직접 쿼리)
- **변경 파일:** 1개
- **확신도:** 높음

---

**B3. Middleware 중복 profiles 조회 제거**

- **파일:** `src/middleware.ts`, `src/lib/auth/get-user-roles.ts`
- **근거:** 모든 보호된 요청마다 `profiles` 테이블이 2회 조회됨 (middleware 직접 + getUserRoles 내부). 3~4 DB round-trips/request.
- **부작용:** `getUserRoles()` 시그니처를 변경하면 호출 위치 전수 수정 필요. auth 로직에 인접한 LOCK 영역이므로 주의.
- **변경 파일:** 2~3개 (middleware.ts, get-user-roles.ts, 호출 위치)
- **선행 조건:** auth 흐름 수정 승인
- **확신도:** 높음

---

**B4. `saveTodayCheckAction` 날짜 경계 클로저 고정 이슈**

- **파일:** `src/app/my-coaching/check/page.tsx` L112-L144, L228-L365
- **근거:** 페이지 렌더링 시점의 `todayDateKey`, `currentYear`, `currentMonth`가 Server Action 클로저에 고정됨. 자정 경계 이후 실행 시 이전 달/일에 기록됨.
- **수정 방법:** Action 내부에서 `timezone` 파라미터를 받아 실행 시점에 날짜를 재계산
- **변경 파일:** 1개
- **A1과 함께 처리 권장**
- **확신도:** 높음

---

**B5. 미사용 패키지 제거**

- **패키지:** `@xyflow/react ^12.10.2`, `dagre ^0.8.5`, `nodemailer ^8.0.7`
- **근거:** `src/` 전체 grep 결과 — 세 패키지 모두 import 없음. `coaching-genealogy`는 `react-leaflet`으로 구현됨. `nodemailer`는 Resend API 직접 사용으로 대체됨.
- **수정 방법:** `npm uninstall @xyflow/react dagre nodemailer`
- **변경 파일:** `package.json` (CLAUDE.md에서 package.json 수정 주의이나, 패키지 제거는 기능에 영향 없음)
- **확신도:** 높음

---

**B6. SUPABASE_SERVICE_ROLE_KEY 누락 — 빌드 타임 감지 부재**

- **파일:** `src/lib/supabase/service.ts`
- **근거:** `SUPABASE_SERVICE_ROLE_KEY`가 없으면 `{ client: null, error: "..." }` 반환. 11개 이상의 API 라우트가 이 클라이언트를 사용하며, 배포 후 런타임에만 실패.
- **수정 방법:** `next.config.ts`에 환경 변수 존재 여부 검사 추가, 또는 배포 파이프라인에 `required-env` 체크 스크립트 추가
- **변경 파일:** 1개
- **확신도:** 높음

---

**B7. Migration 0014 누락 + 0001-0012 위치 분산**

- **위치:** `supabase/migrations/` (0014 파일 없음), 프로젝트 루트 (0001-0012 위치)
- **근거:** `supabase db push` 또는 `supabase migration up` 실행 시 0014 gap으로 인해 오류 발생 가능. 루트에 있는 0001-0012는 Supabase CLI가 인식하지 못할 수 있음.
- **수정 방법:** 누락 원인 파악 후 빈 migration 0014 생성하거나 번호 재정렬. 0001-0012를 `supabase/migrations/`로 이동.
- **선행 조건:** DB schema 변경이므로 별도 승인 필요
- **확신도:** 높음

---

### C — 보류 (부작용 검토 완료 후 별도 작업으로 진행)

| ID | 항목 | 이유 |
|----|------|------|
| C1 | CSP `script-src 'unsafe-inline'` 제거 | 인라인 스크립트 전수 조사 선행 필요. 제거 시 특정 UI 기능 깨질 수 있음 |
| C2 | `as any` 캐스팅 제거 (`updateProfile.ts`, `invitations/route.ts`) | LOCK 흐름 파일. 별도 DB 타입 재생성 작업과 함께 진행 필요 |
| C3 | `check/page.tsx` `service_role` → session client 교체 | RLS UPDATE WITH CHECK 3-way JOIN 실제 통과 여부를 staging에서 검증 후 진행 |
| C4 | `revalidateTag` 비표준 2번째 인자 | 기능에 영향 없음. 낮은 우선순위 |
| C5 | `profiles_update_own` RLS 컬럼 제한 추가 | 앱 레이어가 이미 화이트리스트 보호 중. defense-in-depth 차원이므로 로드맵에 추가 |
| C6 | Vercel 빌드 `check:debug-routes` strict 모드 동작 문서화 | `AI_WORKFLOW.md` 또는 README에 명시. 코드 변경 아님 |
| C7 | `daily_checks_json` 키 형식 통일 (ISO date vs day number) | 현재 기능에 영향 없음. 향후 집계 로직 수정 시 정리 |

---

### D — 기각 (근거 불충분 또는 오판)

| ID | 항목 | 기각 이유 |
|----|------|---------|
| D1 | Next.js `^16.2.4` / TypeScript `^6.0.3` "존재하지 않는 버전" | `node_modules/next/package.json`, `node_modules/typescript/package.json` 직접 확인 — 정상 설치됨. 2026년 기준 릴리스된 버전. Agent 6의 2024년 기준 판단 오류. |
| D2 | `.env.local` 실제 키 노출 → Critical | `.gitignore`에 포함 확인. 로컬 개발 표준 패턴. git에 커밋되지 않음. 1차 Agent 7의 과도한 분류. |

---

## 실제 수정 제안 (범위·파일 명세)

### 수정 1: CoacheeBottomTabs 경로 수정 (A2)

**작업 목표:** "체크" 탭이 오늘 체크 페이지로 정상 연결되도록 수정  
**수정 파일:** `src/components/navigation/CoacheeBottomTabs.tsx` (1개)  
**수정하지 않을 LOCK 흐름:** 전체 (경로 문자열만 변경)

```diff
- href="/my-coaching/moksilgi/monthly"
+ href="/my-coaching/check"
```

**검증 명령어:**
```bash
npm run typecheck
npm run build
```

---

### 수정 2: check/page.tsx `achievement_rate` 재계산 (A1 + B4)

**작업 목표:** 오늘 체크 저장 시 달성률 재계산 및 날짜 클로저 고정 수정  
**수정 파일:** `src/app/my-coaching/check/page.tsx` (1개)  
**수정하지 않을 LOCK 흐름:** weekly_logs, invitation, profile, role

**수정 내용 요약:**

1. `saveTodayCheckAction` 내부에서 날짜를 클로저가 아닌 실행 시점에 재계산
2. INSERT 시 `achievement_rate` 계산 후 삽입 (`countTrue(updatedChecks) / daysInMonth`)
3. UPDATE 시 `achievement_rate` 재계산 후 업데이트

**검증 명령어:**
```bash
npm run typecheck
npm run check:all
npm run build
```

---

### 수정 3: `/api/invitations/accept` 인증 순서 수정 (A3)

**작업 목표:** 인증 체크를 DB 조회 이전으로 이동  
**수정 파일:** `src/lib/api/invitations/accept.ts` (1개)  
**수정하지 않을 LOCK 흐름:** invitation acceptance RPC의 핵심 로직 (인증 체크 순서만 변경)

⚠️ LOCK 파일 인접 — **사용자 명시적 승인 필요**

**수정 내용 요약:**

현재 순서:
```
L394: input validation
L442: findInvitationPreview() [DB hit]
L410: auth check
```

수정 후 순서:
```
L394: input validation
L410: auth check  ← 이 블록을 앞으로 이동
L442: findInvitationPreview() [DB hit]
```

**검증 명령어:**
```bash
npm run typecheck
npm run check:all
npm run build
```

---

### 수정 4: 미사용 패키지 제거 (B5)

**작업 목표:** 번들 크기 및 설치 비용 절감  
**수정 파일:** `package.json` (1개)

⚠️ CLAUDE.md에서 `package.json` 수정 주의 명시 — **사용자 승인 후 진행**

```bash
npm uninstall @xyflow/react dagre nodemailer
```

**검증 명령어:**
```bash
npm run build
```

---

## Cursor에서 바로 실행할 수정 명령어

### 즉시 실행 가능 (사용자 승인 불필요)

**A2 — BottomTabs 경로 수정:**
```
파일: src/components/navigation/CoacheeBottomTabs.tsx

변경:
  href="/my-coaching/moksilgi/monthly"
→ href="/my-coaching/check"

(탭 텍스트 "체크"에 해당하는 href 값만 변경)
```

---

### 사용자 승인 후 실행

**A1+B4 — check/page.tsx 달성률 재계산 + 날짜 클로저 수정:**
```
파일: src/app/my-coaching/check/page.tsx

1) saveTodayCheckAction 상단에서 timezone을 파라미터로 받아
   실행 시점에 todayDateKey, currentYear, currentMonth 재계산

2) INSERT 경로에서 achievement_rate를
   countTrue(initialChecks) / daysInMonth 로 계산 후 삽입

3) UPDATE 경로에서 achievement_rate를
   countTrue(updatedChecks) / daysInMonth 로 재계산 후 업데이트
```

**A3 — invitations/accept 인증 순서:**
```
파일: src/lib/api/invitations/accept.ts

현재 L442의 findInvitationPreview() 호출 이전으로
L410의 auth check 블록 전체를 이동

변경 후 npm run typecheck 필수
```

**B5 — 미사용 패키지 제거:**
```bash
npm uninstall @xyflow/react dagre nodemailer
npm run build
```

---

## 수정 계획 요약 (실행 전 체크리스트)

작업 시작 전 아래를 확인하고 승인을 받는다.

- [ ] A2 (BottomTabs 경로) — 수정 파일 1개, LOCK 없음 → **즉시 가능**
- [ ] A1+B4 (check/page 달성률+날짜) — 수정 파일 1개, LOCK 없음 → **사용자 확인 후 진행**
- [ ] A3 (invitations/accept 인증 순서) — LOCK 인접 파일 → **명시적 승인 필요**
- [ ] B1 (is_coach_for_coachee status) — DB migration 변경 → **비즈니스 결정 + 롤백 플랜 필수**
- [ ] B2 (findAuthUserByEmail O(N)) — admin 전용, 점진적 개선
- [ ] B3 (middleware 중복 조회) — auth 흐름 인접, 별도 승인
- [ ] B5 (미사용 패키지) — package.json 수정 → **사용자 승인 필요**
- [ ] B6 (SERVICE_ROLE_KEY 빌드 타임 감지) — 배포 안전성
- [ ] B7 (migration 위치 정리) — DB 작업, 별도 승인

---

*이 보고서는 코드 수정을 포함하지 않습니다. 모든 제안은 실행 전 사용자 승인이 필요합니다.*
