# C1 — CSP `unsafe-inline` 조사 (CRITICAL_REVIEW)

**상태:** 조사 완료 — **제거 작업 보류** (nonce/ hash 전략 합의 전)  
**날짜:** 2026-06  
**관련 파일:** `middleware.ts` (CSP 헤더), `next.config.ts`

---

## 현재 CSP (middleware.ts)

```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self' https://<supabase-host> wss://<supabase-host>
frame-ancestors 'none'
form-action 'self'
object-src 'none'
base-uri 'self'
```

---

## `unsafe-inline`이 필요한 이유 (Next.js 16)

| 영역 | 현재 사용 | 제거 시 리스크 |
|------|-----------|----------------|
| **script-src** | Next.js hydration·RSC가 런타임 inline script 주입 | `'unsafe-inline'` 제거만으로 **프로덕션 UI 깨짐** 가능 |
| **style-src** | React `style={{ ... }}` (ProgressBar, 목실기 차트 등 6+ 컴포넌트) | `unsafe-inline` 제거 시 **inline style 차단** |

### 앱 코드 조사 결과

- `dangerouslySetInnerHTML` — **없음**
- `next/script` 커스텀 Script — **없음**
- inline `style={{}}` — **있음** (ProgressBar, MoksilgiSection, monthly summary, Leaflet genealogy 등)

→ **script-src**는 Next.js 프레임워크 의존. **style-src**는 앱 inline style 의존.

---

## 제거 시 권장 경로 (미적용)

1. **script-src:** Next.js [Content Security Policy](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy) 가이드대로 **nonce** 기반 CSP + `middleware`에서 request별 nonce 생성
2. **style-src:** inline style를 Tailwind class로 점진 이전 **또는** `'unsafe-inline'` 유지 + script만 강화
3. staging에서 CSP Report-Only 헤더로 위반 로그 수집 후 제거

---

## C3 참고 (obsolete)

`check/page.tsx`는 `/my-coaching/moksilgi/monthly` redirect만 수행 — **service_role 교체(C3) 해당 없음**.

---

## C7 참고 (read 경로 이미 호환)

- **저장:** `moksilgi-monthly` monthly form → day number key (`"1"`…`"31"`)
- **오늘 체크 병합:** `mergeDailyCheckStateForToday` → ISO date key + day key **둘 다** 기록
- **읽기:** `isGoalCheckedForToday`, `collectCheckedDays` → **양쪽 키 모두** 인식

→ 키 형식 **통일(쓰기 단일화)** 는 migration/데이터 backfill 필요 — 별도 승인·작업.

---

## 다음 단계 (승인 필요)

| 순서 | 작업 | 상태 |
|------|------|------|
| 1 | B1 **0043** staging SQL Editor 적용 ([b1-0043-staging-runbook.md](./b1-0043-staging-runbook.md)) | 수동 |
| 2 | C1 CSP **Report-Only** pilot | ✅ 코드 반영 (아래 참고) |
| 3 | C2 `as any` — DB 타입 재생성 + LOCK 파일 최소 수정 | 대기 |
| 4 | C7 쓰기 경로 단일화 — backfill 계획 수립 | 대기 |

**C1 script `unsafe-inline` 즉시 제거는 권장하지 않음.**

---

## Report-Only pilot (staging)

**Enforcing CSP** (`Content-Security-Policy`) — 변경 없음 (`unsafe-inline` 유지).

**Report-Only CSP** (`Content-Security-Policy-Report-Only`) — `CSP_REPORT_ONLY=1` 일 때만 추가:

- `script-src 'self'` (no `unsafe-inline`) — 위반 관측용
- `style-src 'self'` (no `unsafe-inline`)
- `report-uri /api/csp-report` → `POST /api/csp-report` (Vercel/staging 로그 `[CSP_REPORT]`)
  - middleware/route 모두 `CSP_REPORT_ONLY=1|true`이고 `VERCEL_ENV != production`일 때만 활성
  - 비활성 환경에서는 route가 `404` no-log
  - body 10KB 초과는 `413`
  - 로그는 allowlist 필드만 기록하며 URL 필드는 query/hash 제거

### staging 활성화

Vercel **staging** 프로젝트 → Environment Variables:

```
CSP_REPORT_ONLY=1
```

재배포 후 주요 페이지 탐색 → **Logs**에서 `[CSP_REPORT]` 검색.

### prod

`CSP_REPORT_ONLY` **설정하지 않음**. 실수로 설정되어도 `VERCEL_ENV=production`이면 Report-Only 헤더 미전송, `/api/csp-report` no-log `404`.
