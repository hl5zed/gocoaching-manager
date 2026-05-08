# AI_WORKFLOW

## 목적

이 문서는 GOThriveCoaching 프로젝트에서 Claude, Codex, Cursor, ChatGPT, Gemini를 함께 사용할 때  
작업 속도, 안정성, 비용 효율을 유지하기 위한 **운영 가이드**입니다.

핵심 원칙:

> **AI를 많이 쓰는 것이 아니라, AI를 역할별로 통제하는 것이 핵심이다.**


---

## 1. 기본 원칙

- 한 번에 하나의 기능만 진행한다.
- 이미 동작하는 모듈은 함부로 다시 생성하지 않는다.
- DB, 권한, 초대, 역할 부여 로직은 특히 보수적으로 다룬다.
- AI에게 “전체를 다시 만들어 달라”는 요청을 하지 않는다.
- 문제가 생기면 **에러 메시지 기준으로 최소 수정**한다.
- 한 기능이 안정화되면 LOCK 상태로 간주하고 다음 기능으로 넘어간다.


---

## 2. AI 역할 분담

### ChatGPT
- 기획
- 작업 단위 분해
- 우선순위 정리
- 명령어/프롬프트 초안 작성
- 다음 작업 제안

### Claude
- 새 기능 생성
- UI/페이지/폼/초기 구조 작성
- 새로운 읽기/쓰기 흐름 초안 구현

### Codex
- 오류 수정
- 타입 에러 해결
- 빌드 실패 해결
- 기존 기능 안정화
- 작은 범위 리팩터링

### Cursor
- 작업 환경
- 빠른 코드 탐색
- 파일 비교
- 로컬 코드 검토
- 수동 편집 보조

### Gemini
- 필요할 때만 보조
- 아이디어 비교
- 문장 대안
- 보조 분석

권장 운영:
- **새 기능 생성은 Claude**
- **오류 수정과 안정화는 Codex**
- **작업 설계는 ChatGPT**
- **탐색과 사람 편집은 Cursor**
- **Gemini는 보조용**


---

## 3. 현재 LOCK 대상 모듈

아래 항목은 현재 프로젝트의 핵심 동작 흐름이므로, 특별한 이유가 없으면 수정하지 않는다.

### 초대/인증 흐름
- invitation creation
- invitation email sending
- invitation acceptance RPC
- profile creation
- role assignment

### 대시보드/관리자 흐름
- dashboard role links
- admin users list

### 코칭 관계 흐름
- coaching relationships table
- coach relationships
- my-coaching

### 주간 기록 흐름
- weekly_logs table
- weekly log creation
- coach weekly logs list page
- /coach/weekly-logs
- coach home to weekly logs navigation
- 코치용 주간 기록 목록 조회
- 코치 홈 → 주간 기록 보기 연결
- coach feedback writing for weekly logs
- /coach/weekly-logs/[id]/feedback
- coach feedback draft save
- coach feedback publish
- 코치 주간 기록 피드백 작성 기능
- 코치 피드백 임시 저장
- 코치 피드백 게시
- coachee feedback read-only view
- /my-coaching/feedback
- coachee received feedback view
- 코치이 받은 피드백 보기 기능
- 코치이 피드백 읽기 전용 페이지
- coachee goals management v1
- /my-coaching/goals
- coachee goal create
- coachee goal list
- coachee goal status update
- 코치이 목표 관리 1차 기능
- 코치이 목표 작성
- 코치이 목표 목록
- 코치이 목표 상태 변경

### UI/라벨 구조
- Korean-first UI
- i18n label structure

원칙:
- 위 항목은 **작동 중인 기준 흐름**이다.
- 새 기능이 이 영역과 충돌하면 먼저 설계를 다시 확인한다.
- LOCK 대상은 “전면 재작성” 금지, “최소 수정”만 허용한다.


---

## 4. Single Source of Truth

이 프로젝트에서 출처가 분명해야 하는 핵심 파일들:

### DB schema
- `supabase/migrations`

### Type source
- `src/types/database.ts`

### RPC types
- `src/types/rpc.ts`

### Route access
- `src/lib/auth/route-access.ts`

### UI labels / i18n
- `src/lib/ui/labels.ts`

규칙:
- 스키마는 migration을 기준으로 본다.
- 타입은 `src/types/database.ts`를 기준으로 본다.
- 라우트 접근 규칙은 `src/lib/auth/route-access.ts`를 기준으로 본다.
- 표시용 라벨은 `src/lib/ui/labels.ts`를 기준으로 본다.
- AI가 임의로 새로운 truth source를 만들지 않도록 한다.


---

## 5. 개발 흐름

프로젝트의 표준 AI 개발 흐름:

### [1] 설계
- ChatGPT로 작업 단위를 쪼갠다.
- 영향을 받는 파일만 좁힌다.
- LOCK 대상과 충돌하는지 먼저 확인한다.

### [2] 기능 생성
- Claude에게 **작은 범위**로 기능 생성을 맡긴다.
- 페이지 1개, helper 1개, API 1개 정도의 단위가 적당하다.

### [3] 코드 통합
- Cursor 또는 사람이 diff를 확인한다.
- 파일 범위가 설계와 맞는지 본다.
- 불필요한 광범위 수정이 없는지 본다.

### [4] 오류 수정
- Codex로 타입 에러, 빌드 에러, 런타임 오류를 최소 수정한다.
- 에러 메시지 기준으로 해결한다.

### [5] 테스트
- `npm run typecheck`
- `npm run check:all`
- `npm run build`
- 브라우저 수동 테스트

### [6] LOCK
- 기능이 안정화되면 해당 흐름을 LOCK으로 간주한다.
- 다음 기능부터는 이 영역을 함부로 다시 쓰지 않는다.

### [7] 다음 기능
- 다음 기능은 기존 LOCK 흐름을 최대한 재사용하는 방향으로 진행한다.


---

## 6. 비용 절약 규칙

- 전체 프로젝트 재생성을 요청하지 않는다.
- 수정 파일 범위를 명확히 제한한다.
- 에러 메시지를 그대로 주고 그 문제만 고치게 한다.
- LOCK 모듈은 건드리지 않게 명시한다.
- 한 번에 하나의 모듈만 작업한다.
- 이미 동작하는 모듈을 여러 AI에게 반복해서 다시 쓰게 하지 않는다.
- 같은 기능을 Claude, Codex, Gemini에게 동시에 재작성 요청하지 않는다.
- “작은 기능 생성 → 최소 수정 → 검증” 순서를 지킨다.

좋은 예:
- “`src/app/my-coaching/weekly-log/page.tsx`와 `src/lib/api/my-coaching/weekly-log.ts`만 수정”

좋지 않은 예:
- “이 프로젝트 전체를 정리해서 다시 만들어줘”


---

## 7. Claude 프롬프트 템플릿

아래 템플릿을 새 기능 생성용 기본값으로 사용한다.

```md
You are working on the GOThriveCoaching platform.

Task:
<구체적인 작업 한 줄>

Files to create or update:
- <파일 1>
- <파일 2>

Do not modify:
- invitation acceptance RPC
- invitation creation logic
- auth/role security rules
- locked modules unless directly necessary

Requirements:
1. Keep the change minimal.
2. Preserve existing business logic.
3. Use existing shared types from src/types/database.ts.
4. Do not add any.
5. Do not add @ts-ignore.
6. Do not expose raw DB rows, tokens, token_hash, auth metadata.

Verification:
Run:
- npm run typecheck
- npm run check:all
- npm run build

Return:
- files changed
- exact behavior added
- anything intentionally not changed
```


---

## 8. Codex 프롬프트 템플릿

아래 템플릿을 오류 수정/안정화용 기본값으로 사용한다.

```md
You are working on the GOThriveCoaching platform.

Issue:
<실제 에러 메시지 또는 잘못된 동작>

Task:
Fix only this issue with the smallest safe change.

Files to inspect:
- <파일 1>
- <파일 2>

Do not modify:
- SQL migrations
- invitation acceptance RPC
- auth/role rules unless directly required
- locked modules unless directly necessary

Requirements:
1. Root-cause the error.
2. Fix only the unsafe or broken part.
3. Preserve business logic.
4. Do not add any.
5. Do not add @ts-ignore.

Verification:
Run:
- npm run typecheck
- npm run check:all
- npm run build

Return:
- root cause
- exact fix
- files changed
- verification result
```


---

## 9. 검증 체크리스트

기능 작업 후 기본 검증 순서:

### 자동 검증
- `npm run typecheck`
- `npm run check:all`
- `npm run build`

### 수동 브라우저 테스트
- 해당 페이지 열기
- 로그인/권한 흐름 확인
- 버튼/링크 동작 확인
- 폼 제출 확인
- 에러 문구 확인
- 브라우저 콘솔 확인

### Supabase SQL 검증
DB row 생성/변경이 있는 경우:
- SQL Editor에서 row 확인
- 필요한 index/constraint 확인
- nullable/ownership 조건 확인


---

## 10. DB 안전 수칙

- 스키마는 **명시적으로 필요할 때만** 변경한다.
- destructive command를 실행하지 않는다.
- `supabase db reset`은 **사람의 명시적 승인 없이는 절대 사용하지 않는다**.
- migration 파일은 사람이 직접 Supabase SQL Editor에서 적용하고 검증한다.
- 부분 적용된 migration은 재실행 안전성(idempotent)을 반드시 고려한다.


---

## 11. 보안 수칙

- service role key를 절대 노출하지 않는다.
- Resend API key를 절대 노출하지 않는다.
- raw invitation token을 절대 노출하지 않는다.
- `token_hash`를 절대 노출하지 않는다.
- auth metadata를 UI에 보여주지 않는다.
- raw DB row를 그대로 UI에 넘기지 않는다.
- 역할 정보를 쿠키/localStorage/JWT에 임의로 저장하지 않는다.


---

## 12. 앞으로의 추천 로드맵

현재 상태를 기준으로 다음 우선순위를 추천한다.

1. `/coach/weekly-logs`
2. `/coach/weekly-logs/[id]`
3. coach feedback
4. `/my-coaching/goals`
5. coach dashboard metrics
6. admin dashboard metrics

권장 순서 이유:
- 이미 `weekly_logs`와 `my-coaching/weekly-log`가 있으므로
  coach가 읽는 흐름을 먼저 붙이는 것이 자연스럽다.
- 그 다음 피드백 흐름을 붙이면 coach/coachee 루프가 완성된다.
- metrics는 가장 나중에 붙여도 된다.


---

## 13. 실전 운영 규칙

### 새 기능을 시작하기 전
- 먼저 LOCK 대상인지 확인
- 영향 파일 2~4개 수준으로 줄이기
- DB 변경이 꼭 필요한지 먼저 확인

### 오류가 났을 때
- 에러 메시지를 그대로 저장
- 해당 파일만 좁혀서 Codex에 수정 요청
- “전체 리팩터링” 금지

### 동작이 성공한 뒤
- 바로 LOCK 대상으로 분류
- 다음 AI에게는 “이 흐름은 이미 동작함, 수정 금지”를 명시


---

## Cursor review checklist

Cursor는 새 기능을 직접 크게 생성하는 역할보다, **작업 범위 확인, 변경 검토, 안전성 점검** 역할에 집중한다.

### 기본 확인
- `AI_WORKFLOW.md` 파일이 프로젝트 루트에 존재하는지 먼저 확인한다.
- 이번 작업에서 **허용된 파일 범위**가 무엇인지 먼저 읽고 정리한다.
- 실제로 변경된 파일 목록이 무엇인지 확인한다.

### LOCK 검토
- 이번 변경이 LOCK된 기능 파일을 건드렸는지 확인한다.
- 아래 경로가 바뀌었는지 특히 주의해서 본다:
  - `src/`
  - `supabase/`
  - `package.json`
  - `migrations`
- 사용자가 허용하지 않은 LOCK 흐름 수정이 있으면 바로 보고한다.

### 변경 규모 검토
- 변경 파일 수가 너무 많으면 작업 중단을 권고한다.
- 한 기능 작업인데 여러 모듈을 동시에 광범위하게 수정했다면 재설계를 권고한다.
- “작은 범위, 명확한 책임” 원칙을 벗어나면 다음 단계로 넘기지 않는다.

### 읽기 전용 검토 기준
- 코드 수정 없이 읽기/확인만 수행할 때는 다음을 본다:
  - 요구사항과 실제 변경 파일이 일치하는지
  - 비허용 파일이 수정되지 않았는지
  - 기능 범위 밖의 리팩터링이 섞이지 않았는지
  - LOCK된 영역이 불필요하게 다시 작성되지 않았는지

### 수정 필요 시 원칙
- Cursor가 파일 수정을 해야 하는 경우, **반드시 사용자 승인 후 진행**한다.
- 승인 전에는 읽기, diff 확인, 문제 지적, 범위 제안까지만 한다.

### 변경 검토 방법
- `git diff` 또는 변경 파일 목록을 먼저 확인한 뒤 보고한다.
- 보고할 때는 아래 순서로 정리한다:
  1. 변경 파일 목록
  2. 허용 범위 일치 여부
  3. LOCK 파일 수정 여부
  4. 과도한 변경 여부
  5. 다음 단계 진행 가능 여부

### 다음 단계 판단
- 변경 범위가 작고, LOCK 규칙을 지켰고, 요구사항과 파일 범위가 맞으면 다음 기능 작업으로 넘어가도 된다.
- 반대로 아래 중 하나라도 해당하면 다음 기능으로 넘어가지 않는다:
  - 허용되지 않은 파일 수정
  - LOCK 모듈의 불필요한 변경
  - 지나치게 많은 파일 수정
  - 요구사항과 무관한 리팩터링
  - 검토 없이 바로 추가 작업을 이어가는 경우


---

## 14. 한 줄 운영 요약

- **ChatGPT는 설계**
- **Claude는 생성**
- **Codex는 안정화**
- **Cursor는 탐색과 검토**
- **Gemini는 보조**

그리고 항상:

> **작은 범위, 명확한 책임, 검증 후 LOCK**
