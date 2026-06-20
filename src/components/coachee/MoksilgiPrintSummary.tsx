import type { ReactNode } from "react";
import { I18nText } from "@/lib/i18n/I18nProvider";
import type {
  MoksilgiCoreValue,
  MoksilgiDetailGoal,
  MoksilgiGoalArea,
  MoksilgiPlan,
} from "@/lib/api/my-coaching/moksilgi";
import type { Json } from "@/types/database";

const AREA_TRANSLATION_KEY_BY_AREA_KEY: Record<
  MoksilgiGoalArea["area_key"],
  { subtitle: string; title: string }
> = {
  intellectual: {
    subtitle: "myCoaching.moksilgi.goal.intellectual.subtitle",
    title: "myCoaching.moksilgi.goal.intellectual.title",
  },
  other: {
    subtitle: "myCoaching.moksilgi.goal.other.subtitle",
    title: "myCoaching.moksilgi.goal.other.title",
  },
  physical: {
    subtitle: "myCoaching.moksilgi.goal.physical.subtitle",
    title: "myCoaching.moksilgi.goal.physical.title",
  },
  social: {
    subtitle: "myCoaching.moksilgi.goal.social.subtitle",
    title: "myCoaching.moksilgi.goal.social.title",
  },
  spiritual: {
    subtitle: "myCoaching.moksilgi.goal.spiritual.subtitle",
    title: "myCoaching.moksilgi.goal.spiritual.title",
  },
};

function jsonArray(value: Json): Json[] {
  return Array.isArray(value) ? value : [];
}

function strategiesFromGoal(goal: MoksilgiDetailGoal) {
  return jsonArray(goal.strategies_json).filter(
    (item): item is string => typeof item === "string",
  );
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function PrintSection({
  children,
  title,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="print-section">
      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-brand-600">{title}</h2>
        <div className="space-y-2 text-[11px] leading-relaxed text-ink-base">
          {children}
        </div>
      </div>
    </section>
  );
}

function PrintBody({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[12px] leading-6 text-ink-strong">
      {children}
    </p>
  );
}

function PrintMeta({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-5 text-ink-muted">{children}</p>;
}

function hasMissionContent(plan: MoksilgiPlan | null) {
  if (!plan) {
    return false;
  }

  return (
    hasText(plan.mission_statement) ||
    hasText(plan.mission_bible_verse) ||
    hasText(plan.mission_description)
  );
}

function hasVisionContent(plan: MoksilgiPlan | null) {
  if (!plan) {
    return false;
  }

  return (
    hasText(plan.vision_statement) ||
    plan.vision_year !== null ||
    hasText(plan.vision_metrics) ||
    hasText(plan.vision_target) ||
    hasText(plan.vision_description)
  );
}

function hasGoalContent(plan: MoksilgiPlan | null) {
  if (!plan) {
    return false;
  }

  return hasText(plan.main_goal) || hasText(plan.main_goal_description);
}

function filledCoreValues(coreValues: MoksilgiCoreValue[]) {
  return coreValues.filter(
    (value) =>
      hasText(value.value_name) ||
      hasText(value.meaning) ||
      hasText(value.practice_example),
  );
}

type StrategyAreaBlock = {
  area: MoksilgiGoalArea;
  goals: Array<{
    goal: MoksilgiDetailGoal;
    strategies: string[];
  }>;
};

function buildStrategyBlocks(
  areas: MoksilgiGoalArea[],
  detailGoals: MoksilgiDetailGoal[],
): StrategyAreaBlock[] {
  return areas
    .map((area) => {
      const goals = detailGoals
        .filter((goal) => goal.area_id === area.id)
        .map((goal) => ({
          goal,
          strategies: strategiesFromGoal(goal).filter((strategy) =>
            hasText(strategy),
          ),
        }))
        .filter(
          (item) => hasText(item.goal.title) || item.strategies.length > 0,
        );

      if (goals.length === 0) {
        return null;
      }

      return { area, goals };
    })
    .filter((item): item is StrategyAreaBlock => item !== null);
}

export function MoksilgiPrintSummary({
  areas,
  coreValues,
  detailGoals,
  plan,
}: {
  plan: MoksilgiPlan | null;
  coreValues: MoksilgiCoreValue[];
  areas: MoksilgiGoalArea[];
  detailGoals: MoksilgiDetailGoal[];
}) {
  const missionContent = hasMissionContent(plan);
  const visionContent = hasVisionContent(plan);
  const coreContent = filledCoreValues(coreValues);
  const goalContent = hasGoalContent(plan);
  const strategyBlocks = buildStrategyBlocks(areas, detailGoals);
  const hasAnyContent =
    missionContent ||
    visionContent ||
    coreContent.length > 0 ||
    goalContent ||
    strategyBlocks.length > 0;

  return (
    <div aria-label="내 목실기 인쇄 요약" className="print-only">
      {!hasAnyContent ? (
        <section className="print-section">
          <div>
            <p className="text-[12px] leading-6 text-ink-base">
              <I18nText
                k="myCoaching.moksilgi.printEmpty"
                fallback="아직 작성된 내용이 없습니다."
              />
            </p>
          </div>
        </section>
      ) : null}

      {missionContent && plan ? (
        <PrintSection
          title={
            <I18nText
              k="myCoaching.moksilgi.missionTitle"
              fallback="Ⅰ. 사명선언서 (Mission)"
            />
          }
        >
          {hasText(plan.mission_statement) ? (
            <PrintBody>{plan.mission_statement}</PrintBody>
          ) : null}
          {hasText(plan.mission_bible_verse) ? (
            <PrintMeta>
              <I18nText
                k="myCoaching.moksilgi.form.relatedBibleVerse"
                fallback="관련 성경구절"
              />
              : {plan.mission_bible_verse}
            </PrintMeta>
          ) : null}
          {hasText(plan.mission_description) ? (
            <PrintMeta>{plan.mission_description}</PrintMeta>
          ) : null}
        </PrintSection>
      ) : null}

      {visionContent && plan ? (
        <PrintSection
          title={
            <I18nText
              k="myCoaching.moksilgi.visionTitle"
              fallback="Ⅱ. 비전 (Vision)"
            />
          }
        >
          {hasText(plan.vision_statement) ? (
            <PrintBody>{plan.vision_statement}</PrintBody>
          ) : null}
          {plan.vision_year !== null ||
          hasText(plan.vision_metrics) ||
          hasText(plan.vision_target) ||
          hasText(plan.vision_description) ? (
            <PrintMeta>
              {[
                plan.vision_year !== null ? `${plan.vision_year}년` : null,
                hasText(plan.vision_metrics) ? plan.vision_metrics : null,
                hasText(plan.vision_target) ? plan.vision_target : null,
                hasText(plan.vision_description) ? plan.vision_description : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </PrintMeta>
          ) : null}
        </PrintSection>
      ) : null}

      {coreContent.length > 0 ? (
        <PrintSection
          title={
            <I18nText
              k="myCoaching.moksilgi.coreValueTitle"
              fallback="Ⅲ. 핵심가치 (Core Value)"
            />
          }
        >
          <div className="space-y-2">
            {coreContent.map((value, index) => (
              <div
                className="print-card border-l-2 border-brand-600 pl-3"
                key={`${value.value_name}-${index}`}
              >
                <div>
                  {hasText(value.value_name) ? (
                    <p className="text-[12px] font-semibold text-ink-strong">
                      {value.value_name}
                    </p>
                  ) : null}
                  {hasText(value.meaning) ? (
                    <p className="mt-1 text-[11px] leading-5 text-ink-base">
                      {value.meaning}
                    </p>
                  ) : null}
                  {hasText(value.practice_example) ? (
                    <p className="mt-1 text-[11px] leading-5 text-ink-muted">
                      <I18nText
                        k="myCoaching.moksilgi.form.practice"
                        fallback="실천 모습"
                      />
                      : {value.practice_example}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </PrintSection>
      ) : null}

      {goalContent && plan ? (
        <PrintSection
          title={
            <I18nText
              k="myCoaching.moksilgi.goalTitle"
              fallback="Ⅳ. 목표"
            />
          }
        >
          {hasText(plan.main_goal) ? <PrintBody>{plan.main_goal}</PrintBody> : null}
          {hasText(plan.main_goal_description) ? (
            <PrintMeta>{plan.main_goal_description}</PrintMeta>
          ) : null}
        </PrintSection>
      ) : null}

      {strategyBlocks.length > 0 ? (
        <PrintSection
          title={
            <I18nText
              k="myCoaching.moksilgi.actionStrategyTitle"
              fallback="Ⅴ. 목표에 따른 실행전략 기획안"
            />
          }
        >
          <div className="space-y-3">
            {strategyBlocks.map(({ area, goals }) => (
              <div className="print-card" key={area.id}>
                <div>
                  <h3 className="text-[12px] font-semibold text-ink-strong">
                    <I18nText
                      k={AREA_TRANSLATION_KEY_BY_AREA_KEY[area.area_key].title}
                      fallback={`목표 ${area.sort_order}: ${area.area_title}`}
                    />
                  </h3>
                  <div className="mt-2 space-y-3">
                    {goals.map(({ goal, strategies }) => (
                      <div key={goal.id}>
                        {hasText(goal.title) ? (
                          <p className="text-[11px] font-medium text-ink-base">
                            {goal.title}
                          </p>
                        ) : null}
                        {strategies.length > 0 ? (
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {strategies.map((strategy, index) => (
                              <li
                                className="text-[11px] leading-5 text-ink-base"
                                key={`${goal.id}-${index}`}
                              >
                                {strategy}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PrintSection>
      ) : null}
    </div>
  );
}
