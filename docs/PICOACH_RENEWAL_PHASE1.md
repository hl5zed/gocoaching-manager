# 피코치 페이지 리뉴얼 — 1차 작업 계획 (확정 결정 반영)

> **범위 원칙(1차):** DB 구조 변경 없음. 기존 테이블만 활용
> (`moksilgi_plans`, `moksilgi_monthly_records`, `moksilgi_monthly_summaries`, `daily_records`, `weekly_logs`, `monthly_reflections`, `coach_feedback`).
> 목적: 새 기능 대량 추가가 아니라, **이미 있는 화면을 모바일 중심 "오늘 실행 허브"로 재정리**.
> 2차로 분리: DB 확장 · coach_feedback target 확장 · 목표 수정 승인 흐름.

## 확정된 결정 (사용자)

1. `/moksilgi/monthly`를 **실행 체크와 리포트가 동시에** 쓰는 구조는 피한다.
2. `/moksilgi`는 매일 실행 화면이 아니라 **목표 설계 화면**으로 역할 고정.
3. 목표 단일 출처(SSoT) = **`moksilgi_plans`** 기준.
4. To-do는 우선 **`daily_checks_json` 재사용**, 향후 `daily_todos` 분리 가능성만 열어둠.
5. `daily_records` 컬럼 추가는 보류, **기존 필드 기반 UI 개선** 먼저.
6. `coach_feedback` 확장은 중요하지만 **2차**로 분리.
7. 하단 탭은 **오늘 / 목표 / 체크 / 기록 / 리포트** 로 정리.

---

## 핵심 해법 — 역할 분리는 "기존 페이지 재배치"로 가능 (DB 변경 0)

| 역할 | 화면 | 비고 |
|---|---|---|
| 실행 **체크(입력)** | `/my-coaching/moksilgi/monthly` | 일/주 체크 입력 엔진 유지 (write) |
| **리포트(조회)** | `/my-coaching/moksilgi/summary` | **이미 read-only 연간 성취표** 존재 → 리포트 탭으로 승격 |
| 목표 **설계(편집)** | `/my-coaching/moksilgi` | 탭에서 내리고, "목표" 화면의 "수정" 진입으로만 노출 |

→ 결정 1·2가 새 페이지 없이 충족됩니다(monthly=체크, summary=리포트, moksilgi=설계).

---

## 하단 탭 (확정)

| 탭 | 라벨 | 경로 | 활성 판정 |
|---|---|---|---|
| 1 | 오늘 | `/my-coaching` | exact |
| 2 | 목표 | `/my-coaching/goals` | prefix |
| 3 | 체크 | `/my-coaching/moksilgi/monthly` | prefix |
| 4 | 기록 | `/my-coaching/records/daily` | prefix |
| 5 | 리포트 | `/my-coaching/moksilgi/summary` | prefix |

변경점: 현재 `오늘/체크/기록/계획/성장` → `오늘/목표/체크/기록/리포트`.
`계획(/moksilgi)` 탭 제거(설계는 목표 화면 경유), `성장`→`목표`로 명칭 통일, `리포트` 탭은 summary로 신설.
파일: `CoacheeBottomTabs.tsx` 1개(presentational, 라우팅/권한 로직 없음).

---

## 화면별 역할·UI (1차)

### 1) 오늘 (`/my-coaching`) — 오늘 실행 허브
- 유지: 오늘 날짜·환영, 오늘 전체 실행률, 핵심가치 뱃지, 4영역 카드.
- 추가(읽기/재사용): **오늘 To-do 인라인 체크**(`daily_checks_json`의 오늘 분), 빠른버튼 4종(오늘 체크/오늘 기록/나의 목표/리포트).
- DB: 변경 없음. 체크 저장은 **monthly의 기존 저장 액션 재사용**(새 저장 로직 금지).

### 2) 목표 (`/my-coaching/goals`) — 미션·비전·핵심가치·목표
- 유지: `moksilgi_plans` 기반 미션/비전/핵심가치/장기목표/4영역 목표+이달 실행률(읽기).
- 정리: 상단 미션·비전·핵심가치 고정 + 4영역 목표 카드. "수정"은 `/moksilgi`로 이동(설계 화면).
- 1차 제외: 기간 탭(올해/이달/주/오늘), 수정요청→승인(2차).

### 3) 체크 (`/my-coaching/moksilgi/monthly`) — 실행 체크 입력
- 역할 고정: **체크 입력 전용**(리포트 표현 축소). 일/주 체크 + 월간 수치 입력.
- UI: 큰 체크 영역, 4영역 색상, "완료 n/전체 m", 미완료 따뜻한 안내.
- DB: 변경 없음.

### 4) 기록 (`/my-coaching/records/daily`) — 하루 기록
- 기존 필드(`title/reflection/practice/prayer_request`)만으로 **단계형·접이식 카드** UI로 개선.
- 코치 공유 토글(`shared_with_coach`/`visibility`) 유지. 상태(임시저장/제출/검토완료) 유지.
- 1차 제외: 감사/배운점/어려움/감정/코치질문 신규 컬럼(2차).

### 5) 리포트 (`/my-coaching/moksilgi/summary`) — 월간/연간 리포트
- 기존 read-only 연간 성취표 + 이달 종합(전월 대비) 유지.
- 정리: 리포트 탭 진입점으로 표시 일관화, monthly로의 "체크하러 가기" 링크.
- DB: 변경 없음.

---

## 1차 구현 순서 (한 번에 한 기능 · 1~4파일 · 매 단계 검증)

> 매 단계 공통: LOCK 흐름(weekly_logs 저장, invitation, auth/role/profile) 수정 금지 · enum 유지 · `any`/`@ts-ignore` 금지 · 쿼리 의미 변경 금지(§15).
> 검증: `npm run typecheck` → `npm run check:all` → `npm run build`.

| 순서 | 작업 | 예상 수정 파일(1~4) | 테스트 |
|---|---|---|---|
| **1** | 하단 탭 라벨/경로 정리(오늘·목표·체크·기록·리포트) | `components/navigation/CoacheeBottomTabs.tsx` | 각 탭 활성표시, 라우팅, 빌드 |
| **2** | 리포트/체크 역할 분리(summary=리포트 진입, monthly 리포트 표현 축소 안내) | `moksilgi/summary/page.tsx`, `moksilgi/monthly/page.tsx` | 두 화면 진입·상호 링크 |
| **3** | 오늘 홈에 오늘 To-do 인라인 체크 | `my-coaching/page.tsx`, (신규)`components/coachee/TodayTodoList.tsx`, `TodoCheckItem.tsx` | 체크→`daily_checks_json` 반영, 실행률 갱신 |
| **4** | 하루 기록 단계형/접이식 UI(기존 필드) | `records/daily/DailyRecordsClient.tsx` | 저장/수정/공유, 빈값 처리 |
| **5** | 목표 화면 정리(설계 진입 동선·문구) | `my-coaching/goals/page.tsx` | 읽기 표시, "수정"→/moksilgi |

각 단계는 **착수 전 작업 보고(목표·수정 파일·미수정 LOCK 흐름·검증 명령어)** 후 진행, 끝나면 검증 결과 보고.

## 2차로 분리(이번에 안 함)
- `daily_records` 컬럼 추가(감사/배운점/어려움/감정/코치질문)
- `coach_feedback` target 다형 확장 + 읽음 표시(`read_by_coachee_at`)
- 목표 수정요청→승인→이력(`goal_change_requests`)
- `daily_todos` 분리(현재는 `daily_checks_json` 유지)
