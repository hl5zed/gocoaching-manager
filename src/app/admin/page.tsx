import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { getAdminUserRoleSummary } from "@/lib/api/admin/users";
import { getActiveAnnouncementsForCurrentUser } from "@/lib/api/admin/system-announcements";
import { PageHeader } from "@/components/layout";
import { Badge, ButtonLink, Card, CardContent } from "@/components/ui";

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  church_admin: "교회 관리자",
  coach: "코치",
  coach_maker: "코치메이커",
  coachee: "코칭 대상자",
  country_admin: "국가 관리자",
  group_leader: "그룹 리더",
  organization_admin: "기관 관리자",
  super_admin: "최고 관리자",
};

function getRoleDisplayLabel(role: string) {
  return ROLE_DISPLAY_LABELS[role] ?? `기타: ${role}`;
}

function SummaryCard({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: number | string;
}) {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-5">
      <p className="text-sm font-medium text-ink-faint">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-ink-strong">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
    </div>
  );
}

export default async function AdminPage() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    redirect("/unauthorized");
  }

  const { summary, error } = await getAdminUserRoleSummary();
  const roleStats = [
    { role: "coachee", count: summary.coacheeCount },
    { role: "coach", count: summary.coachCount },
    { role: "coach_maker", count: summary.coachMakerCount },
    { role: "group_leader", count: summary.groupLeaderCount },
    { role: "church_admin", count: summary.churchAdminCount },
    { role: "organization_admin", count: summary.organizationAdminCount },
    { role: "country_admin", count: summary.countryAdminCount },
    { role: "super_admin", count: summary.superAdminCount },
  ].filter((roleStat) => roleStat.count > 0);
  const canAccessSettings = admin.roles.includes("super_admin");
  const announcements = await getActiveAnnouncementsForCurrentUser({
    placement: "admin",
    roles: admin.roles,
  });

  return (
    <>
      <PageHeader
        title="개요"
        description="회원, 초대, 역할, 소속, 시스템 설정을 관리하는 관리자 전용 공간입니다."
        actions={
          <>
            {canAccessSettings ? (
              <ButtonLink href="/admin/settings" icon="settings" size="sm">
                소속·시스템 설정
              </ButtonLink>
            ) : null}
            <ButtonLink href="/admin/users" icon="users" size="sm" variant="primary">
              회원·역할 관리
            </ButtonLink>
          </>
        }
      />

      {announcements.length > 0 ? (
        <div className="mb-6 grid gap-3">
          {announcements.map((announcement) => (
            <Card className="border-sky-200 bg-sky-50" key={announcement.id}>
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

      {error ? (
        <div className="rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
          지금 회원관리 현황을 불러올 수 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              description="현재 관리자 권한 범위에서 조회 가능한 전체 회원 수입니다."
              title="전체 회원 수"
              value={summary.totalProfiles}
            />
            <SummaryCard
              description="프로필 상태가 active인 회원 수입니다."
              title="활성 회원 수"
              value={summary.activeProfiles}
            />
            <SummaryCard
              description="프로필 상태가 inactive인 회원 수입니다."
              title="비활성 회원 수"
              value={summary.inactiveProfiles}
            />
          </section>

          <section className="rounded-card border border-line-base bg-surface-card p-5">
            <div>
              <h2 className="text-lg font-semibold text-ink-strong">
                역할별 회원 수
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                현재 회원 프로필의 role 값을 기준으로 자동 집계한 수입니다.
              </p>
            </div>

            {roleStats.length === 0 ? (
              <p className="mt-5 rounded-md bg-surface-app p-4 text-sm text-ink-muted">
                역할 정보가 있는 회원이 없습니다.
              </p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roleStats.map((roleStat) => (
                  <div
                    className="rounded-card border border-line-base bg-surface-app p-4"
                    key={roleStat.role}
                  >
                    <p className="text-sm font-medium text-ink-muted">
                      {getRoleDisplayLabel(roleStat.role)}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-ink-strong">
                      {roleStat.count}명
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
