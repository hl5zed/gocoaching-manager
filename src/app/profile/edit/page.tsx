import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { getMyProfile } from "@/lib/api/profile/me";
import { updateMyProfile } from "@/lib/api/profile/update-me";

export const dynamic = "force-dynamic";

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fprofile%2Fedit");
  }

  const result = await getMyProfile();

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fprofile%2Fedit");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  async function saveProfile(formData: FormData) {
    "use server";

    const updateResult = await updateMyProfile({
      full_name: formData.get("full_name"),
      display_name: formData.get("display_name"),
    });

    if (!updateResult.ok) {
      const nextError = encodeURIComponent(updateResult.error.message);
      redirect(`/profile/edit?error=${nextError}`);
    }

    redirect("/profile");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          프로필
        </p>
        <h1 className="mt-3 text-3xl font-semibold">프로필 수정</h1>
        <p className="mt-4 leading-7 text-slate-600">
          내 계정의 이름 정보를 수정할 수 있습니다.
        </p>

        <div className="mt-6">
          <Link
            className="text-sm font-medium text-slate-700 underline"
            href="/profile"
          >
            프로필로 돌아가기
          </Link>
        </div>

        {!result.ok ? (
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 프로필을 불러올 수 없습니다.
          </div>
        ) : result.data.profile === null ? (
          <div className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">프로필</h2>
            <p className="mt-4 text-slate-700">
              아직 프로필이 생성되지 않았습니다.
            </p>
            <div className="mt-4">
              <Link
                className="text-sm font-medium text-slate-700 underline"
                href="/profile"
              >
                프로필로 돌아가기
              </Link>
            </div>
          </div>
        ) : (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            {errorMessage && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                {errorMessage}
              </div>
            )}

            <form action={saveProfile} className="space-y-5">
              <div>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="display_name"
                >
                  표시 이름
                </label>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                  defaultValue={result.data.profile.display_name ?? ""}
                  id="display_name"
                  maxLength={120}
                  name="display_name"
                  type="text"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="full_name"
                >
                  전체 이름
                </label>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-slate-700"
                  defaultValue={result.data.profile.full_name ?? ""}
                  id="full_name"
                  maxLength={120}
                  name="full_name"
                  type="text"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-md bg-slate-950 px-5 py-2.5 font-medium text-white"
                  type="submit"
                >
                  저장
                </button>
                <Link
                  className="rounded-md border border-slate-300 px-5 py-2.5 font-medium text-slate-700"
                  href="/profile"
                >
                  취소
                </Link>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
