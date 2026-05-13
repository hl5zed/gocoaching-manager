import { NextResponse } from "next/server";
import {
  getAdminChurches,
  getAdminGroups,
  getAdminRegions,
  getAdminUserDetail,
  getAdminOrganizations,
} from "@/lib/api/admin/users";
import { getAdminCountries } from "@/lib/api/admin/countries";
import { getActiveGlobalGenerationOptions } from "@/lib/api/admin/generations";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> | { profileId: string } },
) {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  const { profileId } = await Promise.resolve(context.params);

  if (!isUuid(profileId)) {
    return NextResponse.json(
      { error: "회원 정보를 불러오지 못했습니다." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const [
    detailResult,
    countriesResult,
    regionsResult,
    organizationsResult,
    churchesResult,
    groupsResult,
    generationOptions,
  ] = await Promise.all([
    getAdminUserDetail(profileId),
    getAdminCountries(),
    getAdminRegions(),
    getAdminOrganizations(),
    getAdminChurches(),
    getAdminGroups(),
    getActiveGlobalGenerationOptions(),
  ]);

  if (detailResult.error || !detailResult.user) {
    return NextResponse.json(
      { error: "회원 정보를 불러오지 못했습니다." },
      { status: detailResult.error === "Member not found." ? 404 : 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      user: detailResult.user,
      options: {
        countries: countriesResult.countries.filter((country) => country.is_active),
        regions: regionsResult.regions,
        organizations: organizationsResult.organizations,
        churches: churchesResult.churches,
        groups: groupsResult.groups,
        generations:
          generationOptions.length > 0
            ? generationOptions.map((generation) => ({
                generation_number: generation.generation_number,
                label: generation.label || `${generation.generation_number}세대`,
              }))
            : [],
      },
      optionErrors: {
        countries: countriesResult.error,
        regions: regionsResult.error,
        organizations: organizationsResult.error,
        churches: churchesResult.error,
        groups: groupsResult.error,
      },
    },
    { headers: NO_STORE_HEADERS },
  );
}
