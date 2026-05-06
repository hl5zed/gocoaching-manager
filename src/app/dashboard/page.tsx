import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getDashboardMe } from "@/lib/api/dashboard/me";
import { getDashboardQuickLinksState } from "@/lib/dashboard/quick-links";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";

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

export default async function DashboardPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fdashboard");
  }

  const result = await getDashboardMe();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fdashboard");
  }

  const authEmail = session.user.email;

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-5xl">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            대시보드
          </p>
          <h1 className="mt-3 text-3xl font-semibold">대시보드</h1>
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 대시보드를 불러올 수 없습니다.
          </div>
        </section>
      </main>
    );
  }

  const profile = result.data.profile;
  const roleValues = result.data.roles.map((role) => role.role);
  const quickLinks = getDashboardQuickLinksState(roleValues);
  const welcomeName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.email ||
    authEmail ||
    "사용자";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          대시보드
        </p>
        <h1 className="mt-3 text-3xl font-semibold">대시보드</h1>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">환영합니다</h2>
          <p className="mt-3 text-slate-700">
            안녕하세요,{" "}
            <span className="font-medium text-slate-950">{welcomeName}</span>님.
          </p>
          <p className="mt-2 text-slate-600">
            프로필과 역할별 작업 공간으로 이동할 수 있는 기본 화면입니다.
          </p>
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">프로필</h2>
            <Link
              className="text-sm font-medium text-slate-700 underline"
              href="/profile"
            >
              프로필 보기
            </Link>
          </div>

          {profile === null ? (
            <div className="mt-4">
              <p className="text-slate-700">
                아직 프로필이 생성되지 않았습니다.
              </p>
              <p className="mt-2 text-slate-600">
                초대를 받으셨다면 먼저 초대를 수락해 주세요.
              </p>
            </div>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  표시 이름
                </dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.display_name)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">이메일</dt>
                <dd className="mt-1 text-slate-950">{displayValue(profile.email)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">전체 이름</dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.full_name)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">상태</dt>
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
          <h2 className="text-lg font-semibold">내 역할</h2>
          {result.data.roles.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-medium">역할</th>
                    <th className="px-3 py-2 font-medium">범위</th>
                    <th className="px-3 py-2 font-medium">상태</th>
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
                          {getRoleLabel(role.role)}
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
                아직 활성 역할이 배정되지 않았습니다.
              </p>
              <p className="mt-2 text-slate-600">
                초대를 받으셨다면 먼저 초대를 수락해 주세요.
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">바로가기</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Link
              className="text-sm font-medium text-slate-700 underline"
              href="/profile"
            >
              내 프로필
            </Link>

            {quickLinks.showAdminUsers && (
              <>
                <Link
                  className="text-sm font-medium text-slate-700 underline"
                  href="/admin/users"
                >
                  관리자: 사용자
                </Link>
                <Link
                  className="text-sm font-medium text-slate-700 underline"
                  href="/admin/invitations"
                >
                  관리자: 초대
                </Link>
              </>
            )}

            {quickLinks.showCoachLink && (
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/coach"
              >
                코치 작업 공간
              </Link>
            )}

            {quickLinks.showMyCoachingLink && (
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/my-coaching"
              >
                내 코칭 공간
              </Link>
            )}

            {quickLinks.showCoacheeMessage && (
              <div className="text-slate-700">
                <p>코칭 공간이 준비 중입니다.</p>
                <Link
                  className="mt-2 inline-block text-sm font-medium text-slate-700 underline"
                  href="/profile"
                >
                  프로필 확인하기
                </Link>
              </div>
            )}

            {quickLinks.showNoRoleMessage && (
              <div className="text-slate-700">
                <p>아직 활성 역할이 배정되지 않았습니다.</p>
                <p className="mt-2 text-slate-600">
                  초대를 받으셨다면 먼저 초대를 수락해 주세요.
                </p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
