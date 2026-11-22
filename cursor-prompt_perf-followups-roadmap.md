# 성능 후속 작업 로드맵 (2026-11-23 기준)

> 1~3차 성능 작업 완료(`3a5b85a`, `1ca1291`, `7a23331`, origin/main 반영) 이후 남은 항목 정리.
> **한 번에 한 항목만** 진행하고, 각 항목은 검증·커밋 후 다음으로 넘어간다.

---

## 0. 먼저 할 것 — 사람이 대시보드에서 확인 (코드 없음)

| # | 항목 | 어디서 | 문서 |
|---|---|---|---|
| 0-1 | Supabase 리전 ↔ Vercel Function Region 일치 | Supabase / Vercel 대시보드 | `cursor-prompt_perf-roundtrip-region.md` Part A |
| 0-2 | JWT 서명 키 방식(HS256 legacy 여부) | Supabase → JWT Keys | 같은 문서 Part A-2 |
| 0-3 | `user_roles` 인덱스 · 데이터 규모 · Max Rows | Supabase SQL Editor | `cursor-prompt_perf-large-in-lists-row-cap.md` Part A |
| 0-4 | 배포 후 수치·권한 동일성 확인 + `[API_PERFORMANCE]` 전후 비교 | 배포 사이트 / Vercel Logs | — |

> 0-1이 체감 속도에 가장 큰 영향을 줄 가능성이 높다. 코드 후속 작업보다 먼저 한다.

---

## 1. 코드 후속 작업 (우선순위 순)

| 순서 | 작업 | 위험도 | 파일 수 | 승인 필요 | 문서 |
|---|---|---|---|---|---|
| ~~F1~~ ✅ | 목실기 진행현황 plans·관계 조회 1000행 잘림 방지 + 공용 헬퍼로 통일 — **완료 `6fcf44b`** | 낮음 | 1 | — | `cursor-prompt_perf-f1-moksilgi-progress-row-cap.md` |
| ~~F2~~ ✅ | 코치메이커 상세·실행메모 profile/roles 조회 병렬화 — **완료 `dcd0edd`** | 낮음 | 2 | — | `cursor-prompt_perf-f2-detail-action-notes-parallel.md` |
| ~~F3~~ ⛔ | `user_roles(profile_id)` 인덱스 migration — **불필요** (2026-11-23 확인: 실제 DB에 `idx_user_roles_profile_id (profile_id) WHERE deleted_at IS NULL`와 `profile_id`로 시작하는 unique 인덱스 2개가 이미 있음) | — | — | — | `cursor-prompt_perf-f3-user-roles-index.md` |
| F4 | 목실기 진행현황 인쇄 데이터 지연 로딩 | 중간 | 3~4 | 범위 확대 승인 | 미작성 — 아래 설계 메모 |
| F5 | 목실기 월 성취율 DB 집계(RPC/view) | 높음 | 2~3 + migration | **DB 변경 승인** | 미작성 — 아래 설계 메모 |
| F6 | 계보도(`coaching-genealogy.ts`) `.in()` 묶음·페이징 | 중간 | 1 (2,900줄) | 범위 승인 | 미작성 — 함수 단위 분할 필요 |
| F7 | 미들웨어 profiles+user_roles 단일 조회 | 높음 | 1 (`src/proxy.ts`) | **auth 핵심 · 별도 검토** | 보류 권장 |

권장 순서: **0 → F1 → F2 → (0-3 결과에 따라) F3 → 측정 후 F4/F5 판단**

---

## 2. 미작성 항목 설계 메모

### F4. 인쇄 데이터 지연 로딩
- 현재: `getCoachMakerMoksilgiProgress`가 매 요청 `printRows`, `printRelationshipRows`(전체 인원)를 반환한다. 이 데이터는 RSC payload로 직렬화되어 페이지 HTML에 실린다.
- 방향: 기본 응답에서 인쇄 데이터를 빼고, 인쇄 버튼을 누를 때 `/api/coach-maker/moksilgi-progress/print` 같은 별도 요청으로 받는다.
- 주의: `page.tsx`와 인쇄 클라이언트 컴포넌트 props가 바뀐다. CLAUDE.md "public props 변경 금지"에 걸리므로 **optional prop 추가 방식**으로 설계해야 한다. 개요(overview) 계산에는 여전히 전체 데이터가 필요하다 → F5와 함께 볼 것.

### F5. 월 성취율 DB 집계
- 현재: 월 실적 전체 행(plan × 목표 × 12)을 앱 서버로 가져와 `buildMoksilgiExcelSummary`로 계산한다.
- 방향: 같은 계산식을 SQL 함수로 옮겨 plan당 최대 12행(`plan_id, month, average_rate`)만 받는다.
- 주의: 엑셀 성취표 계산식(`EXCEL_MONTH_SCALE`, measurement_type별 계산)을 SQL로 **정확히** 재현해야 한다. 앱 계산 결과와 SQL 결과를 전체 plan에 대해 비교하는 검증 스크립트가 먼저 필요하다. 위험도가 가장 높다.
- 대안(더 쉬움): `loadExcelMonthlySummaries` 결과를 (연도 + planIds 해시) 키로 60초 캐시. 실적 저장 후 최대 60초 늦게 반영되는 동작 변화가 있어 승인이 필요하다.

### F6. 계보도
- `.in()` 19곳, `history limit 500`. 3차의 `src/lib/supabase/fetch-in-chunks.ts`를 재사용한다.
- 파일이 커서 "관계 조회 → 프로필 조회 → 이력 조회" 함수 단위로 나눠 2~3회에 걸쳐 진행한다.

### F7. 미들웨어 단일 조회
- `profiles` select에 `user_roles(...)`를 embed하면 역할 제한 경로에서 왕복 1회가 준다.
- `src/proxy.ts`는 인증·권한 판정 핵심(LOCK 인접)이고 모든 요청에 영향이 있다. 0-1·0-2 적용 후에도 느릴 때만 검토한다.

---

## 3. 성능 외 발견 사항 (별도 처리 — Codex 담당)

- **목실기 진행현황 관계 범위 폴백** → 수정 명령어: `cursor-prompt_fix-moksilgi-progress-relationship-scope.md`
  - 대상 역할: **organization_admin·country_admin**. 이전에 "coach_maker"라고 적은 것은 정정한다.
  - 스코프 프로필 200명 초과, 또는 스코프 조회 오류 시 사전 필터 없이 **전체 active 관계**가 관계 표에 표시된다.

---

## 4. 의도적으로 제외한 것

- `dashboard/me.ts`: 이미 `verifiedProfileId`로 profile·roles를 병렬 조회 중이다. 공지 조회는 roles에 의존하므로 직렬이 맞다.
- `my-coaching/me.ts`, `profile/me.ts`: profile 이후 roles·관계·소속을 이미 병렬 조회한다. 추가 이득이 작다.
- `my-coaching/weekly-log.ts`: weekly log 흐름은 **LOCK**이다.
- `admin/*`: 관리자 화면은 사용 빈도가 낮다. LOCK 항목(admin users list 등)이 많아 제외했다.
