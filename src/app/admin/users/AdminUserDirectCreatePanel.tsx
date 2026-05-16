"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { formatScope, getRoleLabel } from "@/lib/ui/labels";
import { USER_ROLES, type ScopeType, type UserRole } from "@/types/database";
import { AdminUserAffiliationFields } from "./AdminUserAffiliationFields";
import {
  loadAdminUsersOptions,
  type AdminUserGenerationOption,
  type AdminUsersOptionsPayload,
} from "./AdminUsersOptionsCache";

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

function getGenerationOptions(options: AdminUserGenerationOption[]) {
  return options.length > 0 ? options : FALLBACK_GENERATION_OPTIONS;
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
  optionsPayload,
  scopeType,
}: {
  optionsPayload: AdminUsersOptionsPayload;
  scopeType: ScopeType | "";
}) {
  const sharedClassName =
    "rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal disabled:bg-slate-100 disabled:text-slate-500";

  if (!scopeType) {
    return (
      <label className="grid gap-2 lg:col-span-3">
        <span className="text-sm font-medium text-slate-700">권한 범위</span>
        <input
          className={sharedClassName}
          disabled
          placeholder="권한 범위 유형을 먼저 선택하세요."
          type="text"
        />
      </label>
    );
  }

  if (isLookupScopeType(scopeType)) {
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
      <label className="grid gap-2 lg:col-span-3">
        <span className="text-sm font-medium text-slate-700">권한 범위</span>
        <select className={sharedClassName} name="scope_id" required>
          <option value="">권한을 적용할 범위를 선택하세요</option>
          {lookupOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs leading-5 text-slate-500">
          권한 범위는 회원 소속 정보와 다를 수 있습니다.
        </span>
      </label>
    );
  }

  return (
    <label className="grid gap-2 lg:col-span-3">
      <span className="text-sm font-medium text-slate-700">권한 범위 ID</span>
      <input
        className={sharedClassName}
        name="scope_id"
        placeholder="선택한 권한 범위의 ID를 입력하세요."
        required
        type="text"
      />
      <span className="text-xs leading-5 text-slate-500">
        이 범위는 선택 목록이 준비되지 않아 ID 입력이 필요합니다. 값이 확실한
        경우에만 등록하세요.
      </span>
    </label>
  );
}

export function AdminUserDirectCreatePanel() {
  const [payload, setPayload] = useState<AdminUsersOptionsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [selectedScopeType, setSelectedScopeType] = useState<ScopeType | "">("");
  const allowedScopeTypes = selectedRole
    ? ROLE_SCOPE_RULES[selectedRole] ?? []
    : [];

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || payload || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    void loadAdminUsersOptions()
      .then(setPayload)
      .catch(() => {
        setError("회원 등록 선택값을 불러오지 못했습니다.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <details
      className="group mt-6 rounded-md border border-slate-200 bg-white"
      onToggle={handleToggle}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">
            <I18nText k="members.directCreate" fallback="직접 회원 등록" />
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            <I18nText
              k="members.directCreateDescription"
              fallback="기존 이메일 초대 방식은 유지하고, 필요한 경우에만 직접 등록합니다."
            />
          </p>
        </div>
        <span className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
          <span className="group-open:hidden">
            <I18nText k="members.openCreate" fallback="회원 등록 열기" />
          </span>
          <span className="hidden group-open:inline">
            <I18nText k="members.closeCreate" fallback="회원 등록 닫기" />
          </span>
        </span>
      </summary>

      <div className="border-t border-slate-200 px-5 pb-5 pt-4">
        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            회원 등록 선택값을 불러오는 중...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {payload ? (
          <>
            <p className="text-sm text-slate-600">
              <I18nText
                k="members.directCreateHelp"
                fallback="이메일 발송 없이 Supabase Auth 계정을 만들고 기존 프로필/역할 구조에 연결합니다."
              />
            </p>
            <form
              action="/api/admin/users"
              className="mt-4 grid gap-5"
              method="post"
            >
              <input name="intent" type="hidden" value="create_profile" />
              <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">
                  기본 정보
                </legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">이름</span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      maxLength={120}
                      name="full_name"
                      required
                      type="text"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">이메일</span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      name="email"
                      required
                      type="email"
                    />
                  </label>
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      임시 비밀번호
                    </span>
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      maxLength={72}
                      minLength={8}
                      name="temporary_password"
                      required
                      type="text"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">
                  소속 정보
                </legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminUserAffiliationFields
                    churchOptions={payload.options.churches}
                    countryOptions={payload.options.countries}
                    errors={{
                      churches: payload.optionErrors?.churches,
                      countries: payload.optionErrors?.countries,
                      groups: payload.optionErrors?.groups,
                      organizations: payload.optionErrors?.organizations,
                      regions: payload.optionErrors?.regions,
                    }}
                    groupOptions={payload.options.groups}
                    organizationOptions={payload.options.organizations}
                    regionOptions={payload.options.regions}
                  />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      소속 직분
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      defaultValue=""
                      name="ministry_position"
                    >
                      <option value="">미지정</option>
                      {MINISTRY_POSITION_OPTIONS.map((position) => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-800">
                  역할 및 세대
                </legend>
                <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  <p>
                    권한 범위는 회원 소속 정보와 다를 수 있습니다. 관리자 권한은
                    해당 범위의 사용자와 기록에 접근할 수 있으므로 신중히
                    선택하세요.
                  </p>
                  <p className="mt-1 text-xs">
                    최고관리자 권한은 이 화면에서 새로 추가할 수 없습니다.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      시스템 역할
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      name="role"
                      onChange={(event) => {
                        setSelectedRole(event.currentTarget.value as UserRole | "");
                        setSelectedScopeType("");
                      }}
                      required
                      value={selectedRole}
                    >
                      <option value="">역할 선택</option>
                      {MANAGEABLE_USER_ROLES.map((userRole) => (
                        <option key={userRole} value={userRole}>
                          {getRoleLabel(userRole)}
                        </option>
                      ))}
                    </select>
                    {selectedRole && ADMIN_LEVEL_ROLES.has(selectedRole) ? (
                      <span className="text-xs leading-5 text-amber-700">
                        관리자 권한은 선택한 범위 안의 관리 기능에 접근할 수
                        있습니다.
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">세대</span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal"
                      defaultValue=""
                      name="generation_number"
                    >
                      <option value="">미지정</option>
                      {getGenerationOptions(payload.options.generations).map(
                        (generation) => (
                          <option
                            key={generation.generation_number}
                            value={generation.generation_number}
                          >
                            {generation.label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      권한 범위 유형
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 font-sans tracking-normal disabled:bg-slate-100 disabled:text-slate-500"
                      disabled={!selectedRole}
                      name="scope_type"
                      onChange={(event) =>
                        setSelectedScopeType(event.currentTarget.value as ScopeType | "")
                      }
                      required
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
                  </label>
                  <ScopeIdField
                    optionsPayload={payload}
                    scopeType={selectedScopeType}
                  />
                </div>
              </fieldset>

              <div>
                <button
                  className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
                  type="submit"
                >
                  직접 회원 등록
                </button>
                <p className="mt-2 text-sm text-slate-500">
                  생성 성공 후 임시 비밀번호를 사용자에게 직접 전달하세요.
                </p>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </details>
  );
}
