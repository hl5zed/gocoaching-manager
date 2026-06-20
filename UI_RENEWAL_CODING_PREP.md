# UI 리뉴얼 코딩 준비 문서

> 기준 문서: `GOThriveCoaching_UI리뉴얼_작업기획서.docx`  
> 작성일: 2026-06-20  
> 원칙: 기능 100% 유지 · UI 레이어만 교체 · 1~4파일/작업 단위

---

## 1. 현재 상태 진단 (코드베이스 실측)

### 1.1 이미 갖춰진 것

| 항목 | 파일 | 상태 |
|------|------|------|
| UI 리뉴얼 디자인 토큰 | `src/styles/globals.css` | 존재 (`--brand-*`, `--surface-*`, `--ink-*` 등) |
| Tailwind 토큰 매핑 | `tailwind.config.ts` | brand / surface / ink / line / shadow / radius 매핑 완료 |
| 셸 레이아웃 | `src/components/layout/ShellLayout.tsx` | 존재, 현재 **다크 사이드바** (`bg-surface-sidebar = #102a23`) |
| 사이드바 내비게이션 | `src/components/layout/SidebarNav.tsx` | 존재, 다크 테마 클래스 사용 |
| 페이지 헤더 | `src/components/layout/PageHeader.tsx` | 존재 |
| 공용 UI | `src/components/ui/` | Button, Card, Badge, Input, ProgressBar, Icon |
| 라벨/i18n | `src/lib/ui/labels.ts` | 존재 |
| 프로토타입 | `gothrive_redesign_prototype.html` | **목표 디자인 기준** |

### 1.2 격차 (수정 필요)

| 문제 | 현황 |
|------|------|
| **Button 하드코딩** | `teal-700`, `slate-300`, `slate-700` 직접 사용 → 토큰 미경유 |
| **Card 하드코딩** | `slate-200`, `slate-100`, `slate-950`, `teal-700` 직접 사용 |
| **Badge 하드코딩** | `slate-200`, `slate-100`, `slate-700` 직접 사용 |
| **Input 하드코딩** | `teal-700`, `slate-300`, `slate-950`, `slate-400` 직접 사용 |
| **사이드바 색상** | 현재 다크(`#102a23`) → 목표는 **라이트 사이드바** (흰색 배경 + navy active) |
| **토큰 값 불일치** | globals.css의 `--surface-sidebar`가 다크 (#102a23) → 모던 라이트 기준으로 변경 필요 |
| **도메인 4색 미정의** | 지성/신체/영성/사회 색상 토큰이 globals.css에 없음 |
| **navy 토큰 없음** | `#1D2B4F` navy 계열 토큰 미정의 |

---

## 2. 목표 디자인 시스템 (기획서 기준)

### 2.1 변경할 토큰 값

```css
/* globals.css 에서 변경/추가할 항목 */

/* 사이드바: 다크 → 라이트로 전환 */
--surface-sidebar: #FFFFFF;          /* 현재: #102a23 */
--surface-sidebar-hover: #F4F6FA;    /* 현재: #1a3a31 */

/* surface 앱 배경 */
--surface-app: #F4F6FA;              /* 현재: #f6f8f7 */
--surface-sunken: #EEF1F6;           /* 현재: #eef2f0 */

/* ink 텍스트 */
--ink-strong: #1A2236;               /* 현재: #0f1f1a */
--ink-base: #1A2236;                 /* 현재: #17231f */
--ink-muted: #5B6478;                /* 현재: #64746d */
--ink-faint: #8B93A7;                /* 현재: #93a09a */

/* 사이드바 텍스트 (라이트로 바뀌면 dark 토큰 방향 역전) */
--ink-on-dark: #1A2236;              /* 현재: #e6efeb (라이트 사이드바에선 다크 텍스트) */
--ink-on-dark-muted: #5B6478;        /* 현재: #9db4ab */

/* Navy (새 1차 브랜드색) */
--navy-900: #1D2B4F;
--navy-800: #243460;
--navy-700: #2B3D72;

/* 도메인 4색 (새로 추가) */
--domain-intellect: #3A4EA8;    /* 지성 */
--domain-body: #E0612F;         /* 신체 */
--domain-spirit: #6A5AE0;       /* 영성 */
--domain-social: #C08A2A;       /* 사회 */

/* 상태색 (새로 추가) */
--status-done-bg: #ECFDF5;
--status-done-text: #065F46;
--status-upcoming-bg: #EFF6FF;
--status-upcoming-text: #1E40AF;
--status-wait-bg: #FFFBEB;
--status-wait-text: #92400E;
--status-cancel-bg: #FFF1F2;
--status-cancel-text: #9F1239;

/* 라운드 상향 */
--radius-card: 0.875rem;         /* 현재: 0.75rem → 14px */
--radius-control: 0.625rem;      /* 현재: 0.5rem → 10px */

/* 그림자 3단계 */
--shadow-card: 0 1px 3px rgb(26 34 54 / 0.06), 0 1px 2px rgb(26 34 54 / 0.04);
--shadow-raised: 0 4px 12px rgb(26 34 54 / 0.10);
--shadow-overlay: 0 12px 32px rgb(26 34 54 / 0.18);
```

### 2.2 Tailwind config 추가 항목

```ts
// tailwind.config.ts에 추가할 항목
colors: {
  navy: {
    700: "var(--navy-700)",
    800: "var(--navy-800)",
    900: "var(--navy-900)",
  },
  domain: {
    intellect: "var(--domain-intellect)",
    body: "var(--domain-body)",
    spirit: "var(--domain-spirit)",
    social: "var(--domain-social)",
  },
  status: {
    "done-bg": "var(--status-done-bg)",
    "done-text": "var(--status-done-text)",
    // ... 나머지
  },
}
```

---

## 3. 단계별 작업 순서 (P0 → P5)

### P0 — 기반·안전장치 (선행 필수)

| 작업 단위 | 수정 파일 | 내용 |
|----------|-----------|------|
| P0-1 | `src/styles/globals.css` | 토큰 값 모던 라이트 기준으로 확정 |
| P0-2 | `tailwind.config.ts` | navy / domain / status 토큰 추가 |

> **P0 완료 후 반드시:** `npm run typecheck && npm run build` → 사이드바가 라이트로 바뀐 것 육안 확인

---

### P1 — 공용 컴포넌트 토큰화

| 작업 단위 | 수정 파일(1~4개) | 교체 내용 |
|----------|----------------|-----------|
| P1-1 | `src/components/ui/Button.tsx` | `teal-700` → `brand-600`, `slate-*` → `ink-*`/`line-*` |
| P1-2 | `src/components/ui/Card.tsx` | `slate-*` → `surface-*`/`ink-*`/`line-*` |
| P1-3 | `src/components/ui/Badge.tsx` | `slate-*` → 토큰 클래스 |
| P1-4 | `src/components/ui/Input.tsx` | `teal-700` → `brand-600`, `slate-*` → 토큰 |
| P1-5 | `src/components/ui/ProgressBar.tsx` | 하드코딩 확인 후 토큰화 |

---

### P2 — 셸·네비게이션

| 작업 단위 | 수정 파일(1~4개) | 내용 |
|----------|----------------|------|
| P2-1 | `src/components/layout/ShellLayout.tsx` | 라이트 사이드바 레이아웃, 모바일 드로어 정리 |
| P2-2 | `src/components/layout/SidebarNav.tsx` | active 항목 navy, 텍스트 ink-base로 변경 |
| P2-3 | `src/components/layout/PageHeader.tsx` | 필요 시 토큰 정렬 |

---

### P3 — 코치이 my-coaching (14페이지)

아래 순서로 1~2페이지씩 진행. 각 단위는 독립 빌드 가능해야 함.

| 순서 | 라우트 | 리스킨 대상 | LOCK 보호 |
|------|--------|------------|-----------|
| 1 | `/my-coaching` | 대시보드 카드·KPI | 권한 가드 |
| 2 | `/my-coaching/goals` | 목표 카드/배지 | 목표 저장 |
| 3 | `/my-coaching/weekly-log` | 주간 기록 폼 레이아웃 | weekly_logs 저장 |
| 4 | `/my-coaching/records` | 리스트/필터 레이아웃 | records API |
| 5 | `/my-coaching/records/daily` | 폼 레이아웃 | daily save RPC |
| 6 | `/my-coaching/records/monthly` | 폼 레이아웃 | monthly save |
| 7 | `/my-coaching/check` | 일일 점검 UI | 기록 저장 |
| 8 | `/my-coaching/moksilgi` | 카드/진행률 | 데이터 fetch |
| 9 | `/my-coaching/moksilgi/monthly` | 표/카드 | 데이터 fetch |
| 10 | `/my-coaching/moksilgi/summary` | 요약 카드 | 집계 로직 |
| 11 | `/my-coaching/feedback` | 피드백 뷰 | 조회 권한 |
| 12 | `/my-coaching/report/weekly` | 리포트 레이아웃 | print/집계 |
| 13 | `/my-coaching/report/monthly` | 리포트 레이아웃 | print/집계 |
| 14 | `/my-coaching/spiritual-companion` | 카드 UI | 데이터 fetch |

---

### P4 — 관리자·코치메이커 (16페이지)

**admin (12):**

| 라우트 | LOCK 보호 |
|--------|-----------|
| `/admin` | role 가드 |
| `/admin/users` | users list 쿼리, 검색/필터/정렬/페이지네이션 |
| `/admin/invitations` | invitation creation |
| `/admin/invitations/new` | invitation 발송 |
| `/admin/invitations/[id]` | 초대 상태 RPC |
| `/admin/coaching-genealogy` | 관계 데이터 |
| `/admin/coaching-relationships/new` | 관계 생성 |
| `/admin/settings` | 설정 저장 |
| `/admin/settings/affiliations` | CRUD API |
| `/admin/settings/countries` | CRUD API |
| `/admin/settings/generations` | CRUD API |
| `/admin/settings/organizations` | CRUD API |

**coach-maker (4):**

| 라우트 | LOCK 보호 |
|--------|-----------|
| `/coach-maker` | action notes, moksilgi, CSV, print 전체 |
| `/coach-maker/moksilgi-progress` | 목실기 현황 |
| `/coach-maker/moksilgi-progress/[planId]` | 상세 |
| `/coach-maker/report` | 보고서/PDF |

---

### P5 — 코치·로그인·기타 (9 + 공통)

**coach (9):**

| 라우트 | LOCK 보호 |
|--------|-----------|
| `/coach` | 대시보드 통계 |
| `/coach/goals` | 데이터 fetch |
| `/coach/moksilgi` | 데이터 fetch |
| `/coach/moksilgi/[planId]` | 데이터 fetch |
| `/coach/relationships` | coach relationships |
| `/coach/relationships/[id]` | coaching relationships |
| `/coach/weekly-logs` | weekly_logs 조회 |
| `/coach/weekly-logs/[id]` | weekly log 조회 |
| `/coach/weekly-logs/[id]/feedback` | 피드백 저장 |

**공통·기타:**

| 라우트 | LOCK 보호 |
|--------|-----------|
| `/login` | auth logic |
| `/dashboard` | role 라우팅 |
| `/profile` | profile 조회 |
| `/profile/edit` | profile 저장 |
| `/coachee` | role 가드 |
| `/coachee/report` | 집계 |
| `/invitations/accept` | acceptance RPC |
| `/unauthorized` | — |

**제외:** `/debug/*` — 리스킨 대상 아님

---

## 4. 작업 단위 표준 보고 템플릿

각 작업 시작 전 아래 형식으로 보고 후 승인받아야 한다:

```
- 작업 목표: <한 줄>
- 수정 예정 파일:
  - <파일 1>
  - <파일 2>  (최대 4개)
- 건드리지 않을 LOCK 흐름:
  - <흐름 1>
- 검증 명령어:
  - npm run typecheck
  - npm run check:all
  - npm run build
```

---

## 5. 절대 수정 금지 영역 (전 페이즈 공통)

- invitation creation / email / acceptance RPC
- profile creation · role assignment
- auth · session · 권한 판정 로직
- weekly_logs 저장 · daily/monthly 기록 저장
- DB schema · RLS · migration · API route 의미
- DB enum 저장 값 (super_admin, coach, coachee, active 등)
- 기존 컴포넌트의 public props 시그니처
- package.json

**중단 트리거:** 위 중 하나라도 필요하면 즉시 멈추고 보고.

---

## 6. 허용 범위 (전 페이즈 공통)

- UI 레이아웃 · className 교체
- 신규 presentational 컴포넌트 생성
- 기존 데이터 표시 방식 개선 (같은 데이터, 다른 마크업)
- props를 유지하는 optional prop 추가
- aria-label 접근성 추가
- 모바일 반응형 className 추가

---

## 7. 검증 체크리스트 (매 작업 단위 후)

| 항목 | 통과 기준 |
|------|-----------|
| `npm run typecheck` | 타입 에러 0 (`any` · `@ts-ignore` 미사용) |
| `npm run check:all` | 규칙 검사 통과 |
| `npm run build` | 프로덕션 빌드 성공 |
| 기능 동일성 | 버튼·폼·링크 동작이 리스킨 전과 동일 |
| 반응형 | 데스크톱/모바일 레이아웃 정상 |
| i18n | 한국어 라벨 정상, enum 저장값 불변 |

---

## 8. 시작 순서 권장

1. **P0-1 먼저** (`globals.css` 토큰 값 확정) → 빌드 확인
2. **P0-2** (`tailwind.config.ts` navy/domain 추가) → 빌드 확인
3. **P1-1** (`Button.tsx` 토큰화) → 가장 파급 효과 큼
4. **P2-1/2** (ShellLayout + SidebarNav 라이트 전환) → 전 역할 셸 일괄 적용
5. P3 → P4 → P5 순으로 페이지 진행

> P0~P2를 완료하면 전체 색상 방향이 잡히고, P3~P5는 컴포넌트 재사용으로 수정량이 크게 줄어든다.
