# Cursor 작업 명령어 — 목실기 붙여넣기 입력 모드 (1차)

## 작업 목표

`/my-coaching/moksilgi` 페이지에 **붙여넣기 입력 모드**를 추가한다.  
큰 textarea에 Word·HWP·메모장 내용을 붙여넣으면,  
클라이언트에서 키워드를 감지해 각 섹션의 폼 필드에 자동으로 채운다.  
기존 `savePlanAction`, `PlanForm`, `DetailGoalForm`은 **절대 수정하지 않는다.**

## 수정 파일 (최대 3개)

- **NEW**: `src/components/coachee/MoksilgiPastePanel.tsx`
- **NEW**: `public/templates/moksilgi-template.txt`
- **EDIT**: `src/app/my-coaching/moksilgi/page.tsx`
  - `MoksilgiPastePanel` import 추가
  - 하단 고정 바에 붙여넣기 버튼 1개 추가

## 건드리지 않을 것

- `savePlanAction` (서버 액션)
- `saveDetailGoalAction` (서버 액션)
- `PlanForm` 컴포넌트
- `DetailGoalForm` 컴포넌트
- `saveMyMoksilgiPlan`, `saveMyMoksilgiDetailGoal` API 함수
- `supabase/` 폴더 전체
- `package.json`
- invitation / auth / role / profile 흐름

---

## Step 1 — 템플릿 파일 생성

파일: `public/templates/moksilgi-template.txt`

```
===== 목실기 붙여넣기 템플릿 =====
아래 형식으로 작성한 후 전체 복사하여 붙여넣기 창에 넣으세요.
HWP, Word, 메모장에서 작성한 내용도 이 형식에 맞추면 자동 인식됩니다.

사명:
(사명선언 문장을 여기에 작성하세요)

성경구절:
(관련 성경구절)

사명 설명:
(사명에 대한 부연 설명)

비전:
(비전 문장을 여기에 작성하세요)

비전 설명:
(비전 부연 설명)

목표:
(전체 장기 목표 문장)

목표 설명:
(목표 부연 설명)

핵심가치 1:
  가치명: (가치 이름)
  의미: (이 가치의 의미)
  실천: (구체적인 실천 모습)

핵심가치 2:
  가치명:
  의미:
  실천:

핵심가치 3:
  가치명:
  의미:
  실천:
```

---

## Step 2 — MoksilgiPastePanel 클라이언트 컴포넌트 생성

파일: `src/components/coachee/MoksilgiPastePanel.tsx`

### 전체 구현

```tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

// ------------------------------------------------------------------
// 파싱 결과 타입
// ------------------------------------------------------------------

type CoreValueParsed = {
  value_name: string;
  meaning: string;
  practice_example: string;
};

type ParseResult = {
  mission_statement: string;
  mission_bible_verse: string;
  mission_description: string;
  vision_statement: string;
  vision_description: string;
  main_goal: string;
  main_goal_description: string;
  core_values: CoreValueParsed[];
  /** 인식된 섹션 수 */
  matchedCount: number;
};

// ------------------------------------------------------------------
// 섹션 마커 정의
// 대소문자·공백 무관하게 감지
// ------------------------------------------------------------------

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

const CORE_FIELD_PATTERNS = {
  value_name: /^(가치명|가치\s*이름|name)\s*[:：]\s*/i,
  meaning: /^(의미|meaning)\s*[:：]\s*/i,
  practice_example: /^(실천|실천\s*모습|practice)\s*[:：]\s*/i,
};

// ------------------------------------------------------------------
// 파서
// ------------------------------------------------------------------

function parsePasteText(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/);

  type SectionKey =
    | "mission"
    | "mission_bible"
    | "mission_desc"
    | "vision"
    | "vision_desc"
    | "goal"
    | "goal_desc"
    | "core";

  const buckets: Record<SectionKey, string[]> = {
    mission: [],
    mission_bible: [],
    mission_desc: [],
    vision: [],
    vision_desc: [],
    goal: [],
    goal_desc: [],
    core: [],
  };

  let current: SectionKey | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (SECTION_PATTERNS.mission_bible.test(trimmed)) {
      current = "mission_bible";
      const rest = trimmed.replace(SECTION_PATTERNS.mission_bible, "").trim();
      if (rest) buckets.mission_bible.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.mission_desc.test(trimmed)) {
      current = "mission_desc";
      const rest = trimmed.replace(SECTION_PATTERNS.mission_desc, "").trim();
      if (rest) buckets.mission_desc.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.mission.test(trimmed)) {
      current = "mission";
      const rest = trimmed.replace(SECTION_PATTERNS.mission, "").trim();
      if (rest) buckets.mission.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.vision_desc.test(trimmed)) {
      current = "vision_desc";
      const rest = trimmed.replace(SECTION_PATTERNS.vision_desc, "").trim();
      if (rest) buckets.vision_desc.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.vision.test(trimmed)) {
      current = "vision";
      const rest = trimmed.replace(SECTION_PATTERNS.vision, "").trim();
      if (rest) buckets.vision.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.goal_desc.test(trimmed)) {
      current = "goal_desc";
      const rest = trimmed.replace(SECTION_PATTERNS.goal_desc, "").trim();
      if (rest) buckets.goal_desc.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.goal.test(trimmed)) {
      current = "goal";
      const rest = trimmed.replace(SECTION_PATTERNS.goal, "").trim();
      if (rest) buckets.goal.push(rest);
      continue;
    }
    if (SECTION_PATTERNS.core_header.test(trimmed)) {
      current = "core";
      // 핵심가치 헤더 자체는 구분자로만 사용 → 빈 구분 마커 삽입
      buckets.core.push("---CORE_BREAK---");
      const rest = trimmed.replace(SECTION_PATTERNS.core_header, "").trim();
      if (rest) buckets.core.push(rest);
      continue;
    }

    if (current && trimmed) {
      buckets[current].push(trimmed);
    }
  }

  // 핵심가치 파싱
  const coreValues: CoreValueParsed[] = [];
  let currentCv: CoreValueParsed = { value_name: "", meaning: "", practice_example: "" };
  let inCv = false;

  for (const line of buckets.core) {
    if (line === "---CORE_BREAK---") {
      if (inCv && (currentCv.value_name || currentCv.meaning || currentCv.practice_example)) {
        coreValues.push({ ...currentCv });
      }
      currentCv = { value_name: "", meaning: "", practice_example: "" };
      inCv = true;
      continue;
    }

    if (CORE_FIELD_PATTERNS.value_name.test(line)) {
      currentCv.value_name = line.replace(CORE_FIELD_PATTERNS.value_name, "").trim();
    } else if (CORE_FIELD_PATTERNS.meaning.test(line)) {
      currentCv.meaning = line.replace(CORE_FIELD_PATTERNS.meaning, "").trim();
    } else if (CORE_FIELD_PATTERNS.practice_example.test(line)) {
      currentCv.practice_example = line.replace(CORE_FIELD_PATTERNS.practice_example, "").trim();
    } else if (inCv && !currentCv.value_name) {
      // 가치명 레이블 없이 첫 줄을 가치명으로 사용
      currentCv.value_name = line.trim();
    }
  }

  if (inCv && (currentCv.value_name || currentCv.meaning || currentCv.practice_example)) {
    coreValues.push({ ...currentCv });
  }

  const mission_statement = buckets.mission.join("\n").trim();
  const mission_bible_verse = buckets.mission_bible.join("\n").trim();
  const mission_description = buckets.mission_desc.join("\n").trim();
  const vision_statement = buckets.vision.join("\n").trim();
  const vision_description = buckets.vision_desc.join("\n").trim();
  const main_goal = buckets.goal.join("\n").trim();
  const main_goal_description = buckets.goal_desc.join("\n").trim();

  const matchedCount = [
    mission_statement,
    vision_statement,
    main_goal,
    coreValues.length > 0 ? "cv" : "",
  ].filter(Boolean).length;

  return {
    mission_statement,
    mission_bible_verse,
    mission_description,
    vision_statement,
    vision_description,
    main_goal,
    main_goal_description,
    core_values: coreValues.slice(0, 5),
    matchedCount,
  };
}

// ------------------------------------------------------------------
// DOM에 적용 (비제어 input/textarea에 직접 value 세팅)
// ------------------------------------------------------------------

function applyToForm(result: ParseResult): number {
  let applied = 0;

  const setField = (name: string, value: string) => {
    if (!value) return;
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[name="${name}"]`,
    );
    if (el) {
      el.value = value;
      // 변경 감지를 위해 input 이벤트 발생
      el.dispatchEvent(new Event("input", { bubbles: true }));
      applied++;
    }
  };

  setField("mission_statement", result.mission_statement);
  setField("mission_bible_verse", result.mission_bible_verse);
  setField("mission_description", result.mission_description);
  setField("vision_statement", result.vision_statement);
  setField("vision_description", result.vision_description);
  setField("main_goal", result.main_goal);
  setField("main_goal_description", result.main_goal_description);

  result.core_values.forEach((cv, index) => {
    setField(`core_value_name_${index}`, cv.value_name);
    setField(`core_value_meaning_${index}`, cv.meaning);
    setField(`core_value_practice_${index}`, cv.practice_example);
  });

  return applied;
}

// ------------------------------------------------------------------
// 컴포넌트
// ------------------------------------------------------------------

type PanelState = "closed" | "input" | "preview";

export function MoksilgiPastePanel() {
  const [state, setState] = useState<PanelState>("closed");
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const handleParse = useCallback(() => {
    if (!rawText.trim()) return;
    const result = parsePasteText(rawText);
    setParseResult(result);
    setAppliedCount(null);
    setState("preview");
  }, [rawText]);

  const handleApply = useCallback(() => {
    if (!parseResult) return;
    const count = applyToForm(parseResult);
    setAppliedCount(count);
    setState("closed");
    setRawText("");
    setParseResult(null);
    // 사명 섹션으로 스크롤
    const missionSection = document.getElementById("section-mission");
    if (missionSection) {
      missionSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [parseResult]);

  const handleClose = useCallback(() => {
    setState("closed");
    setRawText("");
    setParseResult(null);
    setAppliedCount(null);
  }, []);

  if (state === "closed") {
    return (
      <>
        {appliedCount !== null && appliedCount > 0 ? (
          <p className="text-center text-xs text-emerald-600">
            ✓ {appliedCount}개 필드에 내용이 채워졌습니다. 확인 후 저장하세요.
          </p>
        ) : null}
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-control border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-muted hover:bg-surface-app"
          onClick={() => setState("input")}
          type="button"
        >
          <span aria-hidden>📋</span>
          붙여넣기로 빠르게 입력
        </button>
      </>
    );
  }

  if (state === "input") {
    return (
      <Card className="border-line-base bg-surface-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-base">붙여넣기 입력</p>
            <button
              aria-label="닫기"
              className="text-xs text-ink-muted underline"
              onClick={handleClose}
              type="button"
            >
              취소
            </button>
          </div>
          <p className="text-xs leading-5 text-ink-muted">
            HWP, Word, 메모장에서 전체 내용을 복사해 붙여넣으세요.{" "}
            <span className="font-medium text-ink-base">
              사명:, 비전:, 목표:, 핵심가치 1:
            </span>{" "}
            같은 키워드를 포함하면 자동으로 각 섹션에 채워집니다.
          </p>
          <a
            className="inline-flex items-center gap-1 text-xs text-brand-600 underline"
            download="moksilgi-template.txt"
            href="/templates/moksilgi-template.txt"
          >
            <span aria-hidden>📄</span>
            템플릿 다운로드 (.txt)
          </a>
          <textarea
            aria-label="목실기 내용 붙여넣기"
            className="mt-1 h-56 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-sm text-ink-base outline-none focus:border-brand-600"
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"사명: 나는 하나님의 영광을 위해...\n비전: 2035년까지...\n목표: ...\n핵심가치 1:\n  가치명: ...\n  의미: ...\n  실천: ..."}
            value={rawText}
          />
          <Button
            className="w-full"
            disabled={!rawText.trim()}
            onClick={handleParse}
            type="button"
            variant="primary"
          >
            내용 분석하기
          </Button>
        </CardContent>
      </Card>
    );
  }

  // state === "preview"
  if (!parseResult) return null;

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-base">분석 결과 확인</p>
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
            인식된 섹션이 없습니다. 내용에{" "}
            <span className="font-semibold">사명:, 비전:, 목표:</span> 같은 키워드를
            포함해 주세요.
          </p>
        ) : (
          <>
            <p className="text-xs text-ink-muted">
              아래 내용이 각 섹션 필드에 채워집니다. 확인 후 적용하세요.
            </p>
            <div className="space-y-2 rounded-md bg-surface-app p-3">
              {parseResult.mission_statement ? (
                <PreviewRow label="사명" value={parseResult.mission_statement} />
              ) : null}
              {parseResult.mission_bible_verse ? (
                <PreviewRow label="성경구절" value={parseResult.mission_bible_verse} />
              ) : null}
              {parseResult.vision_statement ? (
                <PreviewRow label="비전" value={parseResult.vision_statement} />
              ) : null}
              {parseResult.main_goal ? (
                <PreviewRow label="목표" value={parseResult.main_goal} />
              ) : null}
              {parseResult.core_values.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">핵심가치</p>
                  {parseResult.core_values.map((cv, index) => (
                    <p className="truncate text-xs text-ink-base" key={index}>
                      {index + 1}. {cv.value_name || "(가치명 없음)"}{" "}
                      {cv.meaning ? `— ${cv.meaning}` : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}

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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="line-clamp-2 text-xs text-ink-base">{value}</p>
    </div>
  );
}
```

---

## Step 3 — page.tsx 수정 (최소)

파일: `src/app/my-coaching/moksilgi/page.tsx`

### 3a. import 추가 (상단 import 블록 끝에)

```ts
import { MoksilgiPastePanel } from "@/components/coachee/MoksilgiPastePanel";
```

### 3b. 하단 고정 바 수정

**수정 전** (현재 코드):
```tsx
<div className="print:hidden fixed inset-x-0 bottom-20 z-20 mx-auto max-w-md px-4">
  <div className="flex gap-2 rounded-xl border border-line-base bg-surface-card p-3 shadow-lg">
    <Button className="flex-1" form="moksilgi-plan-form" type="submit" variant="primary">
      <I18nText k="myCoaching.moksilgi.saveBasicInfo" fallback="기본 정보 저장" />
    </Button>
    <PrintPageButton ... />
  </div>
</div>
```

**수정 후**:
```tsx
<div className="print:hidden fixed inset-x-0 bottom-20 z-20 mx-auto max-w-md px-4">
  <div className="space-y-2">
    <MoksilgiPastePanel />
    <div className="flex gap-2 rounded-xl border border-line-base bg-surface-card p-3 shadow-lg">
      <Button className="flex-1" form="moksilgi-plan-form" type="submit" variant="primary">
        <I18nText k="myCoaching.moksilgi.saveBasicInfo" fallback="기본 정보 저장" />
      </Button>
      <PrintPageButton
        fileName={`moksilgi-my-record-${printYear}`}
        label={
          (
            <I18nText
              k="myCoaching.moksilgi.printMyMoksilgi"
              fallback="내 목실기 출력"
            />
          ) as unknown as string
        }
      />
    </div>
  </div>
</div>
```

---

## 주의사항

1. `any` 사용 금지 — 모든 타입 명시
2. `@ts-ignore` 사용 금지
3. `MoksilgiPastePanel`은 `"use client"` 선언 필수 (클라이언트 컴포넌트)
4. 하단 바 `bottom-20` 위치가 유지되어야 함 — 레이아웃 크게 변경하지 않을 것
5. `applyToForm`은 `document.querySelector`로 기존 폼 필드를 찾아 `el.value`를 직접 세팅함.  
   이때 `PlanForm`의 비제어 입력(`defaultValue`)이기 때문에 React controlled input 우회 코드 불필요.
6. `public/templates/` 폴더가 없으면 생성 후 `moksilgi-template.txt` 저장

---

## 검증 명령어

```bash
npm run typecheck
npm run check:all
npm run build
```

## Return 형식

- 생성/수정한 파일 목록
- 추가된 기능
- 의도적으로 건드리지 않은 것
- typecheck / check:all / build 결과
