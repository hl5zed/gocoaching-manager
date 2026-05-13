import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import {
  createAdminCoachingRelationship,
  getAdminCoachingRelationshipOptions,
  type RelationshipProfileOption,
} from "@/lib/api/admin/coaching-relationships";
import {
  RELATIONSHIP_TYPES,
  SCOPE_TYPES,
  type RelationshipType,
  type ScopeType,
} from "@/types/database";
import {
  getRelationshipTypeLabel,
  getScopeTypeLabel,
} from "@/lib/ui/labels";
import { isValidDate, isValidUuid, normalizeText } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatProfileOptionLabel(profile: RelationshipProfileOption) {
  return profile.displayName || profile.fullName || profile.email || profile.id;
}

function formatRelationshipType(type: RelationshipType) {
  return getRelationshipTypeLabel(type);
}

function formatScopeType(type: ScopeType) {
  return getScopeTypeLabel(type);
}

export default async function NewAdminCoachingRelationshipPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fadmin%2Fcoaching-relationships%2Fnew");
  }

  const optionsResult = await getAdminCoachingRelationshipOptions();

  if (!optionsResult.ok && optionsResult.error.status === 401) {
    redirect("/login?redirectTo=%2Fadmin%2Fcoaching-relationships%2Fnew");
  }

  if (
    !optionsResult.ok &&
    (optionsResult.error.status === 403 ||
      optionsResult.error.code === "ADMIN_ROLE_REQUIRED" ||
      optionsResult.error.code === "ADMIN_PROFILE_REQUIRED")
  ) {
    redirect("/unauthorized");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  async function createRelationship(formData: FormData) {
    "use server";

    const coachProfileId = normalizeText(formData.get("coach_profile_id"));
    const coacheeProfileId = normalizeText(formData.get("coachee_profile_id"));
    const scopeTypeValue = normalizeText(formData.get("scope_type"));
    const scopeId = normalizeText(formData.get("scope_id"));
    const startedAt = normalizeText(formData.get("started_at"));

    if (!isValidUuid(coachProfileId)) {
      redirect(
        "/admin/coaching-relationships/new?error=%EC%BD%94%EC%B9%98%EB%A5%BC%20%EC%84%A0%ED%83%9D%ED%95%B4%20%EC%A3%BC%EC%84%B8%EC%9A%94.",
      );
    }

    if (!isValidUuid(coacheeProfileId)) {
      redirect(
        "/admin/coaching-relationships/new?error=%EC%BD%94%EC%B9%98%EC%9D%B4%EB%A5%BC%20%EC%84%A0%ED%83%9D%ED%95%B4%20%EC%A3%BC%EC%84%B8%EC%9A%94.",
      );
    }

    if (coachProfileId === coacheeProfileId) {
      redirect(
        "/admin/coaching-relationships/new?error=%EC%BD%94%EC%B9%98%EC%99%80%20%EC%BD%94%EC%B9%98%EC%9D%B4%EB%8A%94%20%EA%B0%99%EC%9D%84%20%EC%88%98%20%EC%97%86%EC%8A%B5%EB%8B%88%EB%8B%A4.",
      );
    }

    if (scopeTypeValue !== "global" && scopeId && !isValidUuid(scopeId)) {
      redirect(
        "/admin/coaching-relationships/new?error=%EB%B2%94%EC%9C%84%20ID%EB%8A%94%20%EC%98%AC%EB%B0%94%EB%A5%B8%20UUID%EC%97%AC%EC%95%BC%20%ED%95%A9%EB%8B%88%EB%8B%A4.",
      );
    }

    if (startedAt && !isValidDate(startedAt)) {
      redirect(
        "/admin/coaching-relationships/new?error=%EC%8B%9C%EC%9E%91%EC%9D%BC%20%ED%98%95%EC%8B%9D%EC%9D%B4%20%EC%98%AC%EB%B0%94%EB%A5%B4%EC%A7%80%20%EC%95%8A%EC%8A%B5%EB%8B%88%EB%8B%A4.",
      );
    }

    const createResult = await createAdminCoachingRelationship({
      coach_profile_id: coachProfileId,
      coachee_profile_id: coacheeProfileId,
      relationship_type: formData.get("relationship_type"),
      scope_type: scopeTypeValue,
      scope_id: scopeId,
      started_at: startedAt,
    });

    if (!createResult.ok) {
      const nextError = encodeURIComponent(createResult.error.message);
      redirect(`/admin/coaching-relationships/new?error=${nextError}`);
    }

    redirect("/coach/relationships");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          관리자
        </p>
        <h1 className="mt-3 text-3xl font-semibold">코칭 관계 생성</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          코치와 코치이를 선택해 새로운 활성 코칭 관계를 생성합니다.
        </p>

        <div className="mt-6">
          <Link
            className="text-sm font-medium text-slate-700 underline"
            href="/admin/users"
          >
            관리자 사용자로 돌아가기
          </Link>
        </div>

        {!optionsResult.ok ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 코칭 관계 생성 옵션을 불러올 수 없습니다.
          </section>
        ) : (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            {errorMessage && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                {errorMessage}
              </div>
            )}

            {optionsResult.data.coachees.length === 0 && (
              <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
                사용 가능한 코치이가 없습니다. 먼저 코치이를 초대해 주세요.
              </div>
            )}

            <form action={createRelationship} className="space-y-5">
              <div>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="coach_profile_id"
                >
                  코치
                </label>
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                  defaultValue=""
                  id="coach_profile_id"
                  name="coach_profile_id"
                  required
                >
                  <option value="">코치를 선택하세요</option>
                  {optionsResult.data.coaches.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {formatProfileOptionLabel(profile)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="coachee_profile_id"
                >
                  코치이
                </label>
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
                  defaultValue=""
                  disabled={optionsResult.data.coachees.length === 0}
                  id="coachee_profile_id"
                  name="coachee_profile_id"
                  required
                >
                  <option value="">코치이를 선택하세요</option>
                  {optionsResult.data.coachees.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {formatProfileOptionLabel(profile)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="relationship_type"
                  >
                    관계 유형
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                    defaultValue="individual_coaching"
                    id="relationship_type"
                    name="relationship_type"
                  >
                    {RELATIONSHIP_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatRelationshipType(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="scope_type"
                  >
                    범위 유형
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                    defaultValue="global"
                    id="scope_type"
                    name="scope_type"
                  >
                    {SCOPE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatScopeType(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="scope_id"
                  >
                    범위 ID (선택)
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                    id="scope_id"
                    name="scope_id"
                    placeholder="전체 범위이면 비워 두세요"
                    type="text"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="started_at"
                  >
                    시작일 (선택)
                  </label>
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                    id="started_at"
                    name="started_at"
                    type="date"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-md bg-slate-950 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={optionsResult.data.coachees.length === 0}
                  type="submit"
                >
                  코칭 관계 생성
                </button>
                <Link
                  className="rounded-md border border-slate-300 px-5 py-2.5 font-medium text-slate-700"
                  href="/admin/users"
                >
                  취소
                </Link>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
