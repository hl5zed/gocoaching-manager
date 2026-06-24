"use client";

import { useCallback, useState } from "react";
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
  strategy_note: string;
  prayer_note: string;
  core_values: CoreValueParsed[];
  /** 인식된 섹션 수 */
  matchedCount: number;
};

type FieldMapping = {
  label: string;
  targetField: string;
  value: string;
};

// ------------------------------------------------------------------
// 섹션 마커 정의
// 대소문자·공백 무관하게 감지
// ------------------------------------------------------------------

const SECTION_PATTERNS = {
  mission: /^(사명|사명\s*선언|미션|mission)\s*[:：]/i,
  mission_bible: /^(성경|성경\s*구절|말씀|bible\s*verse?)\s*[:：]/i,
  mission_desc: /^(사명\s*설명|사명\s*부연|mission\s*description)\s*[:：]/i,
  vision: /^(비전|비젼|vision)\s*[:：]/i,
  vision_desc: /^(비전\s*설명|비젼\s*설명|vision\s*description)\s*[:：]/i,
  goal: /^(목표|장기\s*목표|전체\s*목표|main\s*goal|장기\s*비전)\s*[:：]/i,
  goal_desc: /^(목표\s*설명|목표\s*부연|goal\s*description)\s*[:：]/i,
  strategy: /^(실행\s*전략|실천\s*계획|주간\s*전략|행동\s*계획|오늘의\s*실행|action\s*plan)\s*[:：]/i,
  prayer: /^(기도\s*제목|기도\s*내용|prayer)\s*[:：]/i,
  core_header: /^(핵심\s*가치|핵심가치|core\s*values?)\s*(\d+)?\s*[:：]?\s*/i,
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
    | "strategy"
    | "prayer"
    | "core";

  const buckets: Record<SectionKey, string[]> = {
    mission: [],
    mission_bible: [],
    mission_desc: [],
    vision: [],
    vision_desc: [],
    goal: [],
    goal_desc: [],
    strategy: [],
    prayer: [],
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
    if (SECTION_PATTERNS.core_header.test(trimmed)) {
      current = "core";
      buckets.core.push("---CORE_BREAK---");
      const rest = trimmed.replace(SECTION_PATTERNS.core_header, "").trim();
      if (rest) buckets.core.push(rest);
      continue;
    }

    if (current && trimmed) {
      buckets[current].push(trimmed);
    }
  }

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
      currentCv.value_name = line.trim();
    }
  }

  if (inCv && (currentCv.value_name || currentCv.meaning || currentCv.practice_example)) {
    coreValues.push({ ...currentCv });
  }

  const mission_statement = buckets.mission.join("\n").trim();
  const mission_bible_verse = buckets.mission_bible.join("\n").trim();
  const vision_statement = buckets.vision.join("\n").trim();
  const vision_description = buckets.vision_desc.join("\n").trim();
  const main_goal = buckets.goal.join("\n").trim();

  const strategy_note = buckets.strategy.join("\n").trim();
  const prayer_note = buckets.prayer.join("\n").trim();

  const main_goal_description_merged = [
    buckets.goal_desc.join("\n").trim(),
    strategy_note ? `\n[실행전략]\n${strategy_note}` : "",
  ]
    .filter(Boolean)
    .join("")
    .trim();

  const mission_description_merged = [
    buckets.mission_desc.join("\n").trim(),
    prayer_note ? `\n[기도제목]\n${prayer_note}` : "",
  ]
    .filter(Boolean)
    .join("")
    .trim();

  const matchedCount = [
    mission_statement,
    vision_statement,
    main_goal,
    coreValues.length > 0 ? "cv" : "",
  ].filter(Boolean).length;

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
}

function buildFieldMappings(result: ParseResult): FieldMapping[] {
  const rows: FieldMapping[] = [
    { label: "사명선언", targetField: "mission_statement", value: result.mission_statement },
    { label: "성경구절", targetField: "mission_bible_verse", value: result.mission_bible_verse },
    { label: "사명 설명", targetField: "mission_description", value: result.mission_description },
    { label: "비전 문장", targetField: "vision_statement", value: result.vision_statement },
    { label: "비전 설명", targetField: "vision_description", value: result.vision_description },
    { label: "장기 목표", targetField: "main_goal", value: result.main_goal },
    {
      label: "목표 설명 / 실행전략",
      targetField: "main_goal_description",
      value: result.main_goal_description,
    },
  ];
  return rows.filter((row) => row.value.trim().length > 0);
}

// ------------------------------------------------------------------
// DOM에 적용 (비제어 input/textarea에 직접 value 세팅)
// ------------------------------------------------------------------

function applyToForm(result: ParseResult): number {
  let applied = 0;

  const setField = (name: string, value: string) => {
    if (!value) {
      return;
    }
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[name="${name}"]`,
    );
    if (el) {
      el.value = value;
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
    if (!rawText.trim()) {
      return;
    }
    const result = parsePasteText(rawText);
    setParseResult(result);
    setAppliedCount(null);
    setState("preview");
  }, [rawText]);

  const handleApply = useCallback(() => {
    if (!parseResult) {
      return;
    }
    const count = applyToForm(parseResult);
    setAppliedCount(count);
    setState("closed");
    setRawText("");
    setParseResult(null);
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
            HWP, Word, 메모장에서 전체 내용을 복사해 붙여넣으세요.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            인식 키워드:{" "}
            <span className="font-medium text-ink-base">
              사명 / 성경구절 / 사명 설명 / 비전 / 비전 설명 / 목표 / 목표 설명 / 핵심가치 N
            </span>
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
            onChange={(event) => setRawText(event.target.value)}
            placeholder={
              "사명: 나는 하나님의 영광을 위해...\n비전: 2035년까지...\n목표: ...\n핵심가치 1:\n  가치명: ...\n  의미: ...\n  실천: ..."
            }
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

  if (state === "preview") {
    if (!parseResult) {
      return null;
    }

    const fieldMappings = buildFieldMappings(parseResult);
    const coreValues = parseResult.core_values;
    const canApply = fieldMappings.length > 0 || coreValues.length > 0;

    return (
      <Card className="border-line-base bg-surface-card">
        <CardContent className="space-y-3 p-4">
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

          {!canApply ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              인식된 섹션이 없습니다.{" "}
              <span className="font-semibold">템플릿의 섹션 제목</span>을 사용해 주세요.
            </p>
          ) : (
            <>
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
                      <tr className="border-t border-line-base" key={row.targetField}>
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

              <details className="text-xs">
                <summary className="cursor-pointer text-ink-muted underline">원문 보기</summary>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-surface-app p-2 text-xs text-ink-muted">
                  {rawText}
                </pre>
              </details>
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
            {canApply ? (
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

  return null;
}
