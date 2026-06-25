import {
  buildMoksilgiCumulativeRow,
  buildMoksilgiMonthRows,
  MOKSILGI_AREA_KEYS,
  resolveActiveAreaKeys,
  type MoksilgiYearSummaryRow,
} from "@/lib/coaching/moksilgi-year-summary";
import { getMoksilgiContext, type ServiceClient } from "./context";
import type { Tables } from "@/types/database";

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

export type MoksilgiPersonalSummaryRow = MoksilgiYearSummaryRow;

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

function validateYear(year: number): SafeError | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { code: "VALIDATION_FAILED", message: "연도가 올바르지 않습니다." };
  }

  return null;
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
    const rows = buildMoksilgiMonthRows([]);
    const cumulativeRow = buildMoksilgiCumulativeRow(rows, MOKSILGI_AREA_KEYS);

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
  const activeAreaKeys = resolveActiveAreaKeys(
    areas.map((area) => ({ id: area.id, area_key: area.area_key })),
    areas.flatMap((area) =>
      area.moksilgi_detail_goals.map(() => ({ area_id: area.id })),
    ),
  );
  const rows = buildMoksilgiMonthRows(summaries);
  const cumulativeRow = buildMoksilgiCumulativeRow(rows, activeAreaKeys);

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
