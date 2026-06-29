import Link from "next/link";
import { redirect } from "next/navigation";
import { CoacheeActionHub } from "@/components/dashboard/CoacheeActionHub";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getSession } from "@/lib/auth/getSession";
import { getDashboardMe } from "@/lib/api/dashboard/me";
import { getDashboardQuickLinksState } from "@/lib/dashboard/quick-links";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";
import { createApiPerformanceLogger } from "@/lib/performance";
import type { ProfileStatus, UserRole } from "@/types/database";


function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function profileStatusTone(status: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "suspended":
      return "warning" as const;
    case "anonymized":
      return "danger" as const;
    case "inactive":
    case "archived":
    default:
      return "neutral" as const;
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
    icon: "users" as IconName,
  },
  {
    href: "/coach-maker/moksilgi-progress",
    descriptionKey: "dashboard.moksilgiProgressDescription",
    title: "전체 목실기 성취 현황",
    titleKey: "dashboard.moksilgiProgress",
    description:
      "코치메이커가 담당하는 지역/팀과 코치-코치이 관계의 목실기 월별 성취율을 확인합니다.",
    icon: "report" as IconName,
  },
  {
    href: "/my-coaching/moksilgi",
    descriptionKey: "dashboard.myMoksilgiDescription",
    title: "나의 목실기",
    titleKey: "dashboard.myMoksilgi",
    description: "내 목실기 목표와 실행전략을 작성하고 점검합니다.",
    icon: "report" as IconName,
  },
  {
    href: "/my-coaching/records",
    descriptionKey: "dashboard.myRecordsDescription",
    title: "나의 기록",
    titleKey: "dashboard.myRecords",
    description: "하루기록, 주간기록, 월간기록을 확인하고 작성합니다.",
    icon: "dashboard" as IconName,
  },
];

function QuickLinkTile({
  href,
  icon,
  labelKey,
  fallback,
}: {
  href: string;
  icon: IconName;
  labelKey: string;
  fallback: string;
}) {
  return (
    <Link
      className="flex flex-col items-center gap-2 rounded-xl border border-line-base bg-surface-app p-4 text-center transition hover:border-brand-200 hover:bg-brand-50"
      href={href}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-card text-brand-600">
        <Icon className="h-5 w-5" name={icon} />
      </span>
      <span className="text-sm font-medium text-ink-base">
        <I18nText k={labelKey} fallback={fallback} />
      </span>
    </Link>
  );
}

function FeatureLinkCard({
  description,
  descriptionKey,
  href,
  icon,
  title,
  titleKey,
}: {
  href: string;
  titleKey: string;
  title: string;
  descriptionKey: string;
  description: string;
  icon: IconName;
}) {
  return (
    <Link
      className="flex h-full flex-col rounded-xl border border-line-base bg-surface-app p-4 transition hover:border-brand-200 hover:bg-brand-50"
      href={href}
    >
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-card text-brand-600">
        <Icon className="h-4 w-4" name={icon} />
      </span>
      <h3 className="font-semibold text-ink-base">
        <I18nText k={titleKey} fallback={title} />
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-ink-muted">
        <I18nText k={descriptionKey} fallback={description} />
      </p>
    </Link>
  );
}

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
      <main className="min-h-screen bg-surface-app px-4 py-6 text-ink-base sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-ink-strong">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </h1>
          <Card className="mt-8 border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              <I18nText k="dashboard.loadFailed" fallback="지금 대시보드를 불러올 수 없습니다." />
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const profile = result.data.profile;
  if (profile && profile.status !== "active") {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-6 text-ink-base sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            <I18nText k="dashboard.title" fallback="대시보드" />
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-ink-strong">
            <I18nText k="dashboard.accountStatus" fallback="계정 상태 확인" />
          </h1>
          <Card className="mt-8 border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-800">
              <I18nText
                k="dashboard.inactiveAccount"
                fallback="비활성화된 계정입니다. 관리자에게 문의하세요."
              />
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const roleValues = result.data.roles.map((role) => role.role);

  const isCoachOnly =
    roleValues.includes("coach") &&
    !roleValues.some((r) =>
      ["super_admin", "country_admin", "organization_admin", "church_admin", "coach_maker"].includes(r),
    );
  if (isCoachOnly) {
    redirect("/coach");
  }

  const isAdmin = roleValues.some((role) =>
    ["super_admin", "country_admin", "organization_admin", "church_admin"].includes(
      role,
    ),
  );
  if (isAdmin) {
    redirect("/admin");
  }

  const isCoacheeOnly =
    roleValues.includes("coachee") &&
    !roleValues.some((r) =>
      ["coach", "coach_maker", "super_admin", "country_admin", "organization_admin", "church_admin"].includes(r),
    );
  if (isCoacheeOnly) {
    redirect("/coachee");
  }

  const quickLinks = getDashboardQuickLinksState(roleValues);
  const showMyMoksilgiCard =
    roleValues.includes("coach") || roleValues.includes("coachee");
  const showCoachMakerFeatureCards = roleValues.includes("coach_maker");
  const welcomeName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.email ||
    authEmail ||
    "사용자";
  const dashboardAnnouncements = result.data.announcements;
  perf.mark("dashboard.complete", 1);

  return (
    <main className="min-h-screen bg-surface-app px-4 py-6 text-ink-base sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <DashboardHero
          navigation={
            <PageNavigationButtons className="justify-start sm:justify-end" />
          }
          roles={result.data.roles.map((role) => ({ role: role.role as UserRole }))}
          welcomeName={welcomeName}
        />

        {quickLinks.showMyCoachingLink ? <CoacheeActionHub /> : null}

        {dashboardAnnouncements.length > 0 ? (
          <div className="grid gap-3">
            {dashboardAnnouncements.map((announcement) => (
              <Card
                className="border-sky-200 bg-sky-50"
                key={announcement.id}
              >
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">시스템 공지</Badge>
                    {announcement.audience === "admin" ? (
                      <Badge tone="warning">관리자 전용</Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-3 break-words text-base font-semibold text-ink-strong">
                    {announcement.title}
                  </h2>
                  <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-ink-base">
                    {announcement.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {showMyMoksilgiCard && !quickLinks.showMyCoachingLink ? (
          <Link
            className="block rounded-xl border border-line-base border-l-4 border-l-brand-600 bg-surface-card p-4 transition hover:border-brand-200 hover:bg-brand-50"
            href="/my-coaching/moksilgi"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" name="report" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink-strong">
                  <I18nText k="dashboard.myMoksilgi" fallback="나의 목실기" />
                </h2>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  <I18nText
                    k="dashboard.myMoksilgiDescription"
                    fallback="내 목실기 목표와 실행전략을 작성하고 점검합니다."
                  />
                </p>
              </div>
              <Icon className="h-5 w-5 shrink-0 text-brand-600" name="arrow-right" />
            </div>
          </Link>
        ) : null}

        {showCoachMakerFeatureCards ? (
          <DashboardSectionCard
            title={
              <I18nText k="dashboard.coachMakerFeatures" fallback="코치메이커 기능" />
            }
          >
            <p className="mb-4 text-sm leading-6 text-ink-muted">
              <I18nText
                k="dashboard.coachMakerFeaturesDescription"
                fallback="코치메이커 센터, 전체 목실기 성취 현황, 나의 목실기와 나의 기록으로 바로 이동합니다."
              />
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coachMakerFeatureCards.map((card) => (
                <FeatureLinkCard key={card.href} {...card} />
              ))}
            </div>
          </DashboardSectionCard>
        ) : null}

        <DashboardSectionCard
          action={
            <Link
              className="text-sm font-medium text-brand-600 underline underline-offset-2"
              href="/profile"
            >
              <I18nText k="dashboard.viewProfile" fallback="프로필 보기" />
            </Link>
          }
          title={<I18nText k="dashboard.profile" fallback="프로필" />}
        >
          {profile === null ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-base">
                <I18nText
                  k="dashboard.noProfile"
                  fallback="아직 프로필이 생성되지 않았습니다."
                />
              </p>
              <p className="text-sm text-ink-muted">
                <I18nText
                  k="dashboard.acceptInvitationFirst"
                  fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요."
                />
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-muted">
                  <I18nText k="dashboard.displayName" fallback="표시 이름" />
                </p>
                <p className="mt-1 font-medium text-ink-strong">
                  {displayValue(profile.display_name)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-muted">
                  <I18nText k="members.email" fallback="이메일" />
                </p>
                <p className="mt-1 text-ink-base">{displayValue(profile.email)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-muted">
                  <I18nText k="members.status" fallback="상태" />
                </p>
                <div className="mt-1">
                  <Badge tone={profileStatusTone(profile.status)}>
                    {getStatusLabel(profile.status as ProfileStatus)}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          title={<I18nText k="dashboard.myRoles" fallback="내 역할" />}
        >
            {result.data.roles.length > 0 ? (
              <div className="space-y-3">
                {result.data.roles.map((role) => (
                  <div
                    className="rounded-card border border-line-base bg-surface-app p-3"
                    key={`${role.role}-${role.scope_type}-${role.scope_id ?? "global"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">
                        <I18nText
                          k={`roles.${role.role}`}
                          fallback={getRoleLabel(role.role)}
                        />
                      </Badge>
                      <Badge tone="neutral">{getStatusLabel(role.status)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">
                      {formatScope(role.scope_type, role.scope_id)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ink-base">
                  <I18nText
                    k="dashboard.noActiveRole"
                    fallback="아직 활성 역할이 배정되지 않았습니다."
                  />
                </p>
                <p className="text-sm text-ink-muted">
                  <I18nText
                    k="dashboard.acceptInvitationFirst"
                    fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요."
                  />
                </p>
              </div>
            )}
        </DashboardSectionCard>

        <DashboardSectionCard
          title={<I18nText k="dashboard.quickLinks" fallback="바로가기" />}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <QuickLinkTile
              fallback="내 프로필"
              href="/profile"
              icon="settings"
              labelKey="dashboard.myProfile"
            />

            {quickLinks.showAdminUsers ? (
              <QuickLinkTile
                fallback="관리자 센터"
                href="/admin"
                icon="settings"
                labelKey="dashboard.adminCenter"
              />
            ) : null}

            {quickLinks.showCoachLink ? (
              <QuickLinkTile
                fallback="코치 작업 공간"
                href="/coach"
                icon="users"
                labelKey="dashboard.coachWorkspace"
              />
            ) : null}
          </div>

          {quickLinks.showCoacheeMessage ? (
            <div className="mt-4 rounded-card border border-line-base bg-surface-app p-4 text-sm text-ink-base">
              <p>
                <I18nText
                  k="dashboard.coachingSpacePreparing"
                  fallback="코칭 공간이 준비 중입니다."
                />
              </p>
              <Link
                className="mt-2 inline-block font-medium text-brand-600 underline underline-offset-2"
                href="/profile"
              >
                <I18nText k="dashboard.checkProfile" fallback="프로필 확인하기" />
              </Link>
            </div>
          ) : null}

          {quickLinks.showNoRoleMessage ? (
            <div className="mt-4 rounded-card border border-line-base bg-surface-app p-4 text-sm text-ink-base">
              <p>
                <I18nText
                  k="dashboard.noActiveRole"
                  fallback="아직 활성 역할이 배정되지 않았습니다."
                />
              </p>
              <p className="mt-2 text-ink-muted">
                <I18nText
                  k="dashboard.acceptInvitationFirst"
                  fallback="초대를 받으셨다면 먼저 초대를 수락해 주세요."
                />
              </p>
            </div>
          ) : null}
        </DashboardSectionCard>
      </section>
    </main>
  );
}
