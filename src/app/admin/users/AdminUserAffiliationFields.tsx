"use client";

import { useMemo, useState } from "react";

import { I18nText } from "@/lib/i18n/I18nProvider";
import type {
  AdminLookupSummary,
  AdminOrganizationSummary,
} from "@/lib/api/admin/users";
import type { AdminCountrySummary } from "@/lib/api/admin/countries";

type AffiliationValues = {
  church_id?: string | null;
  country_id?: string | null;
  group_id?: string | null;
  organization_id?: string | null;
  region_id?: string | null;
};

type AffiliationOptionErrors = {
  churches?: string | null;
  countries?: string | null;
  groups?: string | null;
  organizations?: string | null;
  regions?: string | null;
};

type OrganizationOption = AdminOrganizationSummary & {
  label?: string | null;
  region_id?: string | null;
};

function getOrganizationOptionLabel(organization: OrganizationOption) {
  const candidates = [organization.label, organization.name, organization.id];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return organization.id;
}

export function AdminUserAffiliationFields({
  churchOptions,
  countryOptions,
  errors,
  groupOptions,
  initialValues,
  organizationOptions,
  regionOptions,
}: {
  churchOptions?: AdminLookupSummary[];
  countryOptions?: AdminCountrySummary[];
  errors?: AffiliationOptionErrors;
  groupOptions?: AdminLookupSummary[];
  initialValues?: AffiliationValues;
  organizationOptions?: AdminOrganizationSummary[];
  regionOptions?: AdminLookupSummary[];
}) {
  const safeChurchOptions = Array.isArray(churchOptions) ? churchOptions : [];
  const safeCountryOptions = Array.isArray(countryOptions) ? countryOptions : [];
  const safeGroupOptions = Array.isArray(groupOptions) ? groupOptions : [];
  const rawOrganizationOptions: OrganizationOption[] = Array.isArray(
    organizationOptions,
  )
    ? organizationOptions
    : [];
  const safeRegionOptions = Array.isArray(regionOptions) ? regionOptions : [];
  const [countryId, setCountryId] = useState(initialValues?.country_id ?? "");
  const [regionId, setRegionId] = useState(initialValues?.region_id ?? "");
  const [organizationId, setOrganizationId] = useState(
    initialValues?.organization_id ?? "",
  );
  const [churchId, setChurchId] = useState(initialValues?.church_id ?? "");
  const [groupId, setGroupId] = useState(initialValues?.group_id ?? "");
  const hasChurchOptions = safeChurchOptions.length > 0;
  const hasGroupOptions = safeGroupOptions.length > 0;
  const hasRegionOptions = safeRegionOptions.length > 0;

  const filteredRegions = useMemo(() => {
    if (!countryId) {
      return safeRegionOptions;
    }

    const linkedRegions = safeRegionOptions.filter(
      (region) => !region.country_id || region.country_id === countryId,
    );

    return linkedRegions.length > 0 ? linkedRegions : safeRegionOptions;
  }, [countryId, safeRegionOptions]);

  const visibleOrganizationOptions = useMemo(() => {
    const filteredOrganizationOptions = rawOrganizationOptions.filter(
      (organization) => {
        const matchesCountry =
          !countryId ||
          !organization.country_id ||
          String(organization.country_id) === String(countryId);
        const matchesRegion =
          !regionId ||
          !organization.region_id ||
          String(organization.region_id) === String(regionId);

        return matchesCountry && matchesRegion;
      },
    );

    return filteredOrganizationOptions.length > 0
      ? filteredOrganizationOptions
      : rawOrganizationOptions;
  }, [countryId, rawOrganizationOptions, regionId]);

  const filteredChurches = useMemo(() => {
    if (!organizationId) {
      return safeChurchOptions;
    }

    const linkedChurches = safeChurchOptions.filter(
      (church) =>
        !church.organization_id || church.organization_id === organizationId,
    );

    return linkedChurches.length > 0 ? linkedChurches : safeChurchOptions;
  }, [organizationId, safeChurchOptions]);

  const filteredGroups = useMemo(() => {
    if (!churchId) {
      return safeGroupOptions;
    }

    const linkedGroups = safeGroupOptions.filter(
      (group) => !group.church_id || group.church_id === churchId,
    );

    return linkedGroups.length > 0 ? linkedGroups : safeGroupOptions;
  }, [churchId, safeGroupOptions]);

  function handleCountryChange(nextCountryId: string) {
    setCountryId(nextCountryId);

    if (!nextCountryId) {
      setRegionId("");
      setOrganizationId("");
      setChurchId("");
      setGroupId("");
      return;
    }

    const selectedRegion = safeRegionOptions.find((region) => region.id === regionId);
    if (
      selectedRegion?.country_id &&
      selectedRegion.country_id !== nextCountryId
    ) {
      setRegionId("");
    }

    const selectedOrganization = rawOrganizationOptions.find(
      (organization) => organization.id === organizationId,
    );
    if (
      selectedOrganization?.country_id &&
      selectedOrganization.country_id !== nextCountryId
    ) {
      setOrganizationId("");
      setChurchId("");
      setGroupId("");
    }
  }

  function handleOrganizationChange(nextOrganizationId: string) {
    setOrganizationId(nextOrganizationId);

    const selectedChurch = safeChurchOptions.find((church) => church.id === churchId);
    if (
      selectedChurch?.organization_id &&
      nextOrganizationId &&
      selectedChurch.organization_id !== nextOrganizationId
    ) {
      setChurchId("");
      setGroupId("");
    }

    if (!nextOrganizationId) {
      setChurchId("");
      setGroupId("");
    }
  }

  function handleChurchChange(nextChurchId: string) {
    setChurchId(nextChurchId);

    const selectedGroup = safeGroupOptions.find((group) => group.id === groupId);
    if (selectedGroup?.church_id && nextChurchId && selectedGroup.church_id !== nextChurchId) {
      setGroupId("");
    }

    if (!nextChurchId) {
      setGroupId("");
    }
  }

  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-ink-base">
          <I18nText k="members.country" fallback="소속 국가" />
        </span>
        <select
          className="rounded-control border border-line-base px-3 py-2 font-sans tracking-normal"
          name="country_id"
          onChange={(event) => handleCountryChange(event.currentTarget.value)}
          value={countryId}
        >
          <option value="">
            {safeCountryOptions.length > 0 ? (
              "선택 안 함"
            ) : (
              <I18nText k="members.notSpecified" fallback="미지정" />
            )}
          </option>
          {safeCountryOptions.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
              {country.code ? ` (${country.code})` : ""}
              {country.is_active ? "" : " - 비활성"}
            </option>
          ))}
        </select>
        {errors?.countries ? (
          <span className="text-xs text-amber-700">{errors.countries}</span>
        ) : null}
      </label>

      {hasRegionOptions ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink-base">
            <I18nText k="members.regionCity" fallback="지역/도시" />
          </span>
          <select
            className="rounded-control border border-line-base px-3 py-2 font-sans tracking-normal"
            name="region_id"
            onChange={(event) => setRegionId(event.currentTarget.value)}
            value={regionId}
          >
            <option value="">
              <I18nText k="members.notSpecified" fallback="미지정" />
            </option>
            {filteredRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
          {errors?.regions ? (
            <span className="text-xs text-amber-700">{errors.regions}</span>
          ) : null}
        </label>
      ) : (
        <div className="grid gap-1 text-sm">
          <input name="region_id" type="hidden" value={regionId} />
          <span className="font-medium text-ink-base">
            <I18nText k="members.regionCity" fallback="지역/도시" />
          </span>
          <p className="rounded-md border border-line-base bg-surface-app px-3 py-2 text-xs leading-5 text-ink-faint">
            등록된 지역/도시 목록이 없습니다. 현재는 소속 기관/교회 기준으로
            먼저 관리하세요.
          </p>
          {errors?.regions ? (
            <span className="text-xs text-amber-700">{errors.regions}</span>
          ) : null}
        </div>
      )}

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-ink-base">
          소속 기관/교회
        </span>
        <select
          className="rounded-control border border-line-base px-3 py-2 font-sans tracking-normal"
          name="organization_id"
          onChange={(event) => handleOrganizationChange(event.currentTarget.value)}
          value={organizationId}
        >
          <option value="">
            <I18nText k="members.notSpecified" fallback="미지정" />
          </option>
          {visibleOrganizationOptions.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {getOrganizationOptionLabel(organization)}
              {organization.is_active ? "" : " - 비활성"}
            </option>
          ))}
        </select>
        {errors?.organizations ? (
          <span className="text-xs text-amber-700">{errors.organizations}</span>
        ) : null}
      </label>

      {hasChurchOptions ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink-base">
            세부 교회
          </span>
          <select
            className="rounded-control border border-line-base px-3 py-2 font-sans tracking-normal"
            name="church_id"
            onChange={(event) => handleChurchChange(event.currentTarget.value)}
            value={churchId}
          >
            <option value="">
              {filteredChurches.length > 0 ? (
                "선택 안 함"
              ) : (
                <I18nText k="members.notSpecified" fallback="미지정" />
              )}
            </option>
            {filteredChurches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </select>
          {errors?.churches ? (
            <span className="text-xs text-amber-700">{errors.churches}</span>
          ) : null}
        </label>
      ) : (
        <div className="grid gap-1 text-sm">
          <input name="church_id" type="hidden" value={churchId} />
          <span className="font-medium text-ink-base">
            세부 교회
          </span>
          <p className="rounded-md border border-line-base bg-surface-app px-3 py-2 text-xs leading-5 text-ink-faint">
            등록된 세부 교회 목록이 없습니다. 소속은 위의 소속 기관/교회에서
            선택해 주세요.
          </p>
          {errors?.churches ? (
            <span className="text-xs text-amber-700">{errors.churches}</span>
          ) : null}
        </div>
      )}

      {hasGroupOptions ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink-base">
            <I18nText k="members.groupTeam" fallback="그룹/팀/목장" />
          </span>
          <select
            className="rounded-control border border-line-base px-3 py-2 font-sans tracking-normal"
            name="group_id"
            onChange={(event) => setGroupId(event.currentTarget.value)}
            value={groupId}
          >
            <option value="">
              <I18nText k="members.notSpecified" fallback="미지정" />
            </option>
            {filteredGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {errors?.groups ? (
            <span className="text-xs text-amber-700">{errors.groups}</span>
          ) : null}
        </label>
      ) : (
        <div className="grid gap-1 text-sm">
          <input name="group_id" type="hidden" value={groupId} />
          <span className="font-medium text-ink-base">
            <I18nText k="members.groupTeam" fallback="그룹/팀/목장" />
          </span>
          <p className="rounded-md border border-line-base bg-surface-app px-3 py-2 text-xs leading-5 text-ink-faint">
            등록된 그룹/팀/목장 목록이 없습니다. 먼저 소속 기관/교회를 선택해
            관리하세요.
          </p>
          {errors?.groups ? (
            <span className="text-xs text-amber-700">{errors.groups}</span>
          ) : null}
        </div>
      )}
    </>
  );
}
