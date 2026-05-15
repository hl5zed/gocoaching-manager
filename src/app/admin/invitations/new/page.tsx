import Link from "next/link";
import { AdminInvitationCreateForm } from "@/components/admin/AdminInvitationCreateForm";
import {
  FALLBACK_INVITATION_EXPIRES_IN_DAYS,
  getGlobalSystemSettings,
  getOrganizationDefaultRoleSettings,
} from "@/lib/api/admin/system-settings";

export const dynamic = "force-dynamic";

export default async function NewAdminInvitationPage() {
  const [{ settings }, organizationDefaultRolesResult] = await Promise.all([
    getGlobalSystemSettings(),
    getOrganizationDefaultRoleSettings(),
  ]);
  const defaultExpiresInDays =
    settings.invitation_expires_in_days ?? FALLBACK_INVITATION_EXPIRES_IN_DAYS;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              관리자
            </p>
            <h1 className="mt-3 text-3xl font-semibold">초대 생성</h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              새 사용자를 초대하고 역할과 소속 범위를 지정합니다.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            href="/admin/invitations"
          >
            초대 목록으로
          </Link>
        </div>

        <AdminInvitationCreateForm
          defaultExpiresInDays={defaultExpiresInDays}
          organizations={organizationDefaultRolesResult.organizations}
        />
      </section>
    </main>
  );
}
