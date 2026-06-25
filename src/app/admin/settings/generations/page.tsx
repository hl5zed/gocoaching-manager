import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { getAdminGenerationOptions } from "@/lib/api/admin/generations";
import { GenerationsClient } from "./GenerationsClient";


export default async function AdminGenerationsPage() {
  await requireSuperAdmin();

  const { generations, error } = await getAdminGenerationOptions();

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              Super Admin Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold">세대 옵션 관리</h1>
            <p className="mt-4 max-w-3xl leading-7 text-ink-muted">
              초대 수락과 회원가입에서 표시할 세대 선택 항목을 관리합니다.
              시스템 역할과 세대는 별개의 정보입니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex rounded-md border border-line-base bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-base hover:bg-surface-sunken"
              href="/admin/settings/countries"
            >
              국가 관리로 이동
            </Link>
            <Link
              className="inline-flex rounded-md border border-line-base bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-base hover:bg-surface-sunken"
              href="/admin"
            >
              관리자 대시보드로 돌아가기
            </Link>
          </div>
        </div>

        <GenerationsClient
          initialGenerations={generations}
          loadError={error}
        />
      </section>
    </main>
  );
}
