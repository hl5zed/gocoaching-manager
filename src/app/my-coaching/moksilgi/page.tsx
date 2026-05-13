import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintPageButton } from "@/components/print/PrintPageButton";
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

export const dynamic = "force-dynamic";

const MEASUREMENT_OPTIONS: Array<{
  value: MoksilgiMeasurementType;
  label: string;
}> = [
  { value: "daily_check", label: "매일 실행 확인" },
  { value: "weekly_count", label: "매주 실행 확인" },
  { value: "monthly_number", label: "월간 수치 입력" },
  { value: "monthly_comment", label: "COMMENT" },
];

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

function measurementLabel(value: string) {
  return (
    MEASUREMENT_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

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
  type = "text",
}: {
  label: string;
  name: string;
  value?: string | number | null;
  maxLength?: number;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
        defaultValue={fieldValue(value)}
        maxLength={maxLength}
        name={name}
        type={type}
      />
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
  label: string;
  name: string;
  value?: string | null;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
        defaultValue={value ?? ""}
        maxLength={maxLength}
        name={name}
        rows={rows}
      />
    </label>
  );
}

function PlanForm({
  plan,
  coreValues,
}: {
  plan: MoksilgiPlan | null;
  coreValues: MoksilgiCoreValue[];
}) {
  const visibleCoreValues = [...coreValues];

  while (visibleCoreValues.length < 5) {
    visibleCoreValues.push({
      value_name: "",
      meaning: "",
      practice_example: "",
    });
  }

  return (
    <form action={savePlanAction} className="space-y-6">
      <input name="plan_id" type="hidden" value={plan?.id ?? ""} />

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">기본 정보</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextInput label="제목" maxLength={160} name="title" value={plan?.title ?? "목표와 실행전략 기획안"} />
          <TextInput label="부제" maxLength={160} name="subtitle" value={plan?.subtitle ?? "목실기와 체크리스트"} />
          <TextInput label="기간 시작일" name="period_start" type="date" value={plan?.period_start} />
          <TextInput label="기간 종료일" name="period_end" type="date" value={plan?.period_end} />
          <TextInput label="작성일" name="written_at" type="date" value={plan?.written_at} />
          <TextInput label="작성자" maxLength={120} name="author_name" value={plan?.author_name} />
          <TextInput label="지역/목장" maxLength={120} name="region_name" value={plan?.region_name} />
          <TextInput label="지역팀장" maxLength={120} name="regional_leader_name" value={plan?.regional_leader_name} />
          <TextInput label="코치" maxLength={120} name="coach_name" value={plan?.coach_name} />
          <TextInput label="직책" maxLength={80} name="role_label" value={plan?.role_label} />
          <TextInput label="세대" maxLength={80} name="generation_label" value={plan?.generation_label} />
          <input name="team_name" type="hidden" value={plan?.team_name ?? ""} />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Ⅰ. 사명선언서 (Mission)</h2>
        <div className="mt-5 grid gap-4">
          <TextArea label="사명선언 문장" maxLength={3000} name="mission_statement" value={plan?.mission_statement} />
          <TextInput label="관련 성경구절" maxLength={120} name="mission_bible_verse" value={plan?.mission_bible_verse} />
          <TextArea label="사명 설명" maxLength={4000} name="mission_description" value={plan?.mission_description} />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Ⅱ. 비전 (Vision)</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextInput label="비전 목표 연도" name="vision_year" type="number" value={plan?.vision_year} />
          <TextInput label="핵심 수치" maxLength={1000} name="vision_metrics" value={plan?.vision_metrics} />
          <TextInput label="대상" maxLength={1000} name="vision_target" value={plan?.vision_target} />
        </div>
        <div className="mt-4 grid gap-4">
          <TextArea label="비전 문장" maxLength={3000} name="vision_statement" value={plan?.vision_statement} />
          <TextArea label="비전 설명" maxLength={4000} name="vision_description" value={plan?.vision_description} />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Ⅲ. 핵심가치 (Core Value)</h2>
        <div className="mt-5 grid gap-4">
          {visibleCoreValues.slice(0, 5).map((value, index) => (
            <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 md:grid-cols-3" key={index}>
              <TextInput label="가치명" maxLength={120} name={`core_value_name_${index}`} value={value.value_name} />
              <TextInput label="의미" maxLength={1000} name={`core_value_meaning_${index}`} value={value.meaning} />
              <TextInput label="실천 모습" maxLength={1000} name={`core_value_practice_${index}`} value={value.practice_example} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Ⅳ. 목표</h2>
        <div className="mt-5 grid gap-4">
          <TextArea label="전체 목표 문장" maxLength={1000} name="main_goal" value={plan?.main_goal} />
          <TextArea label="목표 설명" maxLength={3000} name="main_goal_description" value={plan?.main_goal_description} />
        </div>
      </section>

      <input name="status" type="hidden" value={plan?.status ?? "draft"} />
      <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" type="submit">
        기본 정보 저장
      </button>
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
    <form action={saveDetailGoalAction} className="mt-4 grid gap-4 rounded-md border border-slate-200 bg-white p-4">
      <input name="plan_id" type="hidden" value={planId} />
      <input name="area_id" type="hidden" value={area.id} />
      <input name="detail_goal_id" type="hidden" value={detailGoal?.id ?? ""} />
      <TextInput label="세부 목표 제목" maxLength={300} name="detail_title" value={detailGoal?.title} />
      <TextArea label="세부 목표 설명" maxLength={3000} name="detail_description" rows={3} value={detailGoal?.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput label="연간 목표량" name="annual_target" type="number" value={detailGoal?.annual_target} />
        <TextInput label="월 목표량" name="monthly_target" type="number" value={detailGoal?.monthly_target} />
        <TextInput label="단위" maxLength={40} name="unit" value={detailGoal?.unit} />
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">측정 방식</span>
        <select
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
          defaultValue={detailGoal?.measurement_type ?? "monthly_number"}
          name="measurement_type"
        >
          {MEASUREMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((index) => (
          <TextInput
            key={index}
            label={`실행전략 ${index}`}
            maxLength={1000}
            name={`strategy_${index}`}
            value={strategies[index - 1] ?? ""}
          />
        ))}
      </div>
      <button className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" type="submit">
        세부 목표 저장
      </button>
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
  const printYear = new Date().getFullYear();

  return (
    <main className="print-root min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <div className="print-report-title print-only">
          <h1>내 목실기 보고서</h1>
          <p>출력 연도: {printYear}년</p>
          <p>생성일: {new Date().toLocaleDateString("ko-KR")}</p>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              목실기 작성
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              목표와 실행전략 기획안
            </h1>
            <p className="mt-2 text-xl text-slate-700">목실기와 체크리스트</p>
            <p className="mt-3 max-w-3xl text-slate-600">
              사명선언서, 비전, 핵심가치, 목표와 실행전략을 작성합니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <PrintPageButton
              fileName={`moksilgi-my-record-${printYear}`}
              label="내 목실기 출력"
            />
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              내 코칭 공간으로 돌아가기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              대시보드
            </Link>
          </div>
        </div>

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
            <Link className="mt-4 inline-block text-sm font-medium text-slate-700 underline" href="/profile">
              프로필 보기
            </Link>
          </section>
        ) : !result.ok ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 목실기를 불러올 수 없습니다.
          </section>
        ) : (
          <div className="mt-8 space-y-6">
            {saved ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                저장되었습니다.
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                저장할 수 없습니다. 입력값을 확인해 주세요.
              </div>
            ) : null}

            <PlanForm
              coreValues={coreValuesFromPlan(
                result.data.plan,
                result.data.defaultCoreValues,
              )}
              plan={result.data.plan}
            />

            <section className="rounded-md border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                Ⅴ. 목표에 따른 실행전략 기획안
              </h2>
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                월별 체크리스트와 달성률 계산은 다음 단계에서 추가됩니다.
              </p>

              {!result.data.plan ? (
                <p className="mt-5 text-slate-700">
                  기본 정보를 먼저 저장하면 목표 영역과 세부 목표를 작성할 수 있습니다.
                </p>
              ) : (() => {
                const plan = result.data.plan;

                return (
                  <div className="mt-5 grid gap-5">
                    {result.data.areas.map((area) => {
                      const detailGoals = result.data.detailGoals.filter(
                        (goal) => goal.area_id === area.id,
                      );

                      return (
                        <article className="rounded-md border border-slate-200 bg-slate-50 p-5" key={area.id}>
                        <h3 className="text-lg font-semibold">
                          목표 {area.sort_order}: {area.area_title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {area.area_subtitle}
                        </p>

                        {detailGoals.length > 0 ? (
                          <div className="mt-4 grid gap-3">
                            {detailGoals.map((goal) => (
                              <div className="rounded-md border border-slate-200 bg-white p-4" key={goal.id}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-950">
                                      {goal.title}
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                      {displayValue(goal.description)}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {measurementLabel(goal.measurement_type)}
                                  </span>
                                </div>
                                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                                  <div>
                                    <dt className="font-medium text-slate-500">연간 목표량</dt>
                                    <dd>{displayValue(goal.annual_target)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-slate-500">월 목표량</dt>
                                    <dd>{displayValue(goal.monthly_target)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-slate-500">단위</dt>
                                    <dd>{displayValue(goal.unit)}</dd>
                                  </div>
                                </dl>
                                <DetailGoalForm area={area} detailGoal={goal} planId={plan.id} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-600">
                            아직 세부 목표가 없습니다.
                          </p>
                        )}

                        <DetailGoalForm area={area} planId={plan.id} />
                      </article>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
