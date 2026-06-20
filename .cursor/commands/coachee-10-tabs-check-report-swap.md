# /coachee-10-tabs-check-report-swap — 코치이 하단탭 "체크/리포트" 연결 변경

You are working on the GOThriveCoaching platform (Next.js App Router + TypeScript + Tailwind + Supabase).

## Before starting
- Read `AI_WORKFLOW.md` and `CLAUDE.md` first.
- Do NOT modify locked flows: auth / role / profile / invitation acceptance RPC / weekly log save logic.
- Work on ONE feature only. Keep changes within 1 file.
- 이 작업은 **하단 내비게이션 탭의 연결 경로(href)와 활성 매칭만** 바꾼다. 라우팅/권한/데이터 로직은 건드리지 않는다.

## 목적 / 배경
- 코치이가 **매일 자신의 목표 실행을 체크**하고 싶어한다. 실제 일별 실행 체크(일별 체크 달력, `day_1…31`)는 `/my-coaching/moksilgi/monthly`에서 이뤄진다.
- 그래서 하단탭 **"체크"가 일별 체크 페이지(monthly)로** 바로 가도록 하고, **"리포트"는 목실기 기획안 페이지(`/my-coaching/moksilgi`)로** 연결한다.

## Task (한 줄)
`src/components/navigation/CoacheeBottomTabs.tsx`에서 "체크"와 "리포트" 탭의 연결 경로를 서로 바꾼다.
- 체크: `/my-coaching/moksilgi` → **`/my-coaching/moksilgi/monthly`**
- 리포트: `/my-coaching/moksilgi/monthly` → **`/my-coaching/moksilgi`**

## Files to update (allowed scope)
- `src/components/navigation/CoacheeBottomTabs.tsx` — `tabs` 배열의 두 항목 `href`/`match`만 수정

> 다른 파일 수정이 필요해지면 멈추고 보고할 것. (현재 이 탭 경로에 의존하는 테스트/다른 파일은 없음)

## 정확한 변경 내용
1. `key: "check"`(체크) 탭: `href: "/my-coaching/moksilgi/monthly"`. `match`는 `"prefix"` 유지(또는 `"exact"` 가능).
2. `key: "report"`(리포트) 탭: `href: "/my-coaching/moksilgi"`, **`match: "exact"`로 변경**.
   - 이유: 리포트를 `"prefix"`로 두면 `/my-coaching/moksilgi/monthly`에서 체크·리포트가 **동시에 활성**된다. `"exact"`로 두면 `/moksilgi`에서만 리포트가 활성되고, `/moksilgi/monthly`에서는 체크만 활성된다.
3. 탭 **라벨("체크"/"리포트")·아이콘(`IconCheck`/`IconReport`)·키(`check`/`report`)·순서·스타일은 그대로 둔다.** (경로/매칭만 변경)

## 절대 변경 금지
- 다른 탭(`today`/`record`/`growth`)의 `href`/`label`/`match`/`icon`/순서
- `isActive` 함수의 동작 의미(`exact`/`prefix` 규칙 자체), `CoacheeBottomTabs`의 마크업/스타일/`aria` 처리
- 라우팅/미들웨어/권한/데이터, 대상 페이지(`/my-coaching/moksilgi`, `.../monthly`)의 내용·로직
- DB enum, i18n 라벨 구조(여기 탭 라벨은 인라인 문자열이므로 문구 변경 금지), `package.json`

## 참고 (선택 — 이번 범위 아님)
- "리포트" 탭이 이제 기획안(목표·실행전략) 페이지를 가리키므로, 라벨 의미가 약간 어긋날 수 있다. 라벨을 "기획"/"계획" 등으로 바꾸고 싶다면 **별도 요청**으로 진행한다(이번 명령에서는 라벨 변경하지 않음).

## Requirements
1. 변경 최소화(경로/매칭 2줄 수준), 작동 중인 코드 리팩터링 금지.
2. `any` 금지, `@ts-ignore` 금지, 기존 타입(`CoacheeTab`) 그대로.

## Verification (필수)
```bash
npm run typecheck
npm run check:all
npm run build
```
추가 수동 확인:
- `/my-coaching/moksilgi/monthly` 진입 시 하단 "체크"만 활성(리포트 비활성), "체크" 탭으로 진입 가능
- `/my-coaching/moksilgi` 진입 시 하단 "리포트"만 활성(체크 비활성)
- 일별 체크 달력에서 오늘 날짜 체크 → 저장(`?saved=1`) 정상(기존 동작 유지)
- 나머지 탭(오늘/기록/성장) 경로·활성 정상

## Return
- 변경한 파일과 변경 줄(체크/리포트 href·match)
- 활성 상태(중복 강조) 검증 결과
- 검증 결과(typecheck / check:all / build)
