# Cursor 작업 명령어 — 목실기 붙여넣기 입력 모드 2차 개선

## 작업 목표

`MoksilgiPastePanel.tsx` 1개 파일만 수정한다.  
아래 3가지를 개선한다.

1. **키워드 확장** — 한국어 유사 표현 전체 커버
2. **필드 매칭 확인 화면** — "분석 결과 → 어느 폼 칸에 들어가는지" 명확히 표시
3. **원문 보기 토글** — 분석 후에도 붙여넣은 원문을 확인할 수 있게

버전 연동(새 버전 생성 vs 덮어쓰기)은 **이번 작업에서 제외** — 버전 기능 migration 완료 후 별도 작업.

## 수정 파일 (1개)

- **EDIT**: `src/components/coachee/MoksilgiPastePanel.tsx`

## 건드리지 않을 것

- `page.tsx` (moksilgi)
- `savePlanAction`, `PlanForm`, `DetailGoalForm`
- `moksilgi.ts`, `moksilgi-versions.ts`
- `supabase/`, `package.json`

---

## 변경 상세

### 변경 1 — SECTION_PATTERNS 확장

**기존 코드 교체:**
```ts
const SECTION_PATTERNS = {
  mission: /^(사명|사명선언|미션|mission)\s*[:：]/i,
  mission_bible: /^(성경|성경구절|말씀|bible verse)\s*[:：]/i,
  mission_desc: /^(사명\s*설명|mission\s*description)\s*[:：]/i,
  vision: /^(비전|vision)\s*[:：]/i,
  vision_desc: /^(비전\s*설명|vision\s*description)\s*[:：]/i,
  goal: /^(목표|장기목표|전체\s*목표|main\s*goal)\s*[:：]/i,
  goal_desc: /^(목표\s*설명|goal\s*description)\s*[:：]/i,
  core_header: /^(핵심\s*가치|핵심가치|core\s*values?)\s*(\d+)?\s*[:：]?/i,
} as const;
```

**교체 후:**
```ts
const SECTION_PATTERNS = {
  // 사명 (유사어: 미션, mission)
  mission: /^(사명|사명\s*선언|미션|mission)\s*[:：]/i,
  // 성경구절
  mission_bible: /^(성경|성경\s*구절|말씀|bible\s*verse?)\s*[:：]/i,
  // 사명 설명
  mission_desc: /^(사명\s*설명|사명\s*부연|mission\s*description)\s*[:：]/i,
  // 비전 (유사어: 비젼, vision)
  vision: /^(비전|비젼|vision)\s*[:：]/i,
  // 비전 설명
  vision_desc: /^(비전\s*설명|비젼\s*설명|vision\s*description)\s*[:：]/i,
  // 목표 (유사어: 장기목표, 전체목표, 장기 비전)
  goal: /^(목표|장기\s*목표|전체\s*목표|main\s*goal|장기\s*비전)\s*[:：]/i,
  // 목표 설명
  goal_desc: /^(목표\s*설명|목표\s*부연|goal\s*description)\s*[:：]/i,
  // 실행전략 → main_goal_description에 보조로 추가
  strategy: /^(실행\s*전략|실천\s*계획|주간\s*전략|행동\s*계획|오늘의\s*실행|action\s*plan)\s*[:：]/i,
  // 기도제목 → mission_description 하단에 보조로 추가
  prayer: /^(기도\s*제목|기도\s*내용|prayer)\s*[:：]/i,
  // 감사 / 배운 점 → 무시 (현재 폼에 해당 필드 없음)
  // 핵심가치 (번호 있음/없음 모두 허용)
  core_header: /^(핵심\s*가치|핵심가치|core\s*values?)\s*(\d+)?\s*[:：]?\s*/i,
} as const;
```

**`parsePasteText` 함수 내 SectionKey 타입 및 buckets에도 추가:**
```ts
type SectionKey =
  | "mission"
  | "mission_bible"
  | "mission_desc"
  | "vision"
  | "vision_desc"
  | "goal"
  | "goal_desc"
  | "strategy"   // NEW
  | "prayer"     // NEW
  | "core";

const buckets: Record<SectionKey, string[]> = {
  mission: [],
  mission_bible: [],
  mission_desc: [],
  vision: [],
  vision_desc: [],
  goal: [],
  goal_desc: [],
  strategy: [],   // NEW
  prayer: [],     // NEW
  core: [],
};
```

**파서 루프 안에 strategy/prayer 감지 추가** (core_header 감지 전에 삽입):
```ts
if (SECTION_PATTERNS.strategy.test(trimmed)) {
  current = "strategy";
  const rest = trimmed.replace(SECTION_PATTERNS.strategy, "").trim();
  if (rest) buckets.strategy.push(rest);
  continue;
}
if (SECTION_PATTERNS.prayer.test(trimmed)) {
  current = "prayer";
  const rest = trimmed.replace(SECTION_PATTERNS.prayer, "").trim();
  if (rest) buckets.prayer.push(rest);
  continue;
}
```

**ParseResult 타입에 strategy 추가:**
```ts
type ParseResult = {
  mission_statement: string;
  mission_bible_verse: string;
  mission_description: string;
  vision_statement: string;
  vision_description: string;
  main_goal: string;
  main_goal_description: string;
  strategy_note: string;   // NEW — main_goal_description에 보조 병합
  prayer_note: string;     // NEW — mission_description에 보조 병합
  core_values: CoreValueParsed[];
  matchedCount: number;
};
```

**parsePasteText 반환 직전에 병합 로직 추가:**
```ts
// 실행전략은 main_goal_description 뒤에 붙임
const strategy_note = buckets.strategy.join("\n").trim();
const prayer_note = buckets.prayer.join("\n").trim();

const main_goal_description_merged = [
  buckets.goal_desc.join("\n").trim(),
  strategy_note ? `\n[실행전략]\n${strategy_note}` : "",
].filter(Boolean).join("").trim();

const mission_description_merged = [
  buckets.mission_desc.join("\n").trim(),
  prayer_note ? `\n[기도제목]\n${prayer_note}` : "",
].filter(Boolean).join("").trim();
```

그리고 반환 시:
```ts
return {
  mission_statement,
  mission_bible_verse,
  mission_description: mission_description_merged,
  vision_statement,
  vision_description,
  main_goal,
  main_goal_description: main_goal_description_merged,
  strategy_note,
  prayer_note,
  core_values: coreValues.slice(0, 5),
  matchedCount,
};
```

---

### 변경 2 — 필드 매칭 확인 화면 개선

`state === "preview"` 렌더링 블록을 아래로 교체한다.

**기존 preview 섹션 교체:**
```tsx
{/* state === "preview" 전체 블록을 아래로 교체 */}

// ParseResult → 필드 매핑 정보
type FieldMapping = {
  label: string;        // 한글 섹션 이름
  targetField: string;  // 폼 name 속성
  value: string;
};

function buildFieldMappings(result: ParseResult): FieldMapping[] {
  const rows: FieldMapping[] = [
    { label: "사명선언", targetField: "mission_statement", value: result.mission_statement },
    { label: "성경구절", targetField: "mission_bible_verse", value: result.mission_bible_verse },
    { label: "사명 설명", targetField: "mission_description", value: result.mission_description },
    { label: "비전 문장", targetField: "vision_statement", value: result.vision_statement },
    { label: "비전 설명", targetField: "vision_description", value: result.vision_description },
    { label: "장기 목표", targetField: "main_goal", value: result.main_goal },
    { label: "목표 설명 / 실행전략", targetField: "main_goal_description", value: result.main_goal_description },
  ];
  return rows.filter((row) => row.value.trim().length > 0);
}
```

**preview 렌더링 블록 전체 교체:**
```tsx
if (state === "preview") {
  if (!parseResult) return null;

  const fieldMappings = buildFieldMappings(parseResult);
  const coreValues = parseResult.core_values;

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="space-y-3 p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-base">필드 매칭 확인</p>
          <button
            className="text-xs text-ink-muted underline"
            onClick={handleClose}
            type="button"
          >
            취소
          </button>
        </div>

        {parseResult.matchedCount === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            인식된 섹션이 없습니다.{" "}
            <span className="font-semibold">사명:, 비전:, 목표:</span> 같은 키워드를
            포함해 주세요.
          </p>
        ) : (
          <>
            {/* 매칭 테이블 */}
            <div className="overflow-hidden rounded-md border border-line-base">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-app">
                    <th className="px-3 py-2 text-left font-semibold text-ink-muted">
                      인식 항목
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-ink-muted">
                      적용 폼 칸
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMappings.map((row) => (
                    <tr
                      className="border-t border-line-base"
                      key={row.targetField}
                    >
                      <td className="px-3 py-2 font-medium text-ink-base">{row.label}</td>
                      <td className="px-3 py-2 font-mono text-ink-muted">{row.targetField}</td>
                    </tr>
                  ))}
                  {coreValues.length > 0 ? (
                    <tr className="border-t border-line-base">
                      <td className="px-3 py-2 font-medium text-ink-base">
                        핵심가치 ({coreValues.length}개)
                      </td>
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        core_value_name_0 ~ {coreValues.length - 1}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* 내용 미리보기 */}
            <div className="space-y-2 rounded-md bg-surface-app p-3">
              {fieldMappings.map((row) => (
                <div key={row.targetField}>
                  <p className="text-xs font-medium text-ink-muted">{row.label}</p>
                  <p className="line-clamp-2 text-xs text-ink-base">{row.value}</p>
                </div>
              ))}
              {coreValues.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">핵심가치</p>
                  {coreValues.map((cv, index) => (
                    <p className="truncate text-xs text-ink-base" key={index}>
                      {index + 1}. {cv.value_name || "(가치명 없음)"}
                      {cv.meaning ? ` — ${cv.meaning}` : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            {/* 원문 보기 토글 */}
            <details className="text-xs">
              <summary className="cursor-pointer text-ink-muted underline">
                원문 보기
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-surface-app p-2 text-xs text-ink-muted">
                {rawText}
              </pre>
            </details>
          </>
        )}

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => setState("input")}
            type="button"
            variant="secondary"
          >
            다시 입력
          </Button>
          {parseResult.matchedCount > 0 ? (
            <Button
              className="flex-1"
              onClick={handleApply}
              type="button"
              variant="primary"
            >
              폼에 적용
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 변경 3 — applyToForm에 strategy / prayer 필드 제거 (이미 병합됨)

`applyToForm` 함수는 기존과 동일 — `main_goal_description`에 이미 전략 내용이 병합돼 있으므로 별도 처리 불필요.

---

### 변경 4 — input 패널 안내 문구 업데이트

```tsx
// 기존
<p className="text-xs leading-5 text-ink-muted">
  HWP, Word, 메모장에서 전체 내용을 복사해 붙여넣으세요.{" "}
  <span className="font-medium text-ink-base">
    사명:, 비전:, 목표:, 핵심가치 1:
  </span>{" "}
  같은 키워드를 포함하면 자동으로 각 섹션에 채워집니다.
</p>

// 교체 후
<p className="text-xs leading-5 text-ink-muted">
  HWP, Word, 메모장에서 전체 내용을 복사해 붙여넣으세요.
</p>
<p className="mt-1 text-xs text-ink-muted">
  인식 키워드:{" "}
  <span className="font-medium text-ink-base">
    사명 / 미션 / 비전 / 비젼 / 목표 / 장기목표 / 핵심가치 N / 실행전략 / 기도제목
  </span>
</p>
```

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## Return 형식

- 수정된 파일 목록
- 추가된 기능
- 의도적으로 건드리지 않은 것
- typecheck / check:all / build 결과
