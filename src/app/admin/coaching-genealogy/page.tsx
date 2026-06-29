import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout";
import {
  getAdminCoachingGenealogy,
  parseGenealogyFilters,
} from "@/lib/api/admin/coaching-genealogy";
import { createApiPerformanceLogger } from "@/lib/performance";
import { CoachingGenealogyClient } from "./CoachingGenealogyClient";


const VALID_VIEWS = ["tree", "map", "assign", "history"] as const;
type GenealogyView = (typeof VALID_VIEWS)[number];

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeView(value: string | string[] | undefined): GenealogyView {
  const firstValue = getFirstParam(value);

  return VALID_VIEWS.includes(firstValue as GenealogyView)
    ? (firstValue as GenealogyView)
    : "tree";
}

function buildFilterParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const key of [
    "countryId",
    "regionId",
    "organizationId",
    "churchId",
    "generationNumber",
    "coachProfileId",
    "status",
  ]) {
    const value = getFirstParam(searchParams[key]);

    if (value && value.trim().length > 0) {
      params.set(key, value);
    }
  }

  return params;
}

export default async function AdminCoachingGenealogyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perf = createApiPerformanceLogger("/admin/coaching-genealogy");
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const view = normalizeView(resolvedSearchParams.view);
  const filterParams = buildFilterParams(resolvedSearchParams);
  const result = await getAdminCoachingGenealogy(
    parseGenealogyFilters(filterParams),
    perf,
  );

  if (!result.ok) {
    if (result.status === 401) {
      redirect("/login?redirectTo=%2Fadmin%2Fcoaching-genealogy");
    }

    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-7xl">
        <PageHeader
          title="세대별 코칭 계보도"
          description="활성 코치-코치이 관계를 기준으로 세대 흐름과 지역별 현황을 확인합니다. 개인 일지 본문은 이 화면에서 조회하지 않습니다."
        />

        <CoachingGenealogyClient data={result.data} view={view} />
      </section>
    </main>
  );
}
