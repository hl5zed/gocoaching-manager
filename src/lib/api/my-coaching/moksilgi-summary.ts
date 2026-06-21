import { getMoksilgiContext, type ServiceClient } from "./context";
import type { MoksilgiAreaKey, Tables } from "@/types/database";

type SafeError = {
  code:
    | "UNAUTHORIZED"
    | "PROFILE_NOT_FOUND"
    | "PROFILE_QUERY_FAILED"
    | "MOKSILGI_QUERY_FAILED"
    | "VALIDATION_FAILED";
  message: string;
};
type PlanRow = Pick<Tables<"moksilgi_plans">, "id" | "profile_id" | "title">;
type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "id"
  | "plan_id"
  | "profile_id"
  | "year"
  | "month"
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
  | "total_rate"
  | "average_rate"
>;
type DetailGoalAreaRow = Pick<Tables<"moksilgi_goal_areas">, "id" | "area_key"> & {
  moksilgi_detail_goals: Array<Pick<Tables<"moksilgi_detail_goals">, "id">>;
};

export type MoksilgiPersonalSummaryRow = {
  month: number | "cumulative";
  monthLabel: string;
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
  other_rate: number;
  total_rate: number;
  average_rate: number;
};

export type MoksilgiPersonalSummaryResult =
  | {
      ok: true;
      data: {
        plan: PlanRow | null;
        rows: MoksilgiPersonalSummaryRow[];
        cumulativeRow: MoksilgiPersonalSummaryRow;
        totalAchievementRate: number;
        hasSummaryData: boolean;
        year: number;
      };
    }
  | { ok: false; error: SafeError };

const SUMMARY_SELECT =
  "id, plan_id, profile_id, year, month, spiritual_rate, intellectual_rate, physical_rate, social_rate, other_rate, total_rate, average_rate";
const AREA_KEYS: MoksilgiAreaKey[] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
  "other",
];

function validateYear(year: number): SafeError | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { code: "VALIDATION_FAILED", message: "연도가 올바르지 않습니다." };
  }

  return null;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summaryValue(
  summary: SummaryRow | undefined,
  key:
    | "spiritual_rate"
    | "intellectual_rate"
    | "physical_rate"
    | "social_rate"
    | "other_rate"
    | "total_rate"
    | "average_rate",
) {
  return safeNumber(summary?.[key]);
}

async function getOwnedPlan(client: ServiceClient, profileId: string) {
  return client
    .from("moksilgi_plans")
    .select("id, profile_id, title")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

function buildMonthRows(summaries: SummaryRow[]) {
  const summaryByMonth = new Map(summaries.map((summary) => [summary.month, summary]));

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const summary = summaryByMonth.get(month);

    return {
      month,
      monthLabel: `${month}월`,
      spiritual_rate: summaryValue(summary, "spiritual_rate"),
      intellectual_rate: summaryValue(summary, "intellectual_rate"),
      physical_rate: summaryValue(summary, "physical_rate"),
      social_rate: summaryValue(summary, "social_rate"),
      other_rate: summaryValue(summary, "other_rate"),
      total_rate: summaryValue(summary, "total_rate"),
      average_rate: summaryValue(summary, "average_rate"),
    } satisfies MoksilgiPersonalSummaryRow;
  });
}

function buildCumulativeRow(
  monthRows: MoksilgiPersonalSummaryRow[],
  activeAreaKeys: MoksilgiAreaKey[],
) {
  const spiritualRate = average(monthRows.map((row) => row.spiritual_rate));
  const intellectualRate = average(monthRows.map((row) => row.intellectual_rate));
  const physicalRate = average(monthRows.map((row) => row.physical_rate));
  const socialRate = average(monthRows.map((row) => row.social_rate));
  const otherRate = average(monthRows.map((row) => row.other_rate));
  const areaRates: Record<MoksilgiAreaKey, number> = {
    spiritual: spiritualRate,
    intellectual: intellectualRate,
    physical: physicalRate,
    social: socialRate,
    other: otherRate,
  };
  const activeRates = activeAreaKeys.map((key) => areaRates[key]);
  const totalRate = AREA_KEYS.reduce((sum, key) => sum + areaRates[key], 0);
  const averageRate = activeRates.length > 0 ? average(activeRates) : 0;

  return {
    month: "cumulative",
    monthLabel: "누적",
    spiritual_rate: spiritualRate,
    intellectual_rate: intellectualRate,
    physical_rate: physicalRate,
    social_rate: socialRate,
    other_rate: otherRate,
    total_rate: totalRate,
    average_rate: averageRate,
  } satisfies MoksilgiPersonalSummaryRow;
}

export async function getMyMoksilgiSummary(
  year: number,
  options?: { profileId?: string },
): Promise<MoksilgiPersonalSummaryResult> {
  const validation = validateYear(year);
  if (validation) return { ok: false, error: validation };

  const context = await getMoksilgiContext({
    logTag: "MOKSILGI_SUMMARY_SERVICE_CLIENT_UNAVAILABLE",
    serviceClientUnavailableMessage: "지금 개인 성취표를 불러올 수 없습니다.",
    ...(options?.profileId ? { profileId: options.profileId } : {}),
  });
  if (!context.ok) return { ok: false, error: context.error };

  const { data: plan, error: planError } = await getOwnedPlan(
    context.serviceClient,
    context.profileId,
  );

  if (planError) {
    return {
      ok: false,
      error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기 정보를 불러올 수 없습니다." },
    };
  }

  const ownedPlan = plan as PlanRow | null;

  if (!ownedPlan) {
    const rows = buildMonthRows([]);
    const cumulativeRow = buildCumulativeRow(rows, AREA_KEYS);

    return {
      ok: true,
      data: {
        plan: null,
        rows,
        cumulativeRow,
        totalAchievementRate: 0,
        hasSummaryData: false,
        year,
      },
    };
  }

  const [summariesResult, areasResult] = await Promise.all([
    context.serviceClient
      .from("moksilgi_monthly_summaries")
      .select(SUMMARY_SELECT)
      .eq("plan_id", ownedPlan.id)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .is("deleted_at", null)
      .order("month", { ascending: true }),
    context.serviceClient
      .from("moksilgi_goal_areas")
      .select("id, area_key, moksilgi_detail_goals!inner(id)")
      .eq("plan_id", ownedPlan.id)
      .is("deleted_at", null)
      .is("moksilgi_detail_goals.deleted_at", null),
  ]);

  if (summariesResult.error || areasResult.error) {
    return {
      ok: false,
      error: { code: "MOKSILGI_QUERY_FAILED", message: "개인 성취표를 불러올 수 없습니다." },
    };
  }

  const summaries = (summariesResult.data ?? []) as SummaryRow[];
  const areas = (areasResult.data ?? []) as DetailGoalAreaRow[];
  const activeAreaKeys = [
    ...new Set(
      areas
        .filter((area) => area.moksilgi_detail_goals.length > 0)
        .map((area) => area.area_key),
    ),
  ];
  const rows = buildMonthRows(summaries);
  const cumulativeRow = buildCumulativeRow(
    rows,
    activeAreaKeys.length > 0 ? activeAreaKeys : AREA_KEYS,
  );

  return {
    ok: true,
    data: {
      plan: ownedPlan,
      rows,
      cumulativeRow,
      totalAchievementRate: cumulativeRow.average_rate,
      hasSummaryData: summaries.length > 0,
      year,
    },
  };
}
