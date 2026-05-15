import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { Badge, ButtonLink, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { getAdminCountries } from "@/lib/api/admin/countries";
import {
  getGlobalSystemSettings,
  getOrganizationDefaultRoleSettings,
} from "@/lib/api/admin/system-settings";
import { getAdminSystemAnnouncements } from "@/lib/api/admin/system-announcements";
import { OrganizationDefaultRoleSettings } from "./OrganizationDefaultRoleSettings";
import { SystemAnnouncementsClient } from "./SystemAnnouncementsClient";
import { SystemSettingsForm } from "./SystemSettingsForm";

export const dynamic = "force-dynamic";

const settingCards = [
  {
    description:
      "초대 수락과 회원관리에서 사용하는 국가 목록을 확인하고 관리합니다.",
    href: "/admin/settings/countries",
    title: "국가 관리",
  },
  {
    description:
      "회원 소속 기관/교회 목록을 추가하고, 국가 연결과 사용 여부를 관리합니다.",
    href: "/admin/settings/organizations",
    title: "기관/교회 관리",
  },
  {
    description:
      "초대 수락과 회원가입에서 표시할 세대 선택 항목을 관리합니다.",
    href: "/admin/settings/generations",
    title: "세대 관리",
  },
  {
    description:
      "회원정보수정에서 사용하는 지역/도시, 세부 교회, 그룹/팀/목장 선택값을 등록하고 수정합니다.",
    href: "/admin/settings/affiliations",
    title: "소속 선택값 관리",
  },
];

const systemSettingSections = [
  {
    description: "초대, 알림, 안내 메일 발신 기본값을 관리합니다.",
    title: "이메일 발신 설정",
  },
];

export default async function AdminSettingsPage() {
  const admin = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: activeProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", admin.profile.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !activeProfile) {
    redirect("/dashboard");
  }

  const [
    settingsResult,
    countriesResult,
    announcementsResult,
    organizationDefaultRolesResult,
  ] = await Promise.all([
    getGlobalSystemSettings(),
    getAdminCountries(),
    getAdminSystemAnnouncements(),
    getOrganizationDefaultRoleSettings(),
  ]);
  const countryOptions = countriesResult.countries
    .filter((country) => country.is_active)
    .map((country) => ({
      id: country.id,
      name: country.name,
    }));

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <Card>
          <CardHeader className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Badge icon="settings" tone="info">관리자 전용</Badge>
            <CardTitle className="mt-3 text-3xl">시스템 설정</CardTitle>
            <CardDescription className="mt-4 max-w-3xl leading-7">
              프로그램 전체 운영에 필요한 기본 언어, 국가, 이메일, 초대, 공지,
              인쇄, 권한 기본값을 관리합니다.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PageNavigationButtons
              className="justify-start sm:justify-end"
              dashboardHref="/admin"
            />
            <ButtonLink href="/admin" icon="arrow-left" size="sm">
              관리자 센터로 돌아가기
            </ButtonLink>
          </div>
          </CardHeader>
        </Card>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {settingCards.map((card) => (
            <Link
              className="rounded-md border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50"
              href={card.href}
              key={card.href}
            >
              <h2 className="text-lg font-semibold text-slate-950">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              운영 기본값 설정
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              기본 언어, 기본 국가, 초대 만료 기간은 바로 저장할 수 있습니다.
              나머지 항목은 다음 단계에서 저장 기능을 연결합니다.
            </p>
          </div>
          <div className="mt-4">
            <SystemSettingsForm
              countries={countryOptions}
              initialError={settingsResult.error ?? countriesResult.error}
              initialSettings={settingsResult.settings}
            />
          </div>
          <div className="mt-6">
            <SystemAnnouncementsClient
              initialAnnouncements={announcementsResult.announcements}
              initialError={announcementsResult.error}
            />
          </div>
          <div className="mt-6">
            <OrganizationDefaultRoleSettings
              initialError={organizationDefaultRolesResult.error}
              initialOrganizations={organizationDefaultRolesResult.organizations}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {systemSettingSections.map((section) => (
              <Card key={section.title}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <Badge className="shrink-0" tone="warning">
                    준비 중
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-slate-600">
                    {section.description}
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    다음 단계에서 저장 기능 연결 예정
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
