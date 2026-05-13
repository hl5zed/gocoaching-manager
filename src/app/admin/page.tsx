import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { getAdminUsers } from "@/lib/api/admin/users";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";

export const dynamic = "force-dynamic";

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
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

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
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              관리자
            </p>
            <h1 className="mt-3 text-3xl font-semibold">관리자 대시보드</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              회원관리 현황을 확인하고 사용자 관리 화면으로 이동합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PageNavigationButtons className="justify-start sm:justify-end" />
            {canAccessSettings ? (
              <Link
                className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                href="/admin/settings"
              >
                관리자 설정
              </Link>
            ) : null}
            <Link
              className="inline-flex rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
              href="/admin/users"
            >
              회원관리로 이동
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
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

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  역할별 회원 수
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  현재 회원 프로필의 role 값을 기준으로 자동 집계한 수입니다.
                </p>
              </div>

              {roleStats.length === 0 ? (
                <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                  역할 정보가 있는 회원이 없습니다.
                </p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {roleStats.map((roleStat) => (
                    <div
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                      key={roleStat.role}
                    >
                      <p className="text-sm font-medium text-slate-600">
                        {getRoleDisplayLabel(roleStat.role)}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
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
