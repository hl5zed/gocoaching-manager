import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";

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

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Super Admin Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold">관리자 설정</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              최고관리자가 회원관리와 초대, 소속 정보에 사용하는 기준값을
              관리합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PageNavigationButtons className="justify-start sm:justify-end" />
            <Link
              className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              href="/admin"
            >
              관리자 대시보드로 돌아가기
            </Link>
          </div>
        </div>

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
      </section>
    </main>
  );
}
