import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

type DashboardProfile = {
  display_name: string | null;
  email: string | null;
  primary_role: string | null;
  status: string | null;
  preferred_language: string | null;
  timezone: string | null;
};

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function getFriendlyProfileError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("permission denied") || lowerMessage.includes("rls")) {
    return "프로필 테이블을 읽을 권한이 없습니다. Supabase RLS 정책에서 로그인한 사용자가 자신의 profile을 읽을 수 있는지 확인해 주세요.";
  }

  if (lowerMessage.includes("does not exist")) {
    return "profiles 테이블을 찾지 못했습니다. Supabase SQL migration이 적용되었는지 확인해 주세요.";
  }

  return `프로필 조회 중 오류가 발생했습니다: ${message}`;
}

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "display_name, email, primary_role, status, preferred_language, timezone",
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const profile = data as DashboardProfile | null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          로그인 성공: GO Coaching Dashboard
        </h1>
        <p className="mt-4 text-slate-600">
          현재 로그인한 Supabase Auth 사용자 ID:{" "}
          <span className="font-mono text-sm text-slate-900">{user.id}</span>
        </p>

        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">내 프로필</h2>

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {getFriendlyProfileError(error.message)}
            </p>
          ) : profile ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  Display name
                </dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.display_name)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.email)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  Primary role
                </dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.primary_role)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Status</dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.status)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  Preferred language
                </dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.preferred_language)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Timezone</dt>
                <dd className="mt-1 text-slate-950">
                  {displayValue(profile.timezone)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-slate-600">
              프로필이 아직 생성되지 않았습니다
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
