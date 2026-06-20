# 피코치 모바일 UI — Cursor 명령어 모음

이 폴더의 `.md` 파일은 Cursor 채팅에서 `/파일명`(확장자 제외)으로 호출하는 커스텀 명령어다.
각 명령어는 한 번에 한 화면만 구현하도록 CLAUDE.md 규칙(잠금 흐름 미수정, 1~4파일, 코드 전 보고)을 반영했다.

## 권장 실행 순서

| 순서 | 명령어 | 화면 | 단계 |
|---|---|---|---|
| 0 | (완료) | 모바일 셸 + 하단 5탭 | 1단계-1 ✅ |
| 1 | `/coachee-01-today-home` | 오늘의 목표(홈) | 1단계-2 |
| 2 | `/coachee-02-today-check` | 오늘 실행 체크 | 1단계-3 |
| 3 | `/coachee-03-today-record` | 오늘 기록 | 1단계-4 |
| 4 | `/coachee-04-weekly-report` | 주간 리포트 | 2단계 |
| 5 | `/coachee-05-monthly-report` | 월간 리포트 | 2단계 |
| 6 | `/coachee-06-my-growth` | 나의 성장 | 1~2단계 |
| 7 | `/coachee-07-moksilgi-redesign` | 목실기 페이지 리뉴얼(표시 레이어만) | 별도 |

## 사용법
1. Cursor 채팅 입력창에 `/coachee-01-today-home` 입력 → 명령어 내용이 프롬프트로 들어간다.
2. 한 번에 하나씩, 검증(`typecheck` / `check:all` / `build`)까지 끝낸 뒤 다음 명령으로.
3. ⚠️ 표시가 있는 스키마 변경(daily_checklist, daily_records.gratitude, weekly_summary)은 명령 안에서 임의 진행하지 말고, 별도 승인 후 진행한다.

## 참고 문서
- 설계 초안 전체: `docs/피코치-모바일-UI-리뉴얼-초안.md`
- 작업 규칙: `CLAUDE.md`, `AI_WORKFLOW.md`
