import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getDashboardMe } from "@/lib/api/dashboard/me";
import { getDashboardQuickLinksState } from "@/lib/dashboard/quick-links";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { I18nText } from "@/lib/i18n/I18nProvider";

export const dynamic = "force-dynamic";

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function profileStatusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "inactive":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "suspended":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "archived":
      return "border-slate-300 bg-slate-50 text-slate-600";
    case "anonymized":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

const adminFeatureCards = [
  {
    href: "/admin/settings/organizations",
    descriptionKey: "dashboard.organizationSettingsDescription",
    title: "기관 및 단체 관리",
    titleKey: "dashboard.organizationSettings",
    description:
      "회원 소속 기관 및 단체를 추가하고, 국가 연결과 사용 여부를 관리합니다.",
  },
  {
    href: "/admin/settings/affiliations",
    descriptionKey: "dashboard.affiliationSettingsDescription",
    title: "소속 선택값 관리",
    titleKey: "dashboard.affiliationSettings",
    description:
      "회원정보수정에서 사용하는 지역/도시, 세부 교회, 그룹/팀/목장 선택값을 등록하고 수정합니다.",
  },
  {
    href: "/admin/coaching-genealogy",
    descriptionKey: "dashboard.genealogyDescription",
    title: "세대별 계층 계보도",
    titleKey: "dashboard.genealogy",
    description:
      "코칭 관계가 세대별, 조직별, 코치-코치이 흐름으로 어떻게 이어지는지 시각적으로 확인합니다.",
  },
];

const coachMakerFeatureCards = [
  {
    href: "/coach-maker",
    descriptionKey: "dashboard.coachMakerDashboardDescription",
    title: "코치메이커 대시보드",
    titleKey: "dashboard.coachMakerDashboard",
    description:
      "코치메이커가 담당하는 팀, 목실기 진행 현황, 코칭 구조를 확인합니다.",
  },
  {
    href: "/coach-maker/moksilgi-progress",
    descriptionKey: "dashboard.moksilgiProgressDescription",
    title: "전체 목실기 성취 현황",
    titleKey: "dashboard.moksilgiProgress",
    description:
      "코치메이커가 담당하는 지역/팀과 코치-코치이 관계의 목실기 월별 성취율을 확인합니다.",
  },
];

export default async function DashboardPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fdashboard");
  }

  const result = await getDashboardMe(session);

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fdashboard");
  }

  const authEmail = session.user.email;

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </h1>
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText k="dashboard.loadFailed" fallback="지금 대시보드를 불러올 수 없습니다." />
          </div>
        </section>
      </main>
    );
  }

  const profile = result.data.profile;
  if (profile && profile.status !== "active") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            <I18nText k="dashboard.accountStatus" fallback="계정 상태 확인" />
          </h1>
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <I18nText k="dashboard.inactiveAccount" fallback="비활성화된 계정입니다. 관리자에게 문의하세요." />
          </div>
        </section>
      </main>
    );
  }

  const roleValues = result.data.roles.map((role) => role.role);
  const quickLinks = getDashboardQuickLinksState(roleValues);
  const showSuperAdminFeatureCards = roleValues.includes("super_admin");
  const showCoachMakerFeatureCards =
    roleValues.includes("super_admin") || roleValues.includes("coach_maker");
  const welcomeName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.email ||
    authEmail ||
    "사용자";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="dashboard.title" fallback="대시보드" />
            </h1>
          </div>
          <PageNavigationButtons className="justify-start sm:justify-end" />
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">
            <I18nText k="dashboard.welcome" fallback="환영합니다" />
          </h2>
          <p className="mt-3 text-slate-700">
            <I18nText k="dashboard.hello" fallback="안녕하세요" />,{" "}
            <span className="font-medium text-slate-950">{welcomeName}</span>.
          </p>
          <p className="mt-2 text-slate-600">
            <I18nText
              k="dashboard.subtitle"
              fallback="프로필과 역할별 작업 공간으로 이동할 수 있는 기본 화면입니다."
            />
          </p>
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              <I18nText k="dashboard.profile" fallback="프로필" />
            </h2>
            <Link
              className="text-sm font-medium text-slate-700 underline"
              href="/profile"
            >
              <I18nText k="dashboard.viewProfile" fallback="프로필 보기" />
            </Link>
          </div>

          {profile === null ? (
            <div className="mt-4">
              <p className="text-slate-700">
                <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
              </p>
              <p className="mt-2 text-slate-600">
                <I18nText k="dashboard.acceptInvitationFirst" fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요." />
              </p>
            </div>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  <I18nText k="dashboard.displayName" fallback="표시 이름" />
                </dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.display_name)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  <I18nText k="members.email" fallback="이메일" />
                </dt>
                <dd className="mt-1 text-slate-950">{displayValue(profile.email)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  <I18nText k="dashboard.fullName" fallback="전체 이름" />
                </dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.full_name)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  <I18nText k="members.status" fallback="상태" />
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${profileStatusBadgeClass(
                      profile.status,
                    )}`}
                  >
                    {getStatusLabel(profile.status)}
                  </span>
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">
            <I18nText k="dashboard.myRoles" fallback="내 역할" />
          </h2>
          {result.data.roles.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-medium">
                      <I18nText k="members.role" fallback="역할" />
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <I18nText k="members.scope" fallback="범위" />
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <I18nText k="members.status" fallback="상태" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.roles.map((role) => (
                    <tr
                      className="border-b border-slate-100 text-slate-800"
                      key={`${role.role}-${role.scope_type}-${role.scope_id ?? "global"}`}
                    >
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <I18nText
                            k={`roles.${role.role}`}
                            fallback={getRoleLabel(role.role)}
                          />
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {formatScope(role.scope_type, role.scope_id)}
                      </td>
                      <td className="px-3 py-3">{getStatusLabel(role.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-slate-700">
                <I18nText k="dashboard.noActiveRole" fallback="아직 활성 역할이 배정되지 않았습니다." />
              </p>
              <p className="mt-2 text-slate-600">
                <I18nText k="dashboard.acceptInvitationFirst" fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요." />
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">
            <I18nText k="dashboard.quickLinks" fallback="바로가기" />
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <Link
              className="text-sm font-medium text-slate-700 underline"
              href="/profile"
            >
              <I18nText k="dashboard.myProfile" fallback="내 프로필" />
            </Link>

            {quickLinks.showAdminUsers && (
              <>
                <Link
                  className="text-sm font-medium text-slate-700 underline"
                  href="/admin/users"
                >
                  <I18nText k="dashboard.adminUsers" fallback="관리자: 사용자" />
                </Link>
                <Link
                  className="text-sm font-medium text-slate-700 underline"
                  href="/admin/invitations"
                >
                  <I18nText k="dashboard.adminInvitations" fallback="관리자: 초대" />
                </Link>
              </>
            )}

            {quickLinks.showCoachLink && (
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/coach"
              >
                <I18nText k="dashboard.coachWorkspace" fallback="코치 작업 공간" />
              </Link>
            )}

            {quickLinks.showMyCoachingLink && (
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/my-coaching"
              >
                <I18nText k="dashboard.myCoachingSpace" fallback="내 코칭 공간" />
              </Link>
            )}

            {quickLinks.showCoacheeMessage && (
              <div className="text-slate-700">
                <p>
                  <I18nText k="dashboard.coachingSpacePreparing" fallback="코칭 공간이 준비 중입니다." />
                </p>
                <Link
                  className="mt-2 inline-block text-sm font-medium text-slate-700 underline"
                  href="/profile"
                >
                  <I18nText k="dashboard.checkProfile" fallback="프로필 확인하기" />
                </Link>
              </div>
            )}

            {quickLinks.showNoRoleMessage && (
              <div className="text-slate-700">
                <p>
                  <I18nText k="dashboard.noActiveRole" fallback="아직 활성 역할이 배정되지 않았습니다." />
                </p>
                <p className="mt-2 text-slate-600">
                  <I18nText k="dashboard.acceptInvitationFirst" fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요." />
                </p>
              </div>
            )}
          </div>
        </section>

        {showCoachMakerFeatureCards ? (
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold">
                <I18nText
                  k="dashboard.coachMakerFeatures"
                  fallback="코치메이커 기능"
                />
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <I18nText
                  k="dashboard.coachMakerFeaturesDescription"
                  fallback="코치메이커 대시보드와 전체 목실기 성취 현황으로 바로 이동합니다."
                />
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coachMakerFeatureCards.map((card) => (
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                  href={card.href}
                  key={card.href}
                >
                  <h3 className="font-semibold text-slate-950">
                    <I18nText k={card.titleKey} fallback={card.title} />
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText k={card.descriptionKey} fallback={card.description} />
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {showSuperAdminFeatureCards ? (
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold">
                <I18nText k="dashboard.adminFeatures" fallback="관리자 기능" />
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <I18nText
                  k="dashboard.adminFeaturesDescription"
                  fallback="최고관리자가 자주 확인하는 관리 화면으로 바로 이동합니다."
                />
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adminFeatureCards.map((card) => (
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                  href={card.href}
                  key={card.href}
                >
                  <h3 className="font-semibold text-slate-950">
                    <I18nText k={card.titleKey} fallback={card.title} />
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText k={card.descriptionKey} fallback={card.description} />
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
