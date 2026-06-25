import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { getAdminUsers } from "@/lib/api/admin/users";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { Badge, ButtonLink } from "@/components/ui";


type AdminUsers = Awaited<ReturnType<typeof getAdminUsers>>["users"];

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  church_admin: "교회 관리자",
  coach: "코치",
  coach_maker: "코치메이커",
  coachee: "코칭 대상자",
  organization_admin: "기관 관리자",
  super_admin: "최고 관리자",
};

function normalizeRoleLabel(role: string | null | undefined) {
  const trimmedRole = role?.trim();

  return trimmedRole ? trimmedRole : "미지정";
}

function getRoleDisplayLabel(role: string) {
  if (role === "미지정") {
    return role;
  }

  return ROLE_DISPLAY_LABELS[role] ?? `기타: ${role}`;
}

function getRoleStats(users: AdminUsers) {
  const roleCounts = new Map<string, number>();

  for (const user of users) {
    if (user.roles.length === 0) {
      roleCounts.set("미지정", (roleCounts.get("미지정") ?? 0) + 1);
      continue;
    }

    const userRoleLabels = new Set(
      user.roles.map((role) => normalizeRoleLabel(role.role)),
    );

    for (const roleLabel of userRoleLabels) {
      roleCounts.set(roleLabel, (roleCounts.get(roleLabel) ?? 0) + 1);
    }
  }

  return Array.from(roleCounts, ([role, count]) => ({ count, role })).sort(
    (left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.role.localeCompare(right.role);
    },
  );
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

const adminMenuCards = [
  {
    description: "회원 정보와 상태를 확인하고 수정합니다.",
    href: "/admin/users",
    title: "회원 관리",
  },
  {
    description: "새 사용자를 초대하고 초대 상태를 확인합니다.",
    href: "/admin/invitations",
    title: "초대 관리",
  },
  {
    description: "회원별 시스템 역할과 활성 상태를 관리합니다.",
    href: "/admin/users",
    title: "역할 관리",
  },
  {
    description: "국가, 기관/교회, 세대, 소속 선택값을 관리합니다.",
    href: "/admin/settings",
    title: "국가/지역/기관/교회/그룹 관리",
  },
  {
    description:
      "기본 언어, 기본 국가, 이메일 발신, 초대 만료 기간, 시스템 공지, 인쇄 기본 옵션, 조직별 기본 권한을 관리합니다.",
    href: "/admin/settings",
    title: "시스템 설정",
  },
];

export default async function AdminPage() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    redirect("/unauthorized");
  }

  const { users, error } = await getAdminUsers({
    authorizedAdmin: admin,
    q: "",
    role: "all",
    status: "all",
    page: 1,
    limit: 100,
  });
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "active").length;
  const inactiveUsers = users.filter((user) => user.status === "inactive").length;
  const roleStats = getRoleStats(users);
  const canAccessSettings = admin.roles.includes("super_admin");

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge icon="settings" tone="info">관리자 전용</Badge>
            <h1 className="mt-3 text-3xl font-semibold">관리자 센터</h1>
            <p className="mt-4 max-w-3xl leading-7 text-ink-muted">
              회원, 초대, 역할, 소속, 시스템 설정을 관리하는 관리자 전용 공간입니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PageNavigationButtons className="justify-start sm:justify-end" />
            {canAccessSettings ? (
              <ButtonLink href="/admin/settings" icon="settings" size="sm">
                관리자 설정
              </ButtonLink>
            ) : null}
            <ButtonLink href="/admin/users" icon="users" size="sm" variant="primary">
              회원관리로 이동
            </ButtonLink>
          </div>
        </div>

        <section className="mt-8 rounded-card border border-line-base bg-surface-card p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink-strong">
              관리자 전용 메뉴
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              운영 관리에 필요한 기능을 이곳에서 확인하고 이동합니다.
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {adminMenuCards.map((card) => (
              <Link
                className="rounded-card border border-line-base bg-surface-app p-4 transition hover:border-line-base hover:bg-surface-card"
                href={card.href}
                key={`${card.title}-${card.href}`}
              >
                <h3 className="font-semibold text-ink-strong">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  {card.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {error ? (
          <div className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 회원관리 현황을 불러올 수 없습니다.
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                description="현재 관리자 회원목록에서 조회한 전체 회원 수입니다."
                title="전체 회원 수"
                value={totalUsers}
              />
              <SummaryCard
                description="프로필 상태가 active인 회원 수입니다."
                title="활성 회원 수"
                value={activeUsers}
              />
              <SummaryCard
                description="프로필 상태가 inactive인 회원 수입니다."
                title="비활성 회원 수"
                value={inactiveUsers}
              />
            </section>

            <section className="mt-6 rounded-card border border-line-base bg-surface-card p-5">
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
          </>
        )}
      </section>
    </main>
  );
}
