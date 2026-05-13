import Link from "next/link";
import { redirect } from "next/navigation";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import {
  getAdminCoachingGenealogy,
  parseGenealogyFilters,
} from "@/lib/api/admin/coaching-genealogy";
import { CoachingGenealogyClient } from "./CoachingGenealogyClient";

export const dynamic = "force-dynamic";

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
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const view = normalizeView(resolvedSearchParams.view);
  const filterParams = buildFilterParams(resolvedSearchParams);
  const result = await getAdminCoachingGenealogy(
    parseGenealogyFilters(filterParams),
  );

  if (!result.ok) {
    if (result.status === 401) {
      redirect("/login?redirectTo=%2Fadmin%2Fcoaching-genealogy");
    }

    redirect("/unauthorized");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              관리자
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              세대별 코칭 계보도
            </h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              활성 코치-코치이 관계를 기준으로 세대 흐름과 지역별 현황을
              확인합니다. 개인 일지 본문은 이 화면에서 조회하지 않습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PageNavigationButtons className="justify-start sm:justify-end" />
            <Link
              className="inline-flex rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              href="/admin"
            >
              관리자 대시보드
            </Link>
          </div>
        </div>

        <CoachingGenealogyClient data={result.data} view={view} />
      </section>
    </main>
  );
}
