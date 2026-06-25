import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { getAdminAffiliations } from "@/lib/api/admin/affiliations";
import { AffiliationsClient } from "./AffiliationsClient";


export default async function AdminAffiliationsPage() {
  await requireSuperAdmin();

  const result = await getAdminAffiliations();

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              Super Admin Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold">소속 선택값 관리</h1>
            <p className="mt-4 max-w-3xl leading-7 text-ink-muted">
              회원정보수정 화면에서 사용하는 지역/도시, 세부 교회,
              그룹/팀/목장 선택값을 관리합니다. 등록한 값은 회원정보수정
              드롭다운에 표시됩니다.
            </p>
            <p className="mt-3 max-w-3xl rounded-md border border-line-base bg-surface-card px-4 py-3 text-sm leading-6 text-ink-muted">
              적용 위치: 회원 정보 입력/수정 화면의 국가·지역·기관·교회·그룹
              선택값으로 사용됩니다.
            </p>
          </div>

          <Link
            className="inline-flex rounded-md border border-line-base bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-base hover:bg-surface-sunken"
            href="/admin"
          >
            관리자 대시보드로 돌아가기
          </Link>
        </div>

        <AffiliationsClient
          countries={result.countries}
          churches={result.churches}
          groups={result.groups}
          initialError={result.error}
          organizations={result.organizations}
          regions={result.regions}
        />
      </section>
    </main>
  );
}
