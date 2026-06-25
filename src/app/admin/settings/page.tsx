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


const settingCards = [
  {
    applyInfo: "회원 정보 입력/수정과 초대 수락 화면의 국가 선택값으로 사용됩니다.",
    description:
      "초대 수락과 회원관리에서 사용하는 국가 목록을 확인하고 관리합니다.",
    href: "/admin/settings/countries",
    status: "실제 적용 중",
    statusTone: "success" as const,
    title: "국가 관리",
  },
  {
    applyInfo: "회원 소속과 조직별 기본 권한 설정에서 사용하는 기관/교회 선택값입니다.",
    description:
      "회원 소속 기관/교회 목록을 추가하고, 국가 연결과 사용 여부를 관리합니다.",
    href: "/admin/settings/organizations",
    status: "실제 적용 중",
    statusTone: "success" as const,
    title: "기관/교회 관리",
  },
  {
    applyInfo: "초대 수락과 회원가입에서 표시할 세대 선택값으로 사용됩니다.",
    description:
      "초대 수락과 회원가입에서 표시할 세대 선택 항목을 관리합니다.",
    href: "/admin/settings/generations",
    status: "실제 적용 중",
    statusTone: "success" as const,
    title: "세대 관리",
  },
  {
    applyInfo:
      "회원 정보 입력/수정 화면의 국가·지역·기관·교회·그룹 선택값으로 사용됩니다.",
    description:
      "회원정보수정에서 사용하는 지역/도시, 세부 교회, 그룹/팀/목장 선택값을 등록하고 수정합니다.",
    href: "/admin/settings/affiliations",
    status: "실제 적용 중",
    statusTone: "success" as const,
    title: "소속 선택값 관리",
  },
];

const systemSettingSections = [
  {
    description:
      "초대, 알림, 안내 메일 발신 기본값을 준비 중입니다. 현재 자동 메일 발송은 활성화되어 있지 않습니다.",
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
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
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
              className="rounded-card border border-line-base bg-surface-card p-5 transition hover:border-line-base hover:bg-surface-sunken"
              href={card.href}
              key={card.href}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink-strong">
                  {card.title}
                </h2>
                <Badge className="shrink-0" tone={card.statusTone}>
                  {card.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {card.description}
              </p>
              <p className="mt-3 rounded-md border border-line-soft bg-surface-app px-3 py-2 text-xs leading-5 text-ink-faint">
                적용 위치: {card.applyInfo}
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold text-ink-strong">
              운영 기본값 설정
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
              기본 언어, 기본 국가, 초대 만료 기간, 인쇄 옵션, 운영 공지,
              조직별 기본 권한을 관리합니다. 저장만 되는 항목과 실제 적용 중인
              항목을 구분해 확인해 주세요.
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
              <Card className="bg-surface-sunken" key={section.title}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <Badge className="shrink-0" tone="warning">
                    준비 중
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-ink-muted">
                    {section.description}
                  </p>
                  <p className="mt-3 text-xs font-medium text-ink-faint">
                    다음 단계에서 저장 기능과 메일 서비스 연결 예정
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
