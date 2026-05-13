import { NextResponse } from "next/server";
import {
  getAdminChurches,
  getAdminGroups,
  getAdminRegions,
  getAdminOrganizations,
} from "@/lib/api/admin/users";
import { getAdminCountries } from "@/lib/api/admin/countries";
import { getActiveGlobalGenerationOptions } from "@/lib/api/admin/generations";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET() {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: admin.status, headers: NO_STORE_HEADERS },
    );
  }

  const [
    countriesResult,
    regionsResult,
    organizationsResult,
    churchesResult,
    groupsResult,
    generationOptions,
  ] = await Promise.all([
    getAdminCountries(),
    getAdminRegions(),
    getAdminOrganizations(),
    getAdminChurches(),
    getAdminGroups(),
    getActiveGlobalGenerationOptions(),
  ]);

  return NextResponse.json(
    {
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
