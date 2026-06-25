import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MoksilgiAreaCard } from "@/components/coachee/MoksilgiAreaCard";
import { MoksilgiPastePanel } from "@/components/coachee/MoksilgiPastePanel";
import { MoksilgiPrintSummary } from "@/components/coachee/MoksilgiPrintSummary";
import {
  MoksilgiAppBar,
  MoksilgiProgressCard,
  MoksilgiSection,
  MoksilgiSectionNav,
} from "@/components/coachee/MoksilgiSection";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { I18nText } from "@/lib/i18n/I18nProvider";
import {
  getMyMoksilgi,
  saveMyMoksilgiDetailGoal,
  saveMyMoksilgiPlan,
  type MoksilgiCoreValue,
  type MoksilgiDetailGoal,
  type MoksilgiGoalArea,
  type MoksilgiPlan,
} from "@/lib/api/my-coaching/moksilgi";
import type { Json, MoksilgiMeasurementType } from "@/types/database";


const INPUT_CLASS =
  "mt-2 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-base outline-none focus:border-brand-600";
const LABEL_CLASS = "text-sm font-medium text-ink-muted";

const MEASUREMENT_OPTIONS: Array<{
  value: MoksilgiMeasurementType;
  labelKey: string;
  fallback: string;
}> = [
  {
    value: "daily_check",
    labelKey: "myCoaching.moksilgi.measurement.dailyCheck",
    fallback: "매일 실행 확인",
  },
  {
    value: "weekly_count",
    labelKey: "myCoaching.moksilgi.measurement.weeklyCount",
    fallback: "매주 실행 확인",
  },
  {
    value: "monthly_number",
    labelKey: "myCoaching.moksilgi.measurement.monthlyNumber",
    fallback: "월간 수치 입력",
  },
  {
    value: "monthly_comment",
    labelKey: "myCoaching.moksilgi.measurement.monthlyComment",
    fallback: "COMMENT",
  },
];

const SECTION_NAV = [
  { anchorId: "section-basic", label: "기본정보" },
  { anchorId: "section-mission", label: "사명" },
  { anchorId: "section-vision", label: "비전" },
  { anchorId: "section-core", label: "핵심가치" },
  { anchorId: "section-goal", label: "목표" },
  { anchorId: "section-strategy", label: "실행전략" },
] as const;

type EditSection = "basic" | "mission" | "vision" | "core" | "goal";

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeEditSection(
  value: string | string[] | undefined,
): EditSection | null {
  const raw = normalizeMessage(value);
  if (
    raw === "basic" ||
    raw === "mission" ||
    raw === "vision" ||
    raw === "core" ||
    raw === "goal"
  ) {
    return raw;
  }

  return null;
}

function jsonArray(value: Json): Json[] {
  return Array.isArray(value) ? value : [];
}

function coreValuesFromPlan(
  plan: MoksilgiPlan | null,
  defaults: MoksilgiCoreValue[],
) {
  if (!plan) {
    return defaults;
  }

  const values = jsonArray(plan.core_values_json)
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return null;
      }

      return {
        value_name:
          typeof item.value_name === "string" ? item.value_name : "",
        meaning: typeof item.meaning === "string" ? item.meaning : "",
        practice_example:
          typeof item.practice_example === "string"
            ? item.practice_example
            : "",
      };
    })
    .filter((item): item is MoksilgiCoreValue => item !== null);

  return values.length > 0 ? values : defaults;
}

function strategiesFromGoal(goal: MoksilgiDetailGoal) {
  return jsonArray(goal.strategies_json).filter(
    (item): item is string => typeof item === "string",
  );
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
}

function displayValue(value: string | number | null) {
  if (value === null) {
    return "-";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return value.trim().length > 0 ? value : "-";
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isBasicComplete(plan: MoksilgiPlan | null) {
  if (!plan) return false;
  return (
    hasText(plan.title) &&
    hasText(plan.period_start) &&
    hasText(plan.period_end) &&
    hasText(plan.author_name)
  );
}

function isMissionComplete(plan: MoksilgiPlan | null) {
  return hasText(plan?.mission_statement);
}

function isVisionComplete(plan: MoksilgiPlan | null) {
  if (!plan) return false;
  return hasText(plan.vision_statement) || plan.vision_year !== null;
}

function isCoreComplete(coreValues: MoksilgiCoreValue[]) {
  return coreValues.some(
    (value) =>
      hasText(value.value_name) ||
      hasText(value.meaning) ||
      hasText(value.practice_example),
  );
}

function isGoalComplete(plan: MoksilgiPlan | null) {
  return hasText(plan?.main_goal);
}

function isStrategyComplete(detailGoals: MoksilgiDetailGoal[]) {
  return detailGoals.length > 0;
}

function basicSummary(plan: MoksilgiPlan | null) {
  if (!plan) return "";
  return [plan.title, plan.author_name, plan.region_name]
    .filter((value) => hasText(value))
    .join(" · ");
}

function missionSummary(plan: MoksilgiPlan | null) {
  return plan?.mission_statement?.trim() ?? "";
}

function visionSummary(plan: MoksilgiPlan | null) {
  if (!plan) return "";
  const parts = [
    plan.vision_year ? `${plan.vision_year}년` : null,
    plan.vision_statement?.trim() || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function coreSummary(coreValues: MoksilgiCoreValue[]) {
  const names = coreValues
    .map((value) => value.value_name.trim())
    .filter((value) => value.length > 0);
  return names.join(", ");
}

function goalSummary(plan: MoksilgiPlan | null) {
  return plan?.main_goal?.trim() ?? "";
}

function measurementLabel(value: string) {
  const option = MEASUREMENT_OPTIONS.find((item) => item.value === value);

  if (!option) {
    return value;
  }

  return <I18nText k={option.labelKey} fallback={option.fallback} />;
}

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

async function savePlanAction(formData: FormData) {
  "use server";

  const result = await saveMyMoksilgiPlan(formData);

  if (!result.ok) {
    redirect("/my-coaching/moksilgi?error=plan");
  }

  redirect("/my-coaching/moksilgi?saved=plan");
}

async function saveDetailGoalAction(formData: FormData) {
  "use server";

  const result = await saveMyMoksilgiDetailGoal(formData);

  if (!result.ok) {
    redirect("/my-coaching/moksilgi?error=detail");
  }

  redirect("/my-coaching/moksilgi?saved=detail");
}

function TextInput({
  label,
  name,
  value,
  maxLength,
  helpText,
  placeholder,
  type = "text",
}: {
  label: ReactNode;
  name: string;
  value?: string | number | null;
  maxLength?: number;
  helpText?: ReactNode;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        className={INPUT_CLASS}
        defaultValue={fieldValue(value)}
        maxLength={maxLength}
        name={name}
        placeholder={placeholder}
        type={type}
      />
      {helpText ? (
        <span className="mt-1 block text-xs leading-5 text-ink-muted">{helpText}</span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  maxLength,
  rows = 4,
}: {
  label: ReactNode;
  name: string;
  value?: string | null;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>{label}</span>
      <textarea
        className={INPUT_CLASS}
        defaultValue={value ?? ""}
        maxLength={maxLength}
        name={name}
        rows={rows}
      />
    </label>
  );
}

function PlanForm({
  coreValues,
  editSection,
  plan,
}: {
  plan: MoksilgiPlan | null;
  coreValues: MoksilgiCoreValue[];
  editSection: EditSection | null;
}) {
  const visibleCoreValues = [...coreValues];

  while (visibleCoreValues.length < 5) {
    visibleCoreValues.push({
      value_name: "",
      meaning: "",
      practice_example: "",
    });
  }

  const sectionOpen = (section: EditSection) =>
    editSection === section || (!plan && section === "basic" && editSection === null);

  return (
    <form action={savePlanAction} className="space-y-4" id="moksilgi-plan-form">
      <input name="plan_id" type="hidden" value={plan?.id ?? ""} />

      <MoksilgiSection
        anchorId="section-basic"
        editQuery="basic"
        isComplete={isBasicComplete(plan)}
        isOpen={sectionOpen("basic")}
        summaryText={basicSummary(plan)}
        title={<I18nText k="myCoaching.moksilgi.basicInfo" fallback="기본 정보" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.title" fallback="제목" />} maxLength={160} name="title" value={plan?.title ?? "목표와 실행전략 기획안"} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.subtitle" fallback="부제" />} maxLength={160} name="subtitle" value={plan?.subtitle ?? "목실기와 체크리스트"} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.periodStartDate" fallback="기간 시작일" />} name="period_start" type="date" value={plan?.period_start} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.periodEndDate" fallback="기간 종료일" />} name="period_end" type="date" value={plan?.period_end} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.writtenDate" fallback="작성일" />} name="written_at" type="date" value={plan?.written_at} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.author" fallback="작성자" />} maxLength={120} name="author_name" value={plan?.author_name} />
          <TextInput
            helpText={
              <>
                <I18nText
                  k="myCoaching.moksilgi.form.communityPlaceholder"
                  fallback="예: 태국 / CCT 22노회 / 치앙라이 교회 / 코칭그룹"
                />
                <br />
                <I18nText
                  k="myCoaching.moksilgi.form.communityHelp"
                  fallback="내가 속한 국가와 함께 신앙과 사역을 나누는 공동체를 기록합니다."
                />
              </>
            }
            label={<I18nText k="myCoaching.moksilgi.form.community" fallback="국가/소속/공동체" />}
            maxLength={120}
            name="region_name"
            value={plan?.region_name}
          />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.regionalLeader" fallback="지역팀장" />} maxLength={120} name="regional_leader_name" value={plan?.regional_leader_name} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.coach" fallback="코치" />} maxLength={120} name="coach_name" value={plan?.coach_name} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.role" fallback="직책" />} maxLength={80} name="role_label" value={plan?.role_label} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.generation" fallback="세대" />} maxLength={80} name="generation_label" value={plan?.generation_label} />
          <input name="team_name" type="hidden" value={plan?.team_name ?? ""} />
        </div>
      </MoksilgiSection>

      <MoksilgiSection
        anchorId="section-mission"
        editQuery="mission"
        isComplete={isMissionComplete(plan)}
        isOpen={sectionOpen("mission")}
        summaryText={missionSummary(plan)}
        title={<I18nText k="myCoaching.moksilgi.missionTitle" fallback="Ⅰ. 사명선언서 (Mission)" />}
      >
        <div className="grid gap-4">
          <TextArea label={<I18nText k="myCoaching.moksilgi.form.missionStatement" fallback="사명선언 문장" />} maxLength={3000} name="mission_statement" value={plan?.mission_statement} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.relatedBibleVerse" fallback="관련 성경구절" />} maxLength={120} name="mission_bible_verse" value={plan?.mission_bible_verse} />
          <TextArea label={<I18nText k="myCoaching.moksilgi.form.missionDescription" fallback="사명 설명" />} maxLength={4000} name="mission_description" value={plan?.mission_description} />
        </div>
      </MoksilgiSection>

      <MoksilgiSection
        anchorId="section-vision"
        editQuery="vision"
        isComplete={isVisionComplete(plan)}
        isOpen={sectionOpen("vision")}
        summaryText={visionSummary(plan)}
        title={<I18nText k="myCoaching.moksilgi.visionTitle" fallback="Ⅱ. 비전 (Vision)" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.visionTargetYear" fallback="비전 목표 연도" />} name="vision_year" type="number" value={plan?.vision_year} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.keyMetric" fallback="핵심 수치" />} maxLength={1000} name="vision_metrics" value={plan?.vision_metrics} />
          <TextInput label={<I18nText k="myCoaching.moksilgi.form.target" fallback="대상" />} maxLength={1000} name="vision_target" value={plan?.vision_target} />
        </div>
        <div className="mt-4 grid gap-4">
          <TextArea label={<I18nText k="myCoaching.moksilgi.form.visionStatement" fallback="비전 문장" />} maxLength={3000} name="vision_statement" value={plan?.vision_statement} />
          <TextArea label={<I18nText k="myCoaching.moksilgi.form.visionDescription" fallback="비전 설명" />} maxLength={4000} name="vision_description" value={plan?.vision_description} />
        </div>
      </MoksilgiSection>

      <MoksilgiSection
        anchorId="section-core"
        editQuery="core"
        isComplete={isCoreComplete(visibleCoreValues)}
        isOpen={sectionOpen("core")}
        summaryText={coreSummary(visibleCoreValues)}
        title={<I18nText k="myCoaching.moksilgi.coreValueTitle" fallback="Ⅲ. 핵심가치 (Core Value)" />}
      >
        <div className="grid gap-4">
          {visibleCoreValues.slice(0, 5).map((value, index) => (
            <div className="grid gap-4 rounded-card border border-line-base bg-surface-app p-4 md:grid-cols-3" key={index}>
              <TextInput label={<I18nText k="myCoaching.moksilgi.form.valueName" fallback="가치명" />} maxLength={120} name={`core_value_name_${index}`} value={value.value_name} />
              <TextInput label={<I18nText k="myCoaching.moksilgi.form.meaning" fallback="의미" />} maxLength={1000} name={`core_value_meaning_${index}`} value={value.meaning} />
              <TextInput label={<I18nText k="myCoaching.moksilgi.form.practice" fallback="실천 모습" />} maxLength={1000} name={`core_value_practice_${index}`} value={value.practice_example} />
            </div>
          ))}
        </div>
      </MoksilgiSection>

      <MoksilgiSection
        anchorId="section-goal"
        editQuery="goal"
        isComplete={isGoalComplete(plan)}
        isOpen={sectionOpen("goal")}
        summaryText={goalSummary(plan)}
        title={<I18nText k="myCoaching.moksilgi.goalTitle" fallback="Ⅳ. 목표" />}
      >
        <div className="grid gap-4">
          <TextArea label={<I18nText k="myCoaching.moksilgi.form.overallGoalStatement" fallback="전체 목표 문장" />} maxLength={1000} name="main_goal" value={plan?.main_goal} />
          <TextArea label={<I18nText k="myCoaching.moksilgi.form.goalDescription" fallback="목표 설명" />} maxLength={3000} name="main_goal_description" value={plan?.main_goal_description} />
        </div>
      </MoksilgiSection>

      <input name="status" type="hidden" value={plan?.status ?? "active"} />
    </form>
  );
}

function DetailGoalForm({
  planId,
  area,
  detailGoal,
}: {
  planId: string;
  area: MoksilgiGoalArea;
  detailGoal?: MoksilgiDetailGoal;
}) {
  const strategies = detailGoal ? strategiesFromGoal(detailGoal) : [];

  return (
    <form action={saveDetailGoalAction} className="mt-4 grid gap-4 rounded-card border border-line-base bg-surface-card p-4">
      <input name="plan_id" type="hidden" value={planId} />
      <input name="area_id" type="hidden" value={area.id} />
      <input name="detail_goal_id" type="hidden" value={detailGoal?.id ?? ""} />
      <TextInput label={<I18nText k="myCoaching.moksilgi.detailGoal.title" fallback="세부 목표 제목" />} maxLength={300} name="detail_title" value={detailGoal?.title} />
      <TextArea label={<I18nText k="myCoaching.moksilgi.detailGoal.description" fallback="세부 목표 설명" />} maxLength={3000} name="detail_description" rows={3} value={detailGoal?.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput label={<I18nText k="myCoaching.moksilgi.detailGoal.yearlyTarget" fallback="연간 목표량" />} name="annual_target" type="number" value={detailGoal?.annual_target} />
        <TextInput label={<I18nText k="myCoaching.moksilgi.detailGoal.monthlyTarget" fallback="월 목표량" />} name="monthly_target" type="number" value={detailGoal?.monthly_target} />
        <TextInput label={<I18nText k="myCoaching.moksilgi.detailGoal.unit" fallback="단위" />} maxLength={40} name="unit" value={detailGoal?.unit} />
      </div>
      <label className="block">
        <span className={LABEL_CLASS}>
          <I18nText k="myCoaching.moksilgi.detailGoal.measurementMethod" fallback="측정 방식" />
        </span>
        <select
          className={INPUT_CLASS}
          defaultValue={detailGoal?.measurement_type ?? "monthly_number"}
          name="measurement_type"
        >
          {MEASUREMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              <I18nText k={option.labelKey} fallback={option.fallback} />
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((index) => (
          <TextInput
            key={index}
            label={<I18nText k={`myCoaching.moksilgi.detailGoal.actionStrategy${index}`} fallback={`실행전략 ${index}`} />}
            maxLength={1000}
            name={`strategy_${index}`}
            value={strategies[index - 1] ?? ""}
          />
        ))}
      </div>
      <Button className="w-fit" type="submit" variant="primary">
        <I18nText k="myCoaching.moksilgi.saveDetailGoal" fallback="세부 목표 저장" />
      </Button>
    </form>
  );
}

export default async function MyMoksilgiPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await getMyMoksilgi();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fmoksilgi");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const saved = normalizeMessage(resolvedSearchParams.saved);
  const error = normalizeMessage(resolvedSearchParams.error);
  const editSection = normalizeEditSection(resolvedSearchParams.edit);
  const printYear = new Date().getFullYear();

  const coreValues = result.ok
    ? coreValuesFromPlan(result.data.plan, result.data.defaultCoreValues)
    : [];
  const completedSections = result.ok
    ? [
        isBasicComplete(result.data.plan),
        isMissionComplete(result.data.plan),
        isVisionComplete(result.data.plan),
        isCoreComplete(coreValues),
        isGoalComplete(result.data.plan),
        isStrategyComplete(result.data.detailGoals),
      ].filter(Boolean).length
    : 0;

  return (
    <main className="print-root min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base print:px-2 print:py-2 print:pb-0 print:bg-white">
      <MoksilgiAppBar
        actions={
          <>
            <div className="print:hidden">
              <LanguageSwitcher />
            </div>
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
          </>
        }
      />

      <section className="mx-auto w-full max-w-md space-y-4 print:max-w-none">
        <Card className="border-line-base bg-surface-card print:hidden">
          <CardContent className="space-y-2 p-4">
            <Badge tone="info">
              <I18nText k="myCoaching.moksilgi.badge" fallback="목실기 작성" />
            </Badge>
            <h2 className="text-xl font-semibold text-ink-strong">
              <I18nText k="myCoaching.moksilgi.title" fallback="목표와 실행전략 기획안" />
            </h2>
            <p className="text-base text-ink-base">
              <I18nText k="myCoaching.moksilgi.subtitle" fallback="목실기와 체크리스트" />
            </p>
            <p className="text-sm text-ink-muted">
              <I18nText
                k="myCoaching.moksilgi.description"
                fallback="사명선언서, 비전, 핵심가치, 목표와 실행전략을 작성합니다."
              />
            </p>
          </CardContent>
        </Card>

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <Card className="border-line-base bg-surface-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-ink-base">
                <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
              </p>
              <Link
                className="text-sm font-medium text-brand-600 underline"
                href="/profile"
              >
                <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
              </Link>
            </CardContent>
          </Card>
        ) : !result.ok ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              <I18nText k="myCoaching.moksilgi.loadFailed" fallback="지금 목실기를 불러올 수 없습니다." />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="print-report-title print-only">
              <h1>
                <I18nText
                  k="myCoaching.moksilgi.reportTitle"
                  fallback="내 목실기 보고서"
                />
              </h1>
              {result.data.plan && hasText(result.data.plan.author_name) ? (
                <p>
                  <I18nText
                    k="myCoaching.moksilgi.form.author"
                    fallback="작성자"
                  />
                  : {result.data.plan.author_name}
                </p>
              ) : null}
              {result.data.plan &&
              hasText(result.data.plan.period_start) &&
              hasText(result.data.plan.period_end) ? (
                <p>
                  <I18nText
                    k="myCoaching.moksilgi.printPeriod"
                    fallback="기간"
                  />
                  : {result.data.plan.period_start} ~{" "}
                  {result.data.plan.period_end}
                </p>
              ) : null}
              <p>
                <I18nText k="myCoaching.moksilgi.printYear" fallback="출력 연도" />
                : {printYear}
              </p>
              <p>
                <I18nText k="myCoaching.moksilgi.generatedAt" fallback="생성일" />
                : {new Date().toLocaleDateString("ko-KR")}
              </p>
            </div>

            <MoksilgiPrintSummary
              areas={result.data.areas}
              coreValues={coreValues}
              detailGoals={result.data.detailGoals}
              plan={result.data.plan}
            />

            {saved ? (
              <Card className="print-hidden border-emerald-200 bg-emerald-50">
                <CardContent className="p-4 text-sm text-emerald-900">
                  <I18nText k="myCoaching.moksilgi.saved" fallback="저장되었습니다." />
                </CardContent>
              </Card>
            ) : null}
            {error ? (
              <Card className="print-hidden border-red-200 bg-red-50">
                <CardContent className="p-4 text-sm text-red-700">
                  <I18nText
                    k="myCoaching.moksilgi.saveFailed"
                    fallback="저장할 수 없습니다. 입력값을 확인해 주세요."
                  />
                </CardContent>
              </Card>
            ) : null}

            <div className="print-hidden">
              <MoksilgiProgressCard completedCount={completedSections} totalCount={6} />
              <MoksilgiSectionNav items={[...SECTION_NAV]} />

              <PlanForm
                coreValues={coreValues}
                editSection={editSection}
                plan={result.data.plan}
              />

              <section className="space-y-3" id="section-strategy">
              <Card className="border-line-base bg-surface-card">
                <CardContent className="space-y-3 p-4">
                  <h2 className="text-base font-semibold text-ink-base">
                    <I18nText
                      k="myCoaching.moksilgi.actionStrategyTitle"
                      fallback="Ⅴ. 목표에 따른 실행전략 기획안"
                    />
                  </h2>
                  <p className="rounded-control border border-line-soft bg-surface-sunken p-3 text-sm text-ink-muted">
                    세부 목표를 저장하면{" "}
                    <a
                      className="font-medium text-brand-600 underline"
                      href="/my-coaching/moksilgi/monthly"
                    >
                      월별 체크리스트
                    </a>
                    에서 매일 실행을 체크하고 달성률을 확인할 수 있습니다.
                  </p>
                  {!result.data.plan ? (
                    <p className="text-sm text-ink-base">
                      <I18nText
                        k="myCoaching.moksilgi.saveBasicInfoFirst"
                        fallback="기본 정보를 먼저 저장하면 목표 영역과 세부 목표를 작성할 수 있습니다."
                      />
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {result.data.plan ? (
                <div className="space-y-3">
                  {result.data.areas.map((area) => {
                    const detailGoals = result.data.detailGoals.filter(
                      (goal) => goal.area_id === area.id,
                    );
                    const plan = result.data.plan;

                    if (!plan) {
                      return null;
                    }

                    return (
                      <MoksilgiAreaCard
                        areaKey={area.area_key}
                        areaSubtitle={
                          <I18nText
                            k={AREA_TRANSLATION_KEY_BY_AREA_KEY[area.area_key].subtitle}
                            fallback={area.area_subtitle ?? ""}
                          />
                        }
                        areaTitle={
                          <I18nText
                            k={AREA_TRANSLATION_KEY_BY_AREA_KEY[area.area_key].title}
                            fallback={`목표 ${area.sort_order}: ${area.area_title}`}
                          />
                        }
                        detailGoalCount={detailGoals.length}
                        key={area.id}
                      >
                        {detailGoals.length > 0 ? (
                          <div className="grid gap-3">
                            {detailGoals.map((goal) => (
                              <div
                                className="rounded-card border border-line-base bg-surface-app p-4"
                                key={goal.id}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-ink-base">
                                      {goal.title}
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
                                      {displayValue(goal.description)}
                                    </p>
                                  </div>
                                  <Badge tone="neutral">
                                    {measurementLabel(goal.measurement_type)}
                                  </Badge>
                                </div>
                                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                                  <div>
                                    <dt className="font-medium text-ink-muted">
                                      <I18nText k="myCoaching.moksilgi.detailGoal.yearlyTarget" fallback="연간 목표량" />
                                    </dt>
                                    <dd>{displayValue(goal.annual_target)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-ink-muted">
                                      <I18nText k="myCoaching.moksilgi.detailGoal.monthlyTarget" fallback="월 목표량" />
                                    </dt>
                                    <dd>{displayValue(goal.monthly_target)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-ink-muted">
                                      <I18nText k="myCoaching.moksilgi.detailGoal.unit" fallback="단위" />
                                    </dt>
                                    <dd>{displayValue(goal.unit)}</dd>
                                  </div>
                                </dl>
                                <DetailGoalForm area={area} detailGoal={goal} planId={plan.id} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-ink-muted">
                            <I18nText k="myCoaching.moksilgi.noDetailGoals" fallback="아직 세부 목표가 없습니다." />
                          </p>
                        )}

                        <DetailGoalForm area={area} planId={plan.id} />
                      </MoksilgiAreaCard>
                    );
                  })}
                </div>
              ) : null}
              </section>
            </div>

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
          </>
        )}
      </section>
    </main>
  );
}
