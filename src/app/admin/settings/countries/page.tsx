import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { getAdminCountries } from "@/lib/api/admin/countries";
import { CountriesClient } from "./CountriesClient";

export const dynamic = "force-dynamic";

export default async function AdminCountriesPage() {
  await requireSuperAdmin();

  const { countries, error } = await getAdminCountries();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Super Admin Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold">국가 관리</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              초대 수락과 회원관리에서 사용하는 국가 목록을 확인하고 관리합니다.
            </p>
          </div>

          <Link
            className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            href="/admin"
          >
            관리자 대시보드로 돌아가기
          </Link>
        </div>

        <CountriesClient initialCountries={countries} loadError={error} />
      </section>
    </main>
  );
}
