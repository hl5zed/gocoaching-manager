import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile/getProfile";

export const dynamic = "force-dynamic";

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

export default async function DashboardPage() {
  const result = await getProfile();

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          로그인 성공: GO Coaching Dashboard
        </h1>

        {result.user && (
          <p className="mt-4 text-slate-600">
            현재 로그인한 Supabase Auth 사용자 ID:{" "}
            <span className="font-mono text-sm text-slate-900">
              {result.user.id}
            </span>
          </p>
        )}

        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">내 프로필</h2>

          {result.error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {result.error.message}
            </p>
          ) : (
            <>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Display name
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.profile.display_name)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Email</dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.profile.email)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Primary role
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.profile.primary_role)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Status</dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.profile.status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Preferred language
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.profile.preferred_language)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Timezone
                  </dt>
                  <dd className="mt-1 text-slate-950">
                    {displayValue(result.data.profile.timezone)}
                  </dd>
                </div>
              </dl>

              <div className="mt-8 border-t border-slate-200 pt-5">
                <h3 className="text-lg font-semibold">Active roles</h3>
                {result.data.roles.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-slate-700">
                    {result.data.roles.map((role) => (
                      <li key={role.id}>
                        {role.role} / {role.scope_type}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-slate-600">
                    현재 활성화된 role이 없습니다.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
