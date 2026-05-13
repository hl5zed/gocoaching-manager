import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";

export const dynamic = "force-dynamic";

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "-";
}

export default async function CoacheePage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fcoachee");
  }

  const result = await getMyCoachingMe();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fcoachee");
  }

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
        <section className="mx-auto w-full max-w-5xl">
          <h1 className="text-3xl font-semibold">코치이 공간</h1>
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 코치이 공간을 불러올 수 없습니다.
          </div>
        </section>
      </main>
    );
  }

  const profile = result.data.profile;
  const displayName =
    profile?.display_name ??
    profile?.full_name ??
    profile?.email ??
    result.data.authEmail ??
    "사용자";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              코치이
            </p>
            <h1 className="mt-3 text-3xl font-semibold">코치이 공간</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              내가 작성한 목표와 목실기 내용을 확인하고 인쇄용 보고서로 저장할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link className="font-medium text-slate-700 underline" href="/coachee/report">
              인쇄용 보고서 보기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              내 코칭 공간
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              대시보드
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">환영합니다</h2>
          <p className="mt-3 text-slate-700">
            안녕하세요, <span className="font-medium text-slate-950">{displayName}</span>님.
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-slate-500">이름</dt>
              <dd className="mt-1 text-slate-950">
                {displayValue(profile?.display_name ?? profile?.full_name)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">이메일</dt>
              <dd className="mt-1 text-slate-950">
                {displayValue(profile?.email ?? result.data.authEmail)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">바로가기</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Link
              className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 underline"
              href="/my-coaching/goals"
            >
              목표 확인
            </Link>
            <Link
              className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 underline"
              href="/my-coaching/moksilgi"
            >
              목실기 작성
            </Link>
            <Link
              className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 underline"
              href="/coachee/report"
            >
              인쇄용 보고서 보기
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
