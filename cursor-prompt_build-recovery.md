# Cursor 작업 명령어 — 빌드 복구 (손상된 3개 파일)

> 목적: 현재 `npm run build` / `npm run typecheck`를 실패시키는 **3개 손상 파일만** 복구한다.
> 이 작업은 **빌드 복구 전용**이다. 새 기능 추가·리팩터링·성능 개선은 이 명령에 포함하지 않는다.

---

## 배경 (왜 빌드가 깨졌는가)

작업 중 저장이 중간에 끊겨(truncate) 3개 파일이 손상된 상태다. `tsc --noEmit` 기준:

| 파일 | 증상 | 타입에러 |
|------|------|---------|
| `src/app/my-coaching/goals/page.tsx` | 정상 코드는 364줄(`}`)에서 끝나지만 그 뒤에 **NUL 바이트 420개**가 붙음 | 420건 (`TS1127 Invalid character`, 전부 365줄) |
| `src/app/my-coaching/moksilgi/monthly/page.tsx` | **984줄에서 문장 중간 잘림** (`record.detail_goal_`에서 끊김), JSX 닫는 태그 누락 | 8건 (`TS17008/TS17014/TS1005`) |
| `src/app/my-coaching/moksilgi/summary/page.tsx` | **466줄에서 잘림**, JSX 닫는 태그 누락 | 5건 (`TS17008/TS1005`) |

선택한 복구 방식:
- **goals** → 트레일링 NUL 바이트만 제거 (364줄까지의 신규 작업은 정상이므로 보존)
- **monthly / summary** → **git HEAD(마지막 정상 커밋) 기준 안전 복구**

확인 완료: HEAD 버전의 monthly/summary/goals는 미커밋 신규 컴포넌트
(`MoksilgiPastePanel`, `WeeklyCheckStrip`, `moksilgi-versions.ts`)를 **import하지 않으므로**, HEAD 복구 시 import 누락 에러가 생기지 않는다.

⚠️ **유실 경고**: monthly/summary를 HEAD로 되돌리면 미커밋 진행분(monthly 약 95줄, summary 약 322줄 — summary UI 리뉴얼 작업분)이 사라진다. 이 작업분의 **의도는 아래 프롬프트 파일에 보존**되어 있으니 빌드가 초록색이 된 뒤 다시 적용하면 된다:
> `cursor-prompt_summary-ui-redesign.md`, `cursor-prompt_summary-print-fix.md`, `cursor-prompt_monthly-print-fix.md`

---

## 수정 파일 (정확히 3개)

- **FIX(NUL 제거)**: `src/app/my-coaching/goals/page.tsx`
- **RESTORE(git HEAD)**: `src/app/my-coaching/moksilgi/monthly/page.tsx`
- **RESTORE(git HEAD)**: `src/app/my-coaching/moksilgi/summary/page.tsx`

## 절대 건드리지 않을 것 (LOCK / 범위 밖)

- `middleware.ts`, `src/lib/auth/**` (인증·역할 흐름)
- `src/lib/api/invitations/**` (초대 수락 RPC)
- `supabase/**`, 모든 `*.sql`, migration
- `package.json`, `package-lock.json`
- 위 3개를 제외한 모든 `src/` 파일 (읽기만 허용)
- DB enum 값, i18n 라벨 구조

---

## Step 1 — goals/page.tsx 트레일링 NUL 제거

파일은 364줄 `}`에서 논리적으로 완결돼 있고, 그 뒤 NUL 바이트만 쓰레기다. **git 복구 금지**(364줄까지의 신규 작업이 유실됨). 트레일링 NUL만 잘라낸다.

Cursor 터미널(PowerShell)에서:

```powershell
$p = "src/app/my-coaching/goals/page.tsx"
$bytes = [System.IO.File]::ReadAllBytes($p)
$end = $bytes.Length
while ($end -gt 0 -and $bytes[$end-1] -eq 0) { $end-- }
[System.IO.File]::WriteAllBytes($p, $bytes[0..($end-1)])
"goals/page.tsx -> $($bytes.Length) bytes 에서 $end bytes 로 정리됨"
```

또는 bash 터미널에서:

```bash
f=src/app/my-coaching/goals/page.tsx
tr -d '\000' < "$f" > "$f.tmp" && mv "$f.tmp" "$f"
```

확인: 파일 마지막 줄이 `}` 로 끝나고 그 뒤에 빈/깨진 줄이 없어야 한다.

```bash
tail -c 200 src/app/my-coaching/goals/page.tsx | od -c | tail -5   # NUL(\0) 이 없어야 함
```

---

## Step 2 — monthly/page.tsx git HEAD 복구

```bash
git checkout HEAD -- src/app/my-coaching/moksilgi/monthly/page.tsx
```

확인:

```bash
git status --short src/app/my-coaching/moksilgi/monthly/page.tsx   # 출력이 비어 있어야 함(=HEAD와 동일)
```

## Step 3 — summary/page.tsx git HEAD 복구

```bash
git checkout HEAD -- src/app/my-coaching/moksilgi/summary/page.tsx
```

확인:

```bash
git status --short src/app/my-coaching/moksilgi/summary/page.tsx   # 출력이 비어 있어야 함
```

---

## Step 4 — 검증 (필수)

순서대로 실행하고 결과를 보고한다.

```bash
npm run typecheck
npm run check:all
npm run build
```

기대 결과: 세 명령 모두 통과(에러 0). 특히 위 3개 파일에서 `TS1127 / TS17008 / TS17014 / TS1005` 에러가 사라져야 한다.

---

## 잔여 에러 처리 가이드

git HEAD 복구 후, 다른 미커밋 파일(`context.ts`, `moksilgi.ts`, `database.ts` 등)이 그동안 시그니처를 바꿨다면 monthly/summary에서 **새 타입 에러**가 날 수 있다(인터페이스 드리프트).

이 경우:

1. 에러가 **위 3개 파일 안에서만** 발생하면 → 해당 파일 안에서 **최소 범위로만** 수정해 타입을 맞춘다. (함수 호출 인자/프로퍼티명 정렬 수준)
2. 에러를 고치려면 **3개 파일 밖의 파일을 수정해야 한다면** → **멈추고 보고한다.** 임의로 범위를 넓히지 않는다.
3. `any` / `@ts-ignore` 로 에러를 덮지 않는다. 기존 shared type(`src/types/database.ts`, `src/types/rpc.ts`)을 사용한다.

---

## 반환 (작업 완료 시 보고할 것)

- 변경한 파일 목록 (정확히 3개여야 함)
- Step 1 NUL 제거 전/후 바이트 수
- `npm run typecheck` / `check:all` / `build` 통과 여부
- 잔여 에러 처리 가이드 2번에 걸려 멈췄다면, 어떤 파일이 추가로 필요한지

---

## 한 줄 요약

> goals는 NUL만 제거(작업 보존), monthly·summary는 git HEAD로 안전 복구 → typecheck/build 통과까지만. 그 외 일절 손대지 않는다.
