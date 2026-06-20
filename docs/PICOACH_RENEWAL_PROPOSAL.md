# 피코치(Coachee) 페이지 리뉴얼 설계안

> **상태: 분석 + 설계 제안 문서입니다. 코드는 변경하지 않았습니다.**
> CLAUDE.md / AI_WORKFLOW.md 원칙에 따라, 실제 구현은 단계별 승인 후 "한 번에 한 기능, 1~4개 파일" 범위로만 진행합니다.

분석 대상: `src/app/my-coaching/**`, `src/lib/api/my-coaching/**`, `src/components/coachee/**`, `src/components/navigation/**`, `supabase/migrations/0018~0028, 0039`.

---

## 0. 가장 중요한 발견 — "많은 것이 이미 만들어져 있다"

리뉴얼을 **새로 만드는 작업**으로 접근하면 안 됩니다. 핵심 인프라는 대부분 존재하며, 이번 작업의 본질은 **역할 재정의 · 연결 · 채우기**입니다.

| 사용자가 "필요"하다고 본 것 | 실제 현황 |
|---|---|
| 모바일 하단 탭 네비게이션 | **이미 존재** — `app/my-coaching/layout.tsx` + `CoacheeBottomTabs`(5탭: 오늘/체크/기록/계획/성장) + `CoacheeTopBar` |
| 모바일 우선 셸/카드 디자인 | **이미 존재** — `max-w-md` 셸, 디자인 토큰(`surface-*`, `ink-*`, `line-*`, `brand-*`), 공통 컴포넌트 `Card/Badge/Button/ProgressBar` |
| 4영역 색상 체계 | **이미 존재** — 영적=violet, 지적=sky, 신체=brand, 사회=amber, 기타=slate (`MoksilgiAreaCard.tsx`) |
| 오늘 홈(날짜·환영·실행률·4영역) | **이미 존재** — `my-coaching/page.tsx` |
| coaching_goals / daily_todos / daily_records / weekly_reviews / monthly_reviews / coach_feedbacks 테이블 | **대부분 이미 존재** (이름이 다름, 아래 6장 참고) |

따라서 새 테이블·새 페이지는 **꼭 필요한 2가지(코치 피드백 확장, 목표 수정요청)** 로 최소화하는 것을 권장합니다.

---

## 1. 현재 5개 페이지 기능 분석

| 페이지 | 현재 역할 | 현재 기능 | 문제점 | 개선 방향 |
|---|---|---|---|---|
| `/my-coaching` | 오늘 홈 | 오늘 날짜·환영, 오늘 전체 실행률(ProgressBar), 핵심가치 뱃지, 4영역 카드(`TodayAreaCard`), 빠른버튼(오늘 기록/이번 달 체크/월별 요약/나의 성장) | 오늘 To-do를 **직접 체크**하는 진입이 없음(체크는 monthly로 이동). 코치 피드백 확인 상태·이번 주 요약이 홈에 없음 | 홈을 "오늘 실행 허브"로. 오늘 To-do 인라인 체크 + 코치 피드백 알림 + 이번 주 요약 추가 |
| `/my-coaching/goals` | 나의 성장(읽기전용) | 미션·비전·핵심가치·장기목표·4영역 목표+이달 실행률 표시(`moksilgi_plans` + `monthly_summaries`). 편집은 "목실기에서 수정"으로 이동 | 기간별(올해/이달/이번주/오늘) 구분 없음. **수정요청→코치승인** 흐름 없음, 변경 이력 없음. 진행률이 월간 요약치만 | 미션/비전/핵심가치 상단 고정 + 기간 탭. 코치 승인·피드백 상태 표시. 수정요청 흐름 도입 |
| `/my-coaching/moksilgi` | 목실기 작성(계획) | 기본정보/사명/비전/핵심가치/목표/세부목표/실행전략 입력, 출력(PDF) | 폼이 매우 큼(850줄). 피코치가 매일 쓰는 화면이 아니라 "설계 문서" 성격 | "목표 설정/편집" 전용으로 역할 명확화. 일상 실행은 홈·체크로 분리 |
| `/my-coaching/moksilgi/monthly` | 월별 체크리스트 | 세부목표별 매일·매주 체크 + 월간 수치 입력, 달성률 자동계산, 주차별(첫주~다섯째주), 영역 평균, 종합/평균/누적 | 이름이 "monthly"지만 실제로는 **일/주/월 실행 체크의 핵심 엔진**. "오늘만" 보는 뷰가 없음 | "실행 체크" 엔진으로 유지. 여기서 오늘 슬라이스를 뽑아 홈/체크 탭에 노출 |
| `/my-coaching/records/daily` | 하루 기록 | 폼(날짜/제목/돌아봄/실천·적용/기도제목) + 코치 공유 토글(`shared_with_coach`/`visibility`) + 상태(임시저장/제출/검토완료) + 목록 검색·정렬 | 한 화면에 입력란이 많음. 감사/배운점/어려움/감정/코치질문 **전용 필드가 DB에 없음**(reflection 등에 혼재) | 단계형·접이식 카드 입력. (선택)전용 필드 추가. 코치 피드백 표시 연결 |

**추가로 이미 존재하는 관련 페이지(중복·혼선 주의):** `moksilgi/summary`, `records/monthly`, `report/weekly`, `report/monthly`, `weekly-log`, `feedback`, `check`, `spiritual-companion`, 그리고 별도 `app/coachee/report`. → 새 페이지를 만들기 전에 **이 중복부터 정리/통합**해야 합니다.

---

## 2. 피코치 성장 흐름 제안

```
미션/비전/핵심가치 확인        →  /my-coaching/goals (상단 고정 카드)
   → 기간 목표 설정/수정요청    →  /my-coaching/goals + /my-coaching/moksilgi
      → 오늘 To-do 실행 체크     →  /my-coaching (홈 인라인) ← monthly 엔진 재사용
         → 하루 기록 작성        →  /my-coaching/records/daily
            → 주간 돌아보기      →  /my-coaching/report/weekly (weekly_logs)
               → 월간 리포트     →  /my-coaching/moksilgi/monthly + records/monthly
                  → 코치 피드백  →  /my-coaching/feedback (coach_feedback)
                     → 다음 목표 조정 → goals 수정요청 → 코치 승인
```

핵심: 이 모든 단계가 **홈(`/my-coaching`)에서 한 번에 보이고 진입**되도록 홈을 "오늘의 코칭 허브"로 만드는 것이 1순위입니다.

---

## 3. 페이지별 리뉴얼 제안

### A. `/my-coaching` — 오늘 홈 (Today Hub)

- **새 역할:** 로그인 직후 "오늘 무엇을 할지"가 한눈에 보이는 실행 허브.
- **핵심 기능:** 오늘 날짜·환영 / 오늘 전체 실행률(원형 또는 바) / **오늘 To-do 인라인 체크**(4영역 일부 노출) / 오늘 기록 작성 여부 / **새 코치 피드백 알림** / 이번 주 실행률 요약 / 빠른버튼(오늘 체크·오늘 기록·나의 목표·월간 리포트).
- **UI 구성:** 상단 "오늘의 코칭" → 중앙 실행률 → 4영역 카드 → 미완료 안내 → 빠른버튼. (현재 구조 거의 유지 + To-do 체크/피드백 알림 추가)
- **필요 컴포넌트:** `TodayProgressCard`(기존 실행률 블록 컴포넌트화), `FourAreasSummary`(기존 `TodayAreaCard` 묶음), 신규 `TodayTodoList`(인라인 체크), `CoachFeedbackBanner`.
- **필요 DB:** 없음(읽기는 `moksilgi_monthly_records.daily_checks_json` 재사용). 피드백 알림은 `coach_feedback` 조회.
- **코치 연결:** 피코치 체크 결과가 `daily_checks_json`에 쌓여 코치 화면에서 조회됨(기존 경로).

### B. `/my-coaching/goals` — 미션·비전·핵심가치·목표

- **새 역할:** "왜·무엇을 향해" 를 계속 기억하는 화면 + 기간별 목표 관리.
- **핵심 기능:** 미션/비전/핵심가치/장기목표(상단 고정) + 기간 탭(올해/이번 달/이번 주/오늘) + 영역별 목표(색상 카드) + 목표별 진행률 + **"수정 요청" 버튼** + 코치 승인/피드백 상태 뱃지.
- **UI 구성:** 상단 고정 카드(미션·비전·핵심가치) → 기간 탭 → 영역 카드 → 진행률.
- **필요 컴포넌트:** 기존 `GrowthSection`/`GrowthAreaGoalCard`/`GrowthCoreValueCard` 재사용 + 신규 `GoalCard`(기간/승인상태 표시), `GoalEditRequestButton`.
- **필요 DB:** 수정요청·승인·이력을 위해 신규 `goal_change_requests`(6장). 기간 구분은 `goals.period_type`(또는 moksilgi 통합 정책) 결정 필요.
- **코치 연결:** 코치는 목표 + 수정요청을 보고 승인/피드백. 승인 시 목표 확정.
- **⚠️ 의사결정 필요:** 현재 목표가 **두 시스템에 분산**되어 있습니다 — `moksilgi_plans`(미션/비전/4영역 세부목표, 이 페이지가 사용) vs `goals` 테이블(`coach/goals`·`coachee/report`가 사용). 어느 쪽을 "단일 출처(SSoT)"로 할지 먼저 정해야 함.

### C. `/my-coaching/moksilgi` — 목표·실행전략 설계(편집 전용)

- **새 역할:** 미션/비전/핵심가치/4영역 세부목표·전략을 **설정·편집**하는 곳(매일 쓰는 화면이 아님).
- **핵심 기능:** 기존 폼 유지. 단, 일상 실행(체크·오늘)은 홈/체크로 분리하여 부담 감소.
- **UI 구성:** 긴 폼을 섹션 접이식으로. "여기는 설계, 매일 실행은 홈" 안내.
- **필요 컴포넌트:** 기존 `MoksilgiSection`/`MoksilgiAreaCard` 유지.
- **필요 DB:** 없음(`moksilgi_plans/goal_areas/detail_goals` 그대로).
- **코치 연결:** 코치가 목표 구조를 조회. (수정요청 흐름은 goals 페이지 경유)

### D. `/my-coaching/records/daily` — 하루 기록

- **새 역할:** 하루 실행·마음 상태 기록 + 코치와 나눌 내용 준비.
- **핵심 기능:** 단계형/접이식 입력(감사 → 배운점 → 실천 → 어려움 → 기도제목 → 코치에게 질문 → 감정) + 코치 공유 토글(기존) + 기록 완료 상태 + (선택)자동 임시저장 + **코치 피드백/읽음 표시**.
- **UI 구성:** 질문 카드형, 한 번에 1~2개 카드만 노출.
- **필요 컴포넌트:** 신규 `DailyRecordForm`(카드 스텝), `ReflectionQuestionCard`, `CoachFeedbackCard`.
- **필요 DB:** 현재 `daily_records`에는 `reflection/practice/prayer_request`만 있음. 감사/배운점/어려움/감정/코치질문을 **별도 필드로** 받으려면 컬럼 추가 필요(6장, 모두 nullable·기존값 보존).
- **코치 연결:** `shared_with_coach=true && visibility='coach'`일 때만 코치 SELECT(기존 RLS 0028). 피드백은 6장 확장 필요.

### E. `/my-coaching/moksilgi/monthly` — 월간 리포트

- **새 역할:** 한 달 실행 흐름 요약 + 월간 코칭 준비.
- **핵심 기능:** 이달 전체/4영역 달성률 + 날짜별 체크 달력 + 가장 잘한/약한 영역 + 빠진 날 + 연속 실행일수 + 주차별 실행률 + 월간 감사/배운점 요약 + 코치 피드백 + 다음 달 목표.
- **UI 구성:** 월간 캘린더형 체크 → 영역 진행 바 → 주차 카드 → 코치 피드백 박스 → "이번 달 돌아보기".
- **필요 컴포넌트:** 신규 `MonthlyCalendarProgress`, `MonthlyAreaProgress`, `WeeklySummaryCard`, `CoachFeedbackCard`.
- **필요 DB:** 거의 없음 — 달성률은 `moksilgi_monthly_records/summaries` 재사용, 돌아보기는 `monthly_reflections` 재사용. 코치 피드백만 6장 확장.
- **코치 연결:** `monthly_reflections` 공유 + 코치 피드백.

---

## 4. To-do List UX 제안

| 항목 | 제안 |
|---|---|
| 체크 방식 | 큰 탭 영역(최소 44~56px), 엄지 도달 범위(화면 하단), 탭 즉시 토글 |
| 영역별 구분 | 4영역 색상 + 아이콘(영적/지적/신체/사회). 기존 색상 토큰 재사용 |
| 진행률 표시 | "완료 n / 전체 m" + 영역별 + 오늘 전체 `ProgressBar`(기존) |
| 자동 저장 | 체크 시 즉시 저장(낙관적 UI). 기존 monthly 저장 액션 재사용, **새 저장 로직 만들지 않음** |
| 미완료 처리 | 부담 줄이기 — 미완료는 회색 윤곽선, 빨강 금지. "n개 남았어요" 따뜻한 문구 |
| 코치가 보는 데이터 | `moksilgi_monthly_records.daily_checks_json`(일자별 true/false)에 그대로 누적 → 코치 화면 기존 경로로 조회 |

핵심: **To-do는 새 테이블이 아니라 기존 `daily_checks_json`의 "오늘" 슬라이스**입니다. 홈에서 오늘 분만 보여주고 체크하면 됩니다.

---

## 5. 하루 / 주간 / 월간 기록 기능 제안

### 하루 기록 (daily_records 확장)

| 항목 | 매핑 |
|---|---|
| 오늘 실행한 To-do | `moksilgi_monthly_records.daily_checks_json` (별도 입력 불필요) |
| 오늘 감사 | (추가 제안) `gratitude` |
| 오늘 배운 점 | (추가 제안) `learned` |
| 오늘 어려움 | (추가 제안) `difficulty` |
| 오늘의 기도 제목 | `prayer_request` (기존) |
| 코치에게 나눌 질문 | (추가 제안) `coach_question` |
| 감정 상태 | (추가 제안) `emotion` |
| 돌아봄 / 실천·적용 | `reflection` / `practice` (기존) |

### 주간 기록 (weekly_logs — **이미 존재**)

| 항목 | 매핑 |
|---|---|
| 이번 주 실행률 | monthly_records에서 주차 집계(계산) |
| 가장 꾸준/부족 영역 | 집계(계산) |
| 빠진 날 | daily_checks 집계(계산) |
| 이번 주 감사 | `weekly_logs.gratitude` |
| 진행/돌아봄 | `weekly_logs.progress_summary` |
| 어려움 | `weekly_logs.difficulty` |
| 다음 주 목표 / 코치와 나눌 주제 | `weekly_logs.message_to_coach` (또는 컬럼 추가) |

### 월간 기록 (monthly_reflections / monthly_summaries — **이미 존재**)

| 항목 | 매핑 |
|---|---|
| 이번 달 달성률 / 영역별 | `moksilgi_monthly_summaries.*_rate` |
| 가장 큰 변화 / 성장점 | `monthly_reflections.growth_points` |
| 반복된 어려움 | `monthly_reflections.difficulty` |
| 다음 달 목표 | `monthly_reflections.next_month_plan` |
| 코치 피드백 | `coach_feedback`(확장 필요, 6장) |

> 권장: `/records/weekly` 신규 페이지는 만들지 말고, **기존 `report/weekly` + `weekly-log`** 를 정리해 주간 화면으로 통일.

---

## 6. DB 개선안

### 6.1 기존 테이블 활용 (신규 불필요)

| 사용자 제안 | 실제 존재 테이블 | 비고 |
|---|---|---|
| `coaching_goals` | `goals`(0021) + `moksilgi_*`(0022) | 두 시스템 통합 정책 필요 |
| `daily_todos` | `moksilgi_monthly_records.daily_checks_json`(0023) | 별도 테이블 불필요 |
| `daily_records` | `daily_records`(0026) | 컬럼만 보강 |
| `weekly_reviews` | `weekly_logs`(0019) | 그대로 사용 |
| `monthly_reviews` | `monthly_reflections` + `monthly_summaries`(0023/0026) | 그대로 사용 |
| `coach_feedbacks` | `coach_feedback`(0020) | **weekly 전용 → 확장 필요** |

### 6.2 꼭 필요한 추가 (최소화)

**(1) `coach_feedback` 확장 — 가장 중요.** 현재 `weekly_log_id NOT NULL`이라 **주간 로그에만** 피드백 가능. 하루/월간/목표/To-do 피드백이 불가하고 **읽음 표시 컬럼이 없음**.
- 제안 A(권장, 비파괴): `weekly_log_id`를 nullable로 + `target_type`(`weekly_log|daily_record|monthly_reflection|goal`) + `target_id` + `read_by_coachee_at timestamptz` 추가.
- 제안 B: 기존 테이블 유지 + 신규 `coach_feedback_targets` 분리. → 복잡, 비권장.

**(2) `goal_change_requests` 신규(소형) — 수정요청→승인→이력.**
```
goal_change_requests
- id, coachee_profile_id, coach_profile_id, relationship_id
- goal_ref_type (moksilgi_plan | goal), goal_ref_id
- field, current_value, requested_value, reason
- status (pending | approved | rejected)
- decided_by, decided_at, created_at, updated_at, deleted_at
```

**(3) `daily_records` 컬럼 추가(선택, 모두 nullable).** `gratitude / learned / difficulty / emotion / coach_question`. 기존 데이터·저장 로직 보존.

### 6.3 RLS / 권한 고려

- **읽기:** 모든 신규 코치 조회는 기존 0028 패턴 재사용 — `active relationship + shared_with_coach=true + visibility='coach'`. 신규 컬럼은 같은 정책 안에 포함되므로 충돌 없음.
- **피드백 쓰기:** 기존 weekly `coach_feedback` 패턴(코치만, published) 재사용. `target_type` 확장 시 정책에 OR 분기 추가.
- **읽음 표시:** `read_by_coachee_at`은 **피코치 본인만** UPDATE 가능(소유 = `current_profile_id()`).
- **수정요청:** 피코치 INSERT/본인 SELECT, 코치는 담당 관계만 SELECT/UPDATE(status). enum 값 변경 금지 원칙 준수.
- ⚠️ 위 6.2의 모든 변경은 **새 마이그레이션 = 스키마 변경**입니다. CLAUDE.md §8 규칙에 따라 **사용자 명시 승인 후에만** 진행합니다.

---

## 7. UI 디자인 시스템 제안 (기존 토큰 기반)

- **공통 레이아웃:** 기존 `layout.tsx` 셸 유지 — `max-w-md`, 상단 `CoacheeTopBar`, 하단 고정 5탭, `pb-24` 여백.
- **하단 탭(역할 재정의 권장):** 현재 `오늘 / 체크 / 기록 / 계획 / 성장` → 사용자 흐름에 맞춰 라벨·순서 정렬 제안:

  | 탭 | 라벨 | 경로 |
  |---|---|---|
  | 홈 | 오늘 | `/my-coaching` |
  | 목표 | 목표 | `/my-coaching/goals` |
  | 실행 | 체크 | `/my-coaching/moksilgi/monthly` |
  | 기록 | 기록 | `/my-coaching/records/daily` |
  | 리포트 | 리포트 | `/my-coaching/moksilgi/monthly`(요약 뷰) 또는 `moksilgi/summary` |

  (탭 자체는 `CoacheeBottomTabs.tsx` 1파일 수정으로 가능 — presentational, 권한 로직 없음)

- **색상 체계(기존 유지, 사용자 제안과 거의 일치):**

  | 영역 | 현재 클래스 | 사용자 제안 | 비고 |
  |---|---|---|---|
  | 지적 | `sky-500` | Blue | 일치 |
  | 신체 | `brand-600` | Green | **불일치** — 통일 결정 필요 |
  | 영적 | `violet-500` | Purple | 일치 |
  | 사회 | `amber-500` | Orange | 일치 |
  | 기타 | `slate-400` | — | 유지 |

- **카드/버튼/폼:** 기존 `Card/CardHeader/CardContent`, `Badge`, `Button/ButtonLink`, `ProgressBar` 재사용. 신규는 presentational만 추가.
- **반응형 기준:** 모바일 1열 기본, `sm:` 이상에서 2열(`grid-cols-1 sm:grid-cols-2`) — 기존 패턴 유지.
- **톤:** 따뜻한 한국어 문구, 미완료는 비난조 금지(기존 amber 안내 패턴 유지).

### 권장 신규 컴포넌트 (모두 presentational, `components/coachee/`)
`TodayProgressCard` · `FourAreasSummary` · `TodayTodoList` · `GoalCard` · `TodoCheckItem` · `DailyRecordForm` · `ReflectionQuestionCard` · `CoachFeedbackCard` · `WeeklySummaryCard` · `MonthlyCalendarProgress` · `MonthlyAreaProgress`
(기존 `CoacheePageHeader`=`CoacheeTopBar`, `CoacheeBottomNav`=`CoacheeBottomTabs` 이미 존재)

---

## 8. 구현 우선순위 (CLAUDE.md 준수 — 단계별 승인, 1~4파일)

> 모든 단계 공통 주의: LOCK 흐름(weekly_logs 저장, invitation, auth/role/profile, 기존 weekly log save) **수정 금지**, DB enum 유지, `any`/`@ts-ignore` 금지. 검증은 매 단계 `npm run typecheck → check:all → build`.

| 단계 | 내용 | 예상 수정 파일(1~4) | 주의 | 테스트 |
|---|---|---|---|---|
| **1. UI 구조 정리** | 하단 탭 라벨/순서 정렬, 공통 카드 컴포넌트 추출 | `CoacheeBottomTabs.tsx`, (신규)`components/coachee/TodayProgressCard.tsx`, `FourAreasSummary.tsx` | DB·권한·쿼리 의미 변경 금지(§15) | 각 탭 활성표시, 빌드 |
| **2. 오늘 To-do 체크** | 홈에 오늘 슬라이스 인라인 체크 | `my-coaching/page.tsx`, (신규)`TodayTodoList.tsx`/`TodoCheckItem.tsx` | 저장은 **기존 monthly 액션 재사용**, 새 저장 로직 금지 | 체크→`daily_checks_json` 반영, 실행률 갱신 |
| **3. 하루 기록 UX** | 단계형 카드 입력, (선택)필드 추가 | `DailyRecordsClient.tsx`, `records/daily/page.tsx`, `api/.../daily/route.ts` | 필드 추가 시 DB 변경 → **선승인**. 공유 토글 로직 유지 | 저장/수정/공유, 빈값 처리 |
| **4. 주간/월간 리포트** | monthly 캘린더·영역 바, 주간 화면 통일 | `moksilgi/monthly/page.tsx`, (신규)`MonthlyCalendarProgress.tsx`, `MonthlyAreaProgress.tsx` | 달성률 계산 의미 변경 금지(읽기 위주) | 집계 정확도, 빈 달 |
| **5. 코치 피드백 연동** | `coach_feedback` 확장 + 읽음 표시 | 마이그레이션(신규), `feedback.ts`, `CoachFeedbackCard.tsx` | **DB+RLS 변경 → 선승인 필수**. weekly 피드백 흐름 보존 | 피드백 표시, 읽음 토글, RLS 격리 |
| **6. 목표 수정/승인** | `goal_change_requests` + 승인 흐름 | 마이그레이션(신규), `goals.ts`/신규 액션, `goals/page.tsx`, `GoalEditRequestButton.tsx` | **DB+RLS 변경 → 선승인 필수**. 목표 SSoT 결정 후 진행 | 요청→승인→이력, 권한 격리 |

---

## 9. 매일 사용 흐름(최종 목표)

```
아침  →  홈에서 오늘 목표 + To-do 확인
낮    →  실행하며 홈/체크에서 즉시 체크
저녁  →  하루 기록(감사/배운점/기도/코치질문) 작성
주말  →  주간 실행률 확인 → 다음 주 목표 정리
월말  →  월간 리포트 + 코치 피드백 확인 → 다음 달 목표 조정
```
이 전체가 **`/my-coaching` 홈을 중심**으로 연결됩니다.

---

## 10. 즉시 결정이 필요한 3가지 (구현 전)

1. **목표 SSoT:** `moksilgi_plans` vs `goals` 테이블 중 단일 출처? (3-B, 6.1)
2. **신체 영역 색상:** 기존 `brand-600` 유지 vs Green 통일? (7장)
3. **DB 확장 승인 범위:** 5·6단계의 `coach_feedback` 확장 / `goal_change_requests` / `daily_records` 컬럼 추가 — 어디까지 승인할지.
