"use client";

import { useEffect, useState } from "react";
import type { FormEvent, SyntheticEvent } from "react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";
import type {
  AdminUserSummary,
} from "@/lib/api/admin/users";
import { PROFILE_STATUSES, USER_ROLES } from "@/types/database";
import type { ScopeType, UserRole } from "@/types/database";
import { AdminUserAffiliationFields } from "./AdminUserAffiliationFields";
import {
  loadAdminUsersOptions,
  type AdminUserGenerationOption,
  type AdminUsersOptionsPayload,
} from "./AdminUsersOptionsCache";
import { LoginGuideCopyButton } from "./LoginGuideCopyButton";

type DetailPayload = {
  user: AdminUserSummary;
};

const MANAGEABLE_USER_ROLES = USER_ROLES.filter(
  (userRole) => userRole !== "super_admin",
);
const ROLE_SCOPE_RULES: Partial<Record<UserRole, ScopeType[]>> = {
  country_admin: ["country"],
  organization_admin: ["organization"],
  church_admin: ["church"],
  group_leader: ["group"],
  coach_maker: ["organization", "church", "group"],
  coach: ["organization", "church", "group", "coach"],
  coachee: ["organization", "church", "group"],
};
const ADMIN_LEVEL_ROLES = new Set<UserRole>([
  "country_admin",
  "organization_admin",
  "church_admin",
  "group_leader",
  "coach_maker",
]);
const MINISTRY_POSITION_OPTIONS = [
  "목사",
  "선교사",
  "전도사",
  "장로",
  "권사",
  "집사",
  "목자",
  "순장",
  "교사",
  "리더",
  "성도",
  "기타",
];
const FALLBACK_GENERATION_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  generation_number: index + 1,
  label: `${index + 1}세대`,
}));

function formatDateTime(value: string | null) {
  if (!value) {
    return "미지정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미지정";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute",
  )}`;
}

function formatEmail(value: string | null) {
  return value && value.trim().length > 0 ? value : "이메일 없음";
}

function displayProfileValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "미지정";
}

function shortenId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatLookupValue(name: string | null, id: string | null) {
  if (name && name.trim().length > 0) {
    return name;
  }

  if (id && id.trim().length > 0) {
    return `ID: ${shortenId(id)}`;
  }

  return "미지정";
}

function formatCountryValue(user: AdminUserSummary) {
  if (user.country_name && user.country_name.trim().length > 0) {
    return user.country_code && user.country_code.trim().length > 0
      ? `${user.country_name} (${user.country_code})`
      : user.country_name;
  }

  return formatLookupValue(null, user.country_id);
}

function formatGeneration(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value}세대`
    : "미지정";
}

function isActiveRole(roleItem: AdminUserSummary["roles"][number]) {
  return roleItem.status === "active" && roleItem.is_active;
}

function getRepresentativeRole(user: AdminUserSummary) {
  return user.roles.find(isActiveRole) ?? user.roles[0] ?? null;
}

function getRoleActiveLabel(roleItem: AdminUserSummary["roles"][number]) {
  return isActiveRole(roleItem) ? "활성" : "비활성";
}

function formatScopeSummary(roles: AdminUserSummary["roles"]) {
  if (roles.length === 0) {
    return "미등록";
  }

  return roles
    .map((roleItem) => formatScope(roleItem.scope_type, roleItem.scope_id))
    .join(", ");
}

function getMinistryPositionOptions(currentValue?: string | null) {
  const trimmedValue = currentValue?.trim();

  if (trimmedValue && !MINISTRY_POSITION_OPTIONS.includes(trimmedValue)) {
    return [...MINISTRY_POSITION_OPTIONS, trimmedValue];
  }

  return MINISTRY_POSITION_OPTIONS;
}

function getGenerationSelectOptions(
  generationOptions: AdminUserGenerationOption[] = [],
  currentValue?: number | null,
) {
  const safeGenerationOptions = Array.isArray(generationOptions)
    ? generationOptions
    : [];
  const baseOptions =
    safeGenerationOptions.length > 0
      ? safeGenerationOptions
      : FALLBACK_GENERATION_OPTIONS;

  if (
    typeof currentValue === "number" &&
    Number.isInteger(currentValue) &&
    currentValue > 0 &&
    !baseOptions.some((option) => option.generation_number === currentValue)
  ) {
    return [
      ...baseOptions,
      {
        generation_number: currentValue,
        label: `${currentValue}세대`,
      },
    ].sort((left, right) => left.generation_number - right.generation_number);
  }

  return baseOptions;
}

function isLookupScopeType(scopeType: ScopeType | "") {
  return (
    scopeType === "country" ||
    scopeType === "organization" ||
    scopeType === "church" ||
    scopeType === "group"
  );
}

function ScopeIdField({
  isLoadingOptions,
  optionsPayload,
  optionsError,
  scopeType,
}: {
  isLoadingOptions: boolean;
  optionsPayload: AdminUsersOptionsPayload | null;
  optionsError: string | null;
  scopeType: ScopeType | "";
}) {
  const sharedClassName =
    "min-w-[180px] rounded-md border border-slate-300 px-2 py-1.5 font-sans text-xs tracking-normal disabled:bg-slate-100 disabled:text-slate-500";

  if (!scopeType) {
    return (
      <input
        className={sharedClassName}
        disabled
        placeholder="권한 범위를 먼저 선택하세요."
        type="text"
      />
    );
  }

  if (isLookupScopeType(scopeType) && isLoadingOptions) {
    return (
      <input
        className={sharedClassName}
        disabled
        placeholder="권한 범위 목록을 불러오는 중..."
        type="text"
      />
    );
  }

  if (isLookupScopeType(scopeType) && optionsPayload && !optionsError) {
    const lookupOptions =
      scopeType === "country"
        ? optionsPayload.options.countries.map((country) => ({
            id: country.id,
            label: `${country.name}${country.code ? ` (${country.code})` : ""}`,
          }))
        : scopeType === "organization"
          ? optionsPayload.options.organizations.map((organization) => ({
              id: organization.id,
              label: organization.name,
            }))
          : scopeType === "church"
            ? optionsPayload.options.churches.map((church) => ({
                id: church.id,
                label: church.name,
              }))
            : optionsPayload.options.groups.map((group) => ({
                id: group.id,
                label: group.name,
              }));

    return (
      <select className={sharedClassName} name="scope_id" required>
        <option value="">권한을 적용할 범위를 선택하세요</option>
        {lookupOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={sharedClassName}
      name="scope_id"
      placeholder={
        optionsError
          ? "목록을 불러오지 못했습니다. 범위 ID를 입력하세요."
          : "선택한 권한 범위의 ID를 입력하세요."
      }
      required
      type="text"
    />
  );
}

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-950">{value}</dd>
    </div>
  );
}

function RoleChangeForm({ user }: { user: AdminUserSummary }) {
  const representativeRole = getRepresentativeRole(user);

  if (!representativeRole || representativeRole.role === "super_admin") {
    return (
      <p className="text-xs text-slate-500">
        super_admin 역할은 이 화면에서 변경할 수 없습니다.
      </p>
    );
  }

  const existingOtherRoles = new Set(
    user.roles
      .filter((roleItem) => roleItem.id !== representativeRole.id && isActiveRole(roleItem))
      .map((roleItem) => roleItem.role),
  );
  const roleOptions = MANAGEABLE_USER_ROLES.filter(
    (userRole) => userRole === representativeRole.role || !existingOtherRoles.has(userRole),
  );

  return (
    <div className="grid gap-2 rounded-md border border-dashed border-slate-200 bg-white p-3">
      <p className="text-xs leading-5 text-slate-500">
        역할만 변경되며 기존 권한 범위는 유지됩니다. 범위 변경이 필요하면
        권한을 다시 추가하거나 수정하세요.
      </p>
      <form action="/api/admin/users" className="flex flex-wrap items-center gap-2" method="post">
        <input name="intent" type="hidden" value="update_role" />
        <input name="profile_id" type="hidden" value={user.id} />
        <input name="role_id" type="hidden" value={representativeRole.id} />
        <select
          className="rounded-md border border-slate-300 px-2 py-1.5 font-sans text-xs tracking-normal"
          defaultValue={representativeRole.role}
          name="role"
        >
          {roleOptions.map((userRole) => (
            <option key={userRole} value={userRole}>
              {getRoleLabel(userRole)}
            </option>
          ))}
        </select>
        <button
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
          type="submit"
        >
          역할 변경
        </button>
      </form>
    </div>
  );
}

function RoleAddForm({ user }: { user: AdminUserSummary }) {
  const hasProtectedRole = user.roles.some((roleItem) => roleItem.role === "super_admin");
  const existingRoles = new Set(user.roles.map((roleItem) => roleItem.role));
  const roleOptions = MANAGEABLE_USER_ROLES.filter(
    (userRole) => !existingRoles.has(userRole),
  );
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [selectedScopeType, setSelectedScopeType] = useState<ScopeType | "">("");
  const [optionsPayload, setOptionsPayload] =
    useState<AdminUsersOptionsPayload | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const allowedScopeTypes = selectedRole
    ? ROLE_SCOPE_RULES[selectedRole] ?? []
    : [];

  useEffect(() => {
    if (!isLookupScopeType(selectedScopeType) || optionsPayload || isLoadingOptions) {
      return;
    }

    let isMounted = true;
    setIsLoadingOptions(true);
    setOptionsError(null);

    void loadAdminUsersOptions()
      .then((payload) => {
        if (isMounted) {
          setOptionsPayload(payload);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOptionsError("권한 범위 선택값을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isLoadingOptions, optionsPayload, selectedScopeType]);

  if (hasProtectedRole) {
    return null;
  }

  if (roleOptions.length === 0) {
    return <p className="text-xs text-slate-500">추가로 부여할 수 있는 역할이 없습니다.</p>;
  }

  return (
    <form
      action="/api/admin/users"
      className="grid gap-2 rounded-md border border-dashed border-slate-200 bg-white p-3"
      method="post"
    >
      <input name="intent" type="hidden" value="add_role" />
      <input name="profile_id" type="hidden" value={user.id} />
      <p className="text-xs leading-5 text-slate-500">
        권한 범위는 회원 소속 정보와 다를 수 있습니다. 관리자 권한은 해당
        범위의 사용자와 기록에 접근할 수 있으므로 신중히 선택하세요.
        super_admin은 이 화면에서 새로 추가할 수 없습니다.
      </p>
      {selectedRole && ADMIN_LEVEL_ROLES.has(selectedRole) ? (
        <p className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
          관리자 권한은 선택한 범위 안의 관리 기능에 접근할 수 있습니다.
        </p>
      ) : null}
      <div className="flex flex-wrap items-start gap-2">
        <select
          className="rounded-md border border-slate-300 px-2 py-1.5 font-sans text-xs tracking-normal"
          name="role"
          onChange={(event) => {
            setSelectedRole(event.target.value as UserRole | "");
            setSelectedScopeType("");
          }}
          required
          value={selectedRole}
        >
          <option value="">역할 선택</option>
          {roleOptions.map((userRole) => (
            <option key={userRole} value={userRole}>
              {getRoleLabel(userRole)}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-300 px-2 py-1.5 font-sans text-xs tracking-normal disabled:bg-slate-100 disabled:text-slate-500"
          disabled={!selectedRole}
          name="scope_type"
          onChange={(event) => setSelectedScopeType(event.target.value as ScopeType | "")}
          required={Boolean(selectedRole)}
          value={selectedScopeType}
        >
          <option value="">
            {selectedRole ? "권한 범위 선택" : "역할을 먼저 선택하세요"}
          </option>
          {allowedScopeTypes.map((scopeType) => (
            <option key={scopeType} value={scopeType}>
              {formatScope(scopeType, null)}
            </option>
          ))}
        </select>
        <ScopeIdField
          isLoadingOptions={isLoadingOptions}
          optionsError={optionsError}
          optionsPayload={optionsPayload}
          scopeType={selectedScopeType}
        />
        <button
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoadingOptions}
          type="submit"
        >
          역할 추가
        </button>
      </div>
    </form>
  );
}

function RoleStatusToggleForm({
  roleItem,
  user,
}: {
  roleItem: AdminUserSummary["roles"][number];
  user: AdminUserSummary;
}) {
  if (roleItem.role === "super_admin") {
    return <span className="text-xs text-slate-500">super_admin 보호</span>;
  }

  const isActive = isActiveRole(roleItem);
  const targetStatus = isActive ? "inactive" : "active";

  return (
    <form action="/api/admin/users" method="post">
      <input name="intent" type="hidden" value="update_role_status" />
      <input name="profile_id" type="hidden" value={user.id} />
      <input name="role_id" type="hidden" value={roleItem.id} />
      <input name="target_role_status" type="hidden" value={targetStatus} />
      <ConfirmSubmitButton
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
          isActive ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"
        }`}
        confirmDescription={`${formatEmail(user.email)} 회원의 ${getRoleLabel(
          roleItem.role,
        )} 시스템 역할만 ${isActive ? "비활성화" : "활성화"}합니다.`}
        confirmTitle={
          isActive
            ? "시스템 역할을 비활성화하시겠습니까?"
            : "시스템 역할을 활성화하시겠습니까?"
        }
        type="submit"
      >
        {isActive ? "비활성화" : "재활성화"}
      </ConfirmSubmitButton>
    </form>
  );
}

function StatusChangeForm({ user }: { user: AdminUserSummary }) {
  const representativeRole = getRepresentativeRole(user);

  if (representativeRole?.role === "super_admin") {
    return <span className="text-xs text-slate-500">super_admin 보호</span>;
  }

  if (user.status !== "active" && user.status !== "inactive") {
    return <span className="text-xs text-slate-500">확인 필요</span>;
  }

  return (
    <form action="/api/admin/users" method="post">
      <input name="intent" type="hidden" value="update_status" />
      <input name="profile_id" type="hidden" value={user.id} />
      <input
        name="target_status"
        type="hidden"
        value={user.status === "active" ? "inactive" : "active"}
      />
      <ConfirmSubmitButton
        className={`rounded-md border px-3 py-2 text-sm font-medium ${
          user.status === "active"
            ? "border-amber-300 text-amber-700"
            : "border-emerald-300 text-emerald-700"
        }`}
        confirmDescription={
          user.status === "active"
            ? `${user.email} 계정을 비활성화합니다.`
            : `${user.email} 계정을 다시 활성화합니다.`
        }
        confirmTitle={
          user.status === "active"
            ? "회원을 비활성화하시겠습니까?"
            : "회원을 재활성화하시겠습니까?"
        }
        type="submit"
      >
        {user.status === "active" ? "비활성화" : "재활성화"}
      </ConfirmSubmitButton>
    </form>
  );
}

function ProfileUpdateForm({
  onUserUpdated,
  user,
}: {
  onUserUpdated: (user: AdminUserSummary) => void;
  user: AdminUserSummary;
}) {
  const [optionsPayload, setOptionsPayload] =
    useState<AdminUsersOptionsPayload | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleOptionsToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || optionsPayload || isLoadingOptions) {
      return;
    }

    setIsLoadingOptions(true);
    setOptionsError(null);

    void loadAdminUsersOptions()
      .then(setOptionsPayload)
      .catch(() => {
        setOptionsError("소속 선택값을 불러오지 못했습니다.");
      })
      .finally(() => {
        setIsLoadingOptions(false);
      });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const body = Object.fromEntries(formData.entries());
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "회원 정보 수정에 실패했습니다.");
      }

      const detailResponse = await fetch(`/api/admin/users/${user.id}`, {
        cache: "no-store",
      });

      if (!detailResponse.ok) {
        throw new Error("수정된 회원 정보를 다시 불러오지 못했습니다.");
      }

      const nextDetail = (await detailResponse.json()) as DetailPayload;
      onUserUpdated(nextDetail.user);
      setSaveMessage(payload.message ?? "회원 정보가 수정되었습니다.");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "회원 정보 수정 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const options = optionsPayload?.options;
  const optionErrors = optionsPayload?.optionErrors;
  const ministryPositionOptions = getMinistryPositionOptions(user.ministry_position);
  const generationSelectOptions = getGenerationSelectOptions(
    options?.generations,
    user.generation_number,
  );

  return (
    <details
      className="rounded-md border border-slate-200 bg-slate-50"
      onToggle={handleOptionsToggle}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">회원 정보 수정</h4>
          <p className="mt-1 text-xs text-slate-500">
            이메일과 시스템 역할은 별도 관리 기능에서 변경합니다.
          </p>
        </div>
        <span className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
          수정 열기
        </span>
      </summary>
      {isLoadingOptions ? (
        <div className="border-t border-slate-200 p-4 text-sm text-slate-600">
          소속 선택값을 불러오는 중...
        </div>
      ) : null}
      {optionsError ? (
        <div className="border-t border-red-100 bg-red-50 p-4 text-sm text-red-800">
          {optionsError}
        </div>
      ) : null}
      {saveMessage ? (
        <div className="border-t border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          {saveMessage}
        </div>
      ) : null}
      {saveError ? (
        <div className="border-t border-red-100 bg-red-50 p-4 text-sm text-red-800">
          {saveError}
        </div>
      ) : null}
      {options ? (
      <form
        className="grid gap-4 border-t border-slate-200 p-4"
        onSubmit={handleSubmit}
      >
        <input name="intent" type="hidden" value="update_profile" />
        <input name="profile_id" type="hidden" value={user.id} />
        <fieldset className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">기본 정보</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">이름</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={user.full_name ?? ""}
                maxLength={120}
                name="full_name"
                required
                type="text"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">표시 이름</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={user.display_name ?? ""}
                maxLength={120}
                name="display_name"
                type="text"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">전화번호</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={user.phone ?? ""}
                maxLength={40}
                name="phone"
                type="text"
              />
            </label>
            <div className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">이메일</span>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                {formatEmail(user.email)}
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">소속 정보</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminUserAffiliationFields
              churchOptions={options.churches}
              countryOptions={options.countries}
              errors={{
                churches: optionErrors?.churches,
                countries: optionErrors?.countries,
                groups: optionErrors?.groups,
                organizations: optionErrors?.organizations,
                regions: optionErrors?.regions,
              }}
              groupOptions={options.groups}
              initialValues={{
                church_id: user.church_id,
                country_id: user.country_id,
                group_id: user.group_id,
                organization_id: user.organization_id,
                region_id: user.region_id,
              }}
              organizationOptions={options.organizations}
              regionOptions={options.regions}
            />
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">소속 직분</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={user.ministry_position ?? ""}
                name="ministry_position"
              >
                <option value="">미지정</option>
                {ministryPositionOptions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">역할 및 세대</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">세대</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={user.generation_number ?? ""}
                name="generation_number"
              >
                <option value="">미지정</option>
                {generationSelectOptions.map((generation) => (
                  <option
                    key={generation.generation_number}
                    value={generation.generation_number}
                  >
                    {generation.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">회원 상태</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                defaultValue={user.status}
                name="status"
              >
                {PROFILE_STATUSES.map((profileStatus) => (
                  <option key={profileStatus} value={profileStatus}>
                    {getStatusLabel(profileStatus)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "저장 중..." : "회원 정보 저장"}
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            type="reset"
          >
            수정 취소
          </button>
        </div>
      </form>
      ) : null}
    </details>
  );
}

function MemberDetailContent({
  detail,
  onUserUpdated,
}: {
  detail: DetailPayload;
  onUserUpdated: (user: AdminUserSummary) => void;
}) {
  const { user } = detail;

  return (
    <>
      <section className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold">회원가입 입력 정보</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          현재 선택한 회원의 기본 정보, 소속 정보, 세대와 시스템 자동 기록입니다.
        </p>
      </section>
      <section className="mt-6 rounded-md border border-slate-200 p-4">
        <h3 className="text-base font-semibold">기본 정보</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <DetailValue label="이름" value={displayProfileValue(user.full_name)} />
          <DetailValue label="표시 이름" value={displayProfileValue(user.display_name)} />
          <DetailValue label="이메일" value={formatEmail(user.email)} />
          <DetailValue label="전화번호" value={displayProfileValue(user.phone)} />
        </dl>
      </section>
      <section className="mt-4 rounded-md border border-slate-200 p-4">
        <h3 className="text-base font-semibold">소속 정보</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <DetailValue label="소속 국가" value={formatCountryValue(user)} />
          <DetailValue label="지역/도시" value={formatLookupValue(user.region_name, user.region_id)} />
          <DetailValue
            label="소속 기관/교회"
            value={formatLookupValue(user.organization_name, user.organization_id)}
          />
          <DetailValue label="세부 교회" value={formatLookupValue(user.church_name, user.church_id)} />
          <DetailValue label="그룹/팀/목장" value={formatLookupValue(user.group_name, user.group_id)} />
          <DetailValue label="소속 직분" value={displayProfileValue(user.ministry_position)} />
        </dl>
      </section>
      <section className="mt-4 rounded-md border border-slate-200 p-4">
        <h3 className="text-base font-semibold">세대</h3>
        <dl className="mt-4 grid gap-4">
          <DetailValue label="세대" value={formatGeneration(user.generation_number)} />
        </dl>
      </section>
      <section className="mt-4 rounded-md border border-slate-200 p-4">
        <h3 className="text-base font-semibold">시스템 자동 기록</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <DetailValue label="회원 상태" value={getStatusLabel(user.status)} />
          <DetailValue label="가입일" value={formatDateTime(user.created_at)} />
          <DetailValue label="최근 수정일" value={formatDateTime(user.updated_at)} />
        </dl>
      </section>
      <section className="mt-4 rounded-md border border-slate-200 p-4">
        <h3 className="text-base font-semibold">회원 정보 관리</h3>
        <div className="mt-4 grid gap-4">
          <ProfileUpdateForm onUserUpdated={onUserUpdated} user={user} />
          <LoginGuideCopyButton email={user.email} />
          <StatusChangeForm user={user} />
        </div>
      </section>
      <section className="mt-4 rounded-md border border-slate-200 p-4">
        <h3 className="text-base font-semibold">시스템 역할 관리</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          이 영역은 회원의 시스템 접근 권한을 관리하는 관리자 전용 기능입니다.
        </p>
        <div className="mt-4 grid gap-4">
          <dl className="grid gap-4 rounded-md border border-slate-100 bg-slate-50 p-3">
            <DetailValue
              label="대표 시스템 역할"
              value={user.primary_role ? getRoleLabel(user.primary_role) : "미지정"}
            />
            <div>
              <dt className="text-sm font-medium text-slate-500">시스템 역할</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {user.roles.length === 0 ? (
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    미지정
                  </span>
                ) : (
                  user.roles.map((roleItem) => (
                    <span
                      className="inline-flex flex-col rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                      key={roleItem.id}
                    >
                      <span>{getRoleLabel(roleItem.role)}</span>
                      <span className="mt-0.5 text-[11px] font-normal text-slate-500">
                        역할 상태: {getRoleActiveLabel(roleItem)}
                      </span>
                    </span>
                  ))
                )}
              </dd>
            </div>
            <DetailValue label="역할 권한 범위" value={formatScopeSummary(user.roles)} />
          </dl>
          <RoleChangeForm user={user} />
          <div className="grid gap-2 rounded-md border border-dashed border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-700">시스템 역할 활성/비활성</p>
            {user.roles.length === 0 ? (
              <p className="text-xs text-slate-500">미지정</p>
            ) : (
              <div className="grid gap-2">
                {user.roles.map((roleItem) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                    key={roleItem.id}
                  >
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        {getRoleLabel(roleItem.role)}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        역할 상태: {getRoleActiveLabel(roleItem)}
                      </p>
                    </div>
                    <RoleStatusToggleForm roleItem={roleItem} user={user} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <RoleAddForm user={user} />
        </div>
      </section>
    </>
  );
}

export function AdminUserDetailDrawer({ user }: { user: AdminUserSummary }) {
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || detail || isLoading) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void fetch(`/api/admin/users/${user.id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("detail request failed");
        }

        setDetail((await response.json()) as DetailPayload);
      })
      .catch((fetchError) => {
        if ((fetchError as Error).name !== "AbortError") {
          setError("회원 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });
  }

  return (
    <details className="group" onToggle={handleToggle}>
      <summary className="cursor-pointer list-none rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 group-open:fixed group-open:right-4 group-open:top-4 group-open:z-50 group-open:border-slate-700 group-open:bg-white group-open:shadow-lg">
        <span className="group-open:hidden">
          <I18nText k="common.view" fallback="상세보기" />
        </span>
        <span className="hidden group-open:inline">
          <I18nText k="common.close" fallback="닫기" />
        </span>
      </summary>
      <div className="fixed inset-x-0 bottom-0 top-0 z-40 w-full overflow-y-auto border-l border-slate-200 bg-white p-4 text-slate-950 shadow-xl sm:inset-x-auto sm:right-0 sm:max-w-xl sm:p-6 lg:max-w-2xl">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              회원 상세정보
            </p>
            <p className="mt-1 text-sm text-slate-600">
              상세 정보와 수정 폼은 열 때마다 별도로 불러옵니다.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            회원 정보를 불러오는 중...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {detail ? (
          <MemberDetailContent
            detail={detail}
            onUserUpdated={(nextUser) =>
              setDetail((current) =>
                current
                  ? {
                      ...current,
                      user: nextUser,
                    }
                  : { user: nextUser },
              )
            }
          />
        ) : null}
      </div>
    </details>
  );
}
