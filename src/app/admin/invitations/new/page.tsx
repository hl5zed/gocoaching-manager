import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AdminInvitationCreateForm } from "@/components/admin/AdminInvitationCreateForm";
import { I18nText } from "@/lib/i18n/I18nProvider";
import {
  FALLBACK_INVITATION_EXPIRES_IN_DAYS,
  getInvitationExpiresInDaysSetting,
  getInvitationOrganizationDefaultRoleOptions,
} from "@/lib/api/admin/system-settings";


export default async function NewAdminInvitationPage() {
  const [expiresInDaysResult, organizationDefaultRolesResult] = await Promise.all([
    getInvitationExpiresInDaysSetting(),
    getInvitationOrganizationDefaultRoleOptions(),
  ]);
  const defaultExpiresInDays =
    expiresInDaysResult.expiresInDays ?? FALLBACK_INVITATION_EXPIRES_IN_DAYS;

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
              <I18nText k="admin.invitations.new.badge" fallback="관리자" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="admin.invitations.new.title" fallback="초대 생성" />
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-ink-muted">
              <I18nText
                k="admin.invitations.new.description"
                fallback="새 사용자를 초대하고 역할과 소속 범위를 지정합니다."
              />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <Link
              className="inline-flex h-10 min-h-10 items-center justify-center rounded-md border border-line-base bg-surface-card px-4 py-2 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
              href="/admin/invitations"
            >
              <I18nText
                k="admin.invitations.new.backToList"
                fallback="초대 목록으로"
              />
            </Link>
          </div>
        </div>

        <AdminInvitationCreateForm
          defaultExpiresInDays={defaultExpiresInDays}
          organizations={organizationDefaultRolesResult.organizations}
        />
      </section>
    </main>
  );
}
