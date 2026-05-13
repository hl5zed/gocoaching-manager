import Link from "next/link";
import { OrganizationsClient } from "./OrganizationsClient";
import { getAdminOrganizations } from "@/lib/api/admin/organizations";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  await requireSuperAdmin();

  const result = await getAdminOrganizations();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">관리자 설정</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            기관 및 단체 관리
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            회원의 소속 기관 및 단체 선택에 사용되는 기관 목록을
            관리합니다. 이미 회원에게 연결된 기관은 삭제하지 않고
            비활성화합니다.
          </p>
        </div>
        <Link
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          href="/admin"
        >
          관리자 홈으로
        </Link>
      </div>

      <OrganizationsClient
        countries={result.countries}
        initialOrganizations={result.organizations}
        loadError={result.error}
      />
    </main>
  );
}
