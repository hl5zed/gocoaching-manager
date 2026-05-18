import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getDashboardMe } from "@/lib/api/dashboard/me";
import { getDashboardQuickLinksState } from "@/lib/dashboard/quick-links";
import { getActiveAnnouncementsForCurrentUser } from "@/lib/api/admin/system-announcements";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { createApiPerformanceLogger } from "@/lib/performance";

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

const coachMakerFeatureCards = [
  {
    href: "/coach-maker",
    descriptionKey: "dashboard.coachMakerCenterDescription",
    title: "코치메이커 센터",
    titleKey: "dashboard.coachMakerCenter",
    description:
      "담당 코치와 코치이의 성장 현황과 목실기 진행 상황을 관리합니다.",
  },
  {
    href: "/coach-maker/moksilgi-progress",
    descriptionKey: "dashboard.moksilgiProgressDescription",
    title: "전체 목실기 성취 현황",
    titleKey: "dashboard.moksilgiProgress",
    description:
      "코치메이커가 담당하는 지역/팀과 코치-코치이 관계의 목실기 월별 성취율을 확인합니다.",
  },
  {
    href: "/my-coaching/moksilgi",
    descriptionKey: "dashboard.myMoksilgiDescription",
    title: "나의 목실기",
    titleKey: "dashboard.myMoksilgi",
    description: "내 목실기 목표와 실행전략을 작성하고 점검합니다.",
  },
  {
    href: "/my-coaching/records",
    descriptionKey: "dashboard.myRecordsDescription",
    title: "나의 기록",
    titleKey: "dashboard.myRecords",
    description: "하루기록, 주간기록, 월간기록을 확인하고 작성합니다.",
  },
];

export default async function DashboardPage() {
  const perf = createApiPerformanceLogger("/dashboard");
  const session = await getSession();

  if (!session.user) {
    perf.mark("auth.session_missing");
    redirect("/login?redirectTo=%2Fdashboard");
  }

  const result = await getDashboardMe(session, perf);

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    perf.mark("auth.session_missing");
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
  const showAdminCenterCard = roleValues.includes("super_admin");
  const showMyMoksilgiCard =
    roleValues.includes("coach") || roleValues.includes("coachee");
  const showCoachMakerFeatureCards =
    roleValues.includes("super_admin") || roleValues.includes("coach_maker");
  const welcomeName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.email ||
    authEmail ||
    "사용자";
  const dashboardAnnouncements = await getActiveAnnouncementsForCurrentUser({
    placement: "dashboard",
    roles: roleValues,
  });
  perf.mark("dashboard.announcements_query", dashboardAnnouncements.length);
  perf.mark("dashboard.complete", 1);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              <I18nText k="dashboard.personalHomeBadge" fallback="개인 홈" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="dashboard.title" fallback="나의 홈" />
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
              fallback="내 역할에 맞는 코칭 기록, 목실기, 담당 현황으로 이동하는 개인 시작 화면입니다."
            />
          </p>
        </section>

        {dashboardAnnouncements.length > 0 ? (
          <section className="mt-6 grid gap-3">
            {dashboardAnnouncements.map((announcement) => (
              <article
                className="rounded-md border border-sky-200 bg-sky-50 p-5 text-slate-950"
                key={announcement.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700">
                    시스템 공지
                  </span>
                  {announcement.audience === "admin" ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      관리자 전용
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 break-words text-base font-semibold">
                  {announcement.title}
                </h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                  {announcement.body}
                </p>
              </article>
            ))}
          </section>
        ) : null}

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
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/admin"
              >
                <I18nText k="dashboard.adminCenter" fallback="관리자 센터" />
              </Link>
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

            {showMyMoksilgiCard ? (
              <Link
                className="rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                href="/my-coaching/moksilgi"
              >
                <h3 className="break-words font-semibold text-slate-950">
                  <I18nText k="dashboard.myMoksilgi" fallback="나의 목실기" />
                </h3>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  <I18nText
                    k="dashboard.myMoksilgiDescription"
                    fallback="내 목실기 목표와 실행전략을 작성하고 점검합니다."
                  />
                </p>
              </Link>
            ) : null}

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
                  fallback="코치메이커 센터, 전체 목실기 성취 현황, 나의 목실기와 나의 기록으로 바로 이동합니다."
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

        {showAdminCenterCard ? (
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold">
                <I18nText k="dashboard.adminCenter" fallback="관리자 센터" />
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <I18nText
                  k="dashboard.adminCenterDescription"
                  fallback="회원, 초대, 역할, 소속, 시스템 설정을 관리하는 관리자 전용 공간으로 이동합니다."
                />
              </p>
            </div>
            <Link
              className="mt-4 block rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
              href="/admin"
            >
              <h3 className="font-semibold text-slate-950">
                <I18nText k="dashboard.adminCenter" fallback="관리자 센터" />
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <I18nText
                  k="dashboard.adminCenterDescription"
                  fallback="회원, 초대, 역할, 소속, 시스템 설정을 관리하는 관리자 전용 공간으로 이동합니다."
                />
              </p>
            </Link>
          </section>
        ) : null}
      </section>
    </main>
  );
}
