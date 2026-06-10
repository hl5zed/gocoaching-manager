# CLAUDE.md

## 목적

이 문서는 GOThriveCoaching 프로젝트에서 Claude를 사용할 때 지켜야 할 작업 원칙을 정의한다.

이 프로젝트에서 Claude의 역할은 **새 기능 생성 전용**이다.  
오류 수정, 대규모 안정화, 광범위한 리팩터링은 Claude의 기본 역할이 아니다.


---

## 1. Claude의 역할

Claude는 아래 작업에 집중한다.

- 새 페이지 생성
- 새 폼 생성
- 새 읽기/쓰기 흐름의 초기 구현
- 기존 패턴을 따르는 작은 기능 추가

Claude가 기본 역할로 하지 않는 것:

- 이미 동작 중인 기능의 광범위한 재작성
- 대규모 리팩터링
- 안정화 위주의 오류 수정
- 기존 working module 전체 교체

원칙:

> Claude는 “새 기능 생성기”로 사용하고,  
> 이미 동작하는 흐름의 안정화는 다른 단계에서 처리한다.


---

## 2. 작업 전 필수 문서

Claude는 **모든 작업 시작 전에 반드시** 아래 문서를 먼저 읽고 따라야 한다.

- [AI_WORKFLOW.md](./AI_WORKFLOW.md)

특히 아래 내용을 먼저 확인해야 한다.

- LOCK 대상 모듈
- Single Source of Truth
- 허용 파일 범위
- 비용 절약 규칙
- 검증 순서


---

## 3. LOCK된 흐름 수정 금지

Claude는 아래 LOCK된 흐름을 임의로 수정하면 안 된다.

- invitation creation
- invitation email sending
- invitation acceptance RPC
- profile creation
- role assignment
- dashboard role links
- admin users list
- coaching relationships table
- coach relationships
- my-coaching
- weekly_logs table
- weekly log creation
- Korean-first UI / i18n label structure

규칙:
- 위 흐름은 특별히 명시된 경우가 아니면 수정하지 않는다.
- 새 기능이 LOCK 흐름과 충돌하면, 바로 작업을 멈추고 보고한다.


---

## 4. 한 번에 한 기능만 작업

Claude는 반드시 **한 번에 한 기능만** 작업한다.

좋은 예:
- `/coach/weekly-logs` 목록 페이지만 추가
- `/my-coaching/goals`의 첫 read-only 화면만 추가

좋지 않은 예:
- 코치 페이지, 관리자 페이지, 주간 기록, 대시보드까지 한 번에 재정리

원칙:
- 기능 범위를 작게 유지한다.
- 한 기능이 끝나면 검증 후 다음 기능으로 넘어간다.


---

## 코드 수정 전 보고 규칙

Claude는 코드를 수정하기 전에 먼저 아래 내용을 짧고 명확하게 보고해야 한다.

- 이번 작업의 목표
- 수정 예정 파일 목록
- 건드리지 않을 LOCK된 흐름
- 실행 예정 검증 명령어

기본 보고 형식:

- 작업 목표: `<이번 작업 목표>`
- 수정 예정 파일:
  - `<파일 1>`
  - `<파일 2>`
- 수정하지 않을 LOCK 흐름:
  - `<흐름 1>`
  - `<흐름 2>`
- 검증 명령어:
  - `npm run typecheck`
  - `npm run check:all`
  - `npm run build`

추가 규칙:
- 작업 범위가 불명확하면 바로 수정하지 않는다.
- 요구사항이 모호하거나 허용 파일 범위가 애매하면 **사용자 승인 전까지 대기**한다.
- “먼저 수정해 보고 나중에 설명” 방식은 금지한다.


---

## 변경 파일 수 제한

Claude는 한 작업에서 변경 파일 수를 기본적으로 **1~4개** 안으로 유지해야 한다.

기본 원칙:
- 기본 최대 변경 파일 수: **1~4개**
- **5개 이상**의 파일 수정이 필요하면 즉시 멈추고 이유를 보고한다.
- 사용자 승인 없이 작업 범위를 넓히면 안 된다.

보고할 내용:
- 왜 파일 수가 늘어나는지
- 어떤 파일들이 추가로 필요한지
- 그 파일을 수정하지 않으면 무엇이 막히는지

즉:
- “작업하다 보니 이것도 저것도 같이 고쳤다”는 방식은 허용하지 않는다.
- 범위 확대는 항상 사용자 승인 후 진행한다.


---

## 5. 허용 파일만 수정

Claude는 **사용자가 명시적으로 허용한 파일만 수정**해야 한다.

반드시 지킬 것:
- 수정 대상 파일 목록 안에서만 작업
- 허용되지 않은 파일은 읽기까지만 가능
- 다른 파일 수정이 필요하면 즉시 멈추고 보고

즉,
- “이 기능을 제대로 하려면 다른 파일도 건드려야 한다”는 판단이 들면
- 임의로 수정하지 말고
- **왜 필요한지 짧게 설명하고 사용자 승인**을 받아야 한다


---

## 6. 다른 파일이 필요하면 중단 후 보고

Claude는 다음 상황에서 반드시 멈추고 보고한다.

- 허용되지 않은 파일 수정이 필요할 때
- DB schema 변경이 필요할 때
- migration 수정이 필요할 때
- 권한/auth/profile/role 흐름을 건드려야 할 때
- 기존 LOCK 흐름을 바꾸지 않으면 구현이 불가능할 때

보고 방식:
- 필요한 파일
- 왜 필요한지
- 수정하지 않으면 어떤 제약이 있는지


---

## 7. 작동하는 코드 리팩터링 금지

Claude는 이미 작동 중인 코드를 함부로 정리하거나 재작성하지 않는다.

금지:
- working code 스타일 통일 명목 리팩터링
- 구조 개선 명목 대규모 이동
- 불필요한 컴포넌트 분리
- 기존 흐름 재구성

허용:
- 새 기능 구현에 꼭 필요한 최소 수정
- 같은 파일 안의 매우 작은 정리


---

## 8. SQL / migration 수정 제한

Claude는 SQL migration을 **명시적으로 필요한 경우가 아니면 수정하지 않는다.**

기본 금지:
- migration 신규 생성
- 기존 migration 수정
- RPC SQL 수정
- schema 재구성

허용 조건:
- 사용자가 명시적으로 schema 작업을 요청한 경우
- 현재 기능 구현이 실제 DB 부재 때문에 불가능한 경우
- 그리고 그 변경이 최소 범위일 경우


---

## 9. 특별 보호 영역

아래 영역은 Claude가 **명시적으로 지시받지 않는 한 수정 금지**다.

- invitation acceptance RPC
- auth logic
- role logic
- profile logic
- existing weekly log save logic

즉 아래 성격의 수정은 금지:
- 로그인/세션 처리 변경
- 권한 판정 변경
- 프로필 생성 흐름 변경
- 역할 부여 흐름 변경
- 주간 기록 저장 규칙 변경


---

## 10. UI 원칙

Claude는 UI를 만들 때 **Korean-first** 원칙을 따른다.

규칙:
- 현재 사용자에게 보이는 기본 UI 문구는 한국어 우선
- 반복되는 역할/상태/범위/관계 유형 라벨은 기존 라벨 구조를 사용
- 가능하면 다음 파일을 재사용
  - [src/lib/ui/labels.ts](./src/lib/ui/labels.ts)

주의:
- DB enum 값은 번역하지 않는다
- 화면 표시만 한국어로 바꾼다


---

## 11. DB enum 값 변경 금지

Claude는 아래와 같은 DB/로직 enum 값을 변경하면 안 된다.

예:
- `super_admin`
- `country_admin`
- `organization_admin`
- `church_admin`
- `coach_maker`
- `coach`
- `coachee`
- `active`
- `inactive`
- `suspended`
- `archived`
- `draft`
- `submitted`
- `individual_coaching`
- `group_coaching`
- `leadership_coaching`
- `pastoral_coaching`
- `missionary_coaching`
- `global`
- `country`
- `region`
- `organization`
- `church`
- `group`
- `cohort`

원칙:
- 저장 값은 그대로 유지
- 화면 표시만 번역


---

## 12. 타입 안전성 규칙

Claude는 아래 규칙을 반드시 지킨다.

- `any` 사용 금지
- `@ts-ignore` 사용 금지
- 기존 shared type 우선 사용
- 타입 출처는 기본적으로 아래를 따른다:
  - [src/types/database.ts](./src/types/database.ts)
  - [src/types/rpc.ts](./src/types/rpc.ts)


---

## 13. 코드 변경 시 필수 검증

Claude가 실제로 코드를 수정했다면 반드시 아래를 실행해야 한다.

```bash
npm run typecheck
npm run check:all
npm run build
```

그리고 결과를 반드시 보고해야 한다.

보고 형식 예:
- typecheck 통과 여부
- check:all 통과 여부
- build 통과 여부
- 미실행 항목이 있으면 이유


---

## 14. Claude 작업 템플릿

아래 템플릿을 Claude 작업 기본 형식으로 사용한다.

```md
You are working on the GOThriveCoaching platform.

Before starting:
- Read AI_WORKFLOW.md first.
- Do not modify locked flows.
- Work on one feature only.

Task:
<이번 작업 한 줄>

Files to create or update:
- <허용 파일 1>
- <허용 파일 2>

Do not modify:
- src/ outside the allowed files
- supabase/ unless explicitly required
- invitation acceptance RPC
- auth logic
- role logic
- profile logic
- existing weekly log save logic
- package.json

Requirements:
1. Keep the change minimal.
2. Generate only the requested feature.
3. Do not refactor working code.
4. Use Korean-first UI labels.
5. Keep DB enum values unchanged.
6. Do not add any.
7. Do not add @ts-ignore.

If another file is required:
- stop
- report which file is needed
- explain why
- wait for approval

Verification:
- npm run typecheck
- npm run check:all
- npm run build

Return:
- files changed
- feature added
- anything intentionally not changed
- verification result
```


---

## 15. UI 리뉴얼 작업 규칙

UI 리뉴얼 작업 시 아래 규칙을 반드시 지킨다.

절대 금지:

- 인증/권한/role 분기 로직 수정 금지
- Supabase query 의미 변경 금지
- DB schema/RLS/API route 수정 금지
- package.json 수정 금지
- 