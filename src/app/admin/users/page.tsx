import { redirect } from "next/navigation";
import {
  getAdminUsers,
  normalizeAdminUserRole,
  normalizeAdminUsersPage,
  normalizeAdminUserSearch,
  normalizeAdminUserStatus,
  type AdminUserSummary,
} from "@/lib/api/admin/users";
import { PROFILE_STATUSES, USER_ROLES } from "@/types/database";
import { formatScope, getRoleLabel, getStatusLabel } from "@/lib/ui/labels";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import { I18nText } from "@/lib/i18n/I18nProvider";
import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { AdminUsersClientFilters } from "./AdminUsersClientFilters";
import { AdminUserDetailDrawer } from "./AdminUserDetailDrawer";
import { AdminUserDirectCreatePanel } from "./AdminUserDirectCreatePanel";
import { AdminUserRoleSummaryCards } from "./AdminUserRoleSummaryCards";
import { LoginGuideCopyButton } from "./LoginGuideCopyButton";


type SearchParams = Record<string, string | string[] | undefined>;
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

function formatDate(value: string | null) {
  const formatted = formatDateTime(value);

  return formatted === "미지정" ? formatted : formatted.slice(0, 10);
}

function formatName(user: AdminUserSummary) {
  const candidates = [user.display_name, user.full_name, user.email];

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return "이름 없음";
}

function formatEmail(value: string | null) {
  return value && value.trim().length > 0 ? value : "이메일 없음";
}

function displayProfileValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "미지정";
}

function shortenId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
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

function formatScopeSummary(roles: AdminUserSummary["roles"]) {
  if (roles.length === 0) {
    return "미등록";
  }

  return roles
    .map((role) => formatScope(role.scope_type, role.scope_id))
    .join(", ");
}

function getRepresentativeRole(user: AdminUserSummary) {
  return user.roles.find(isActiveRole) ?? user.roles[0] ?? null;
}

function getRowSearchText(user: AdminUserSummary) {
  return [
    user.display_name,
    user.full_name,
    user.email,
    user.phone,
    user.country_id,
    user.country_code,
    user.country_name,
    user.region_id,
    user.region_name,
    user.organization_id,
    user.organization_name,
    user.church_id,
    user.church_name,
    user.group_id,
    user.group_name,
    user.ministry_position,
    formatGeneration(user.generation_number),
    user.primary_role,
    user.primary_role ? getRoleLabel(user.primary_role) : null,
    formatScopeSummary(user.roles),
    user.roles.map((roleItem) => roleItem.role).join(" "),
    user.roles.map((roleItem) => getRoleLabel(roleItem.role)).join(" "),
    user.roles
      .map((roleItem) =>
        roleItem.status === "active" && roleItem.is_active
          ? "역할 상태 활성 active"
          : "역할 상태 비활성 inactive",
      )
      .join(" "),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function formatProfileAffiliationSummary(user: AdminUserSummary) {
  const parts = [
    `국가 ${formatCountryValue(user)}`,
    `지역/도시 ${formatLookupValue(user.region_name, user.region_id)}`,
    `기관 및 단체 ${formatLookupValue(user.organization_name, user.organization_id)}`,
    `교회 ${formatLookupValue(user.church_name, user.church_id)}`,
    `그룹/팀/목장 ${formatLookupValue(user.group_name, user.group_id)}`,
    `직분 ${displayProfileValue(user.ministry_position)}`,
    `세대 ${formatGeneration(user.generation_number)}`,
  ];

  return parts.join(" · ");
}

function getRowRoleValues(user: AdminUserSummary) {
  return user.roles.map((roleItem) => roleItem.role).join(",");
}

function getRoleActiveLabel(roleItem: AdminUserSummary["roles"][number]) {
  return roleItem.status === "active" && roleItem.is_active ? "활성" : "비활성";
}

function isActiveRole(roleItem: AdminUserSummary["roles"][number]) {
  return roleItem.status === "active" && roleItem.is_active;
}

function getUserStatusBadgeTone(status: AdminUserSummary["status"]) {
  if (status === "active") {
    return "success";
  }

  if (status === "suspended") {
    return "warning";
  }

  if (status === "anonymized") {
    return "danger";
  }

  return "neutral";
}

function RoleBadgeList({ roles }: { roles: AdminUserSummary["roles"] }) {
  if (roles.length === 0) {
    return (
      <Badge tone="neutral">
        <I18nText k="members.notSpecified" fallback="미지정" />
      </Badge>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {roles.map((roleItem) => (
        <Badge
          key={roleItem.id}
          tone={isActiveRole(roleItem) ? "info" : "neutral"}
          title={`역할 상태: ${getRoleActiveLabel(roleItem)}`}
        >
          <I18nText
            k={`roles.${roleItem.role}`}
            fallback={getRoleLabel(roleItem.role)}
          />
        </Badge>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminUserSummary["status"] }) {
  return (
    <Badge tone={getUserStatusBadgeTone(status)}>
      {getStatusLabel(status)}
    </Badge>
  );
}

function ProfileAffiliationBadges({ user }: { user: AdminUserSummary }) {
  const items = [
    ["국가", formatCountryValue(user)],
    ["지역", formatLookupValue(user.region_name, user.region_id)],
    ["기관", formatLookupValue(user.organization_name, user.organization_id)],
    ["교회", formatLookupValue(user.church_name, user.church_id)],
    ["그룹", formatLookupValue(user.group_name, user.group_id)],
    ["직분", displayProfileValue(user.ministry_position)],
    ["세대", formatGeneration(user.generation_number)],
  ] as const;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {items.map(([label, value]) => (
        <Badge
          className="max-w-full justify-start whitespace-normal break-words text-left"
          key={label}
          tone={value === "미지정" ? "neutral" : "info"}
        >
          <span className="font-semibold">{label}</span>
          <span className="text-ink-faint">·</span>
          <span className="min-w-0 break-words">{value}</span>
        </Badge>
      ))}
    </div>
  );
}

function getEmptyUsersMessage({
  q,
  role,
  status,
}: {
  q: string;
  role: string;
  status: string;
}) {
  if (role !== "all") {
    return "선택한 역할에 해당하는 회원이 없습니다.";
  }

  if (q.length > 0 || status !== "all") {
    return "검색 조건에 맞는 회원이 없습니다.";
  }

  return "등록된 회원이 없습니다.";
}

type FieldBadgeTone = "edit" | "new" | "auto" | "admin";

function FieldBadge({
  children,
  tone,
}: {
  children: string;
  tone: FieldBadgeTone;
}) {
  const toneClass: Record<FieldBadgeTone, string> = {
    edit: "border-sky-200 bg-sky-50 text-sky-700",
    new: "border-emerald-200 bg-emerald-50 text-emerald-700",
    auto: "border-line-base bg-surface-sunken text-ink-muted",
    admin: "border-amber-200 bg-amber-50 text-amber-700",
  };
  const labelKey: Record<string, string> = {
    "관리자 설정": "adminUsers.badgeAdmin",
    "수정": "adminUsers.badgeEdit",
    "신규": "adminUsers.badgeNew",
    "자동": "adminUsers.badgeAuto",
  };

  return (
    <span
      className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass[tone]}`}
    >
      {labelKey[children] ? (
        <I18nText k={labelKey[children]} fallback={children} />
      ) : (
        children
      )}
    </span>
  );
}

function DetailValue({
  label,
  value,
  badge,
  tone = "edit",
}: {
  label: string;
  value: string;
  badge?: string;
  tone?: FieldBadgeTone;
}) {
  const labelKey: Record<string, string> = {
    "가입일": "members.createdOn",
    "대표 시스템 역할": "members.primarySystemRole",
    "소속 교회": "members.church",
    "소속 국가": "members.country",
    "소속 기관 및 단체": "members.organizationName",
    "소속 직분": "members.ministryPosition",
    "세대": "members.generation",
    "역할 권한 범위": "members.roleScopePermission",
    "이름": "members.fullName",
    "이메일": "members.email",
    "전화번호": "members.phone",
    "최근 수정일": "members.updatedAt",
    "표시 이름": "members.displayName",
    "회원 상태": "members.memberStatus",
  };

  return (
    <div>
      <dt className="text-sm font-medium text-ink-faint">
        {labelKey[label] ? <I18nText k={labelKey[label]} fallback={label} /> : label}
        {badge ? <FieldBadge tone={tone}>{badge}</FieldBadge> : null}
      </dt>
      <dd className="mt-1 break-words text-ink-strong">{value}</dd>
    </div>
  );
}

function StatusChangeForm({
  representativeRole,
  user,
}: {
  representativeRole: AdminUserSummary["roles"][number] | null;
  user: AdminUserSummary;
}) {
  if (representativeRole?.role === "super_admin") {
    return (
      <span className="text-xs text-ink-faint">
        <I18nText k="members.protectedSuperAdmin" fallback="super_admin 보호" />
      </span>
    );
  }

  if (user.status !== "active" && user.status !== "inactive") {
    return (
      <span className="text-xs text-ink-faint">
        <I18nText k="members.needsReview" fallback="확인 필요" />
      </span>
    );
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
            ? `${user.email} 계정을 비활성화합니다. 기존 로그인과 접근에 영향을 줄 수 있습니다.`
            : `${user.email} 계정을 다시 활성화합니다.`
        }
        confirmTitle={
          user.status === "active"
            ? "회원을 비활성화하시겠습니까?"
            : "회원을 재활성화하시겠습니까?"
        }
        type="submit"
      >
        {user.status === "active" ? (
          <I18nText k="members.disable" fallback="비활성화" />
        ) : (
          <I18nText k="members.reactivate" fallback="재활성화" />
        )}
      </ConfirmSubmitButton>
    </form>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getCreateUserMessage({
  created,
  createdEmail,
  error,
  errorStage,
}: {
  created: string;
  createdEmail: string;
  error: string;
  errorStage: string;
}) {
  if (created === "1") {
    return {
      tone: "success" as const,
      message: `${createdEmail || "사용자"} 계정이 생성되었습니다. 임시 비밀번호를 사용자에게 직접 전달하세요. 사용자에게 첫 로그인 후 비밀번호 변경을 안내하세요.`,
    };
  }

  if (!error) {
    return null;
  }

  const stageLabel: Record<string, string> = {
    auth: "인증 사용자 생성",
    validation: "입력값 확인",
    profile: "프로필 연결",
    role: "역할 부여",
    service: "관리자 서비스 준비",
  };
  const errorLabel: Record<string, string> = {
    invalid_body: "요청 본문을 읽을 수 없습니다. 다시 시도해 주세요.",
    invalid_intent: "요청한 회원 관리 작업을 확인할 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
    invalid_name: "이름을 입력해 주세요. 이름은 120자 이하로 입력해야 합니다.",
    invalid_email: "이메일 형식을 확인해 주세요.",
    invalid_role: "역할 값이 올바르지 않습니다.",
    invalid_scope: "권한 범위 유형이 올바르지 않습니다.",
    invalid_scope_id: "권한 범위 ID 형식이 올바르지 않습니다.",
    missing_scope_id:
      "범위 유형이 organization/church/group 등 global이 아닌 경우 범위 ID가 필요합니다.",
    invalid_password: "임시 비밀번호는 8자 이상 72자 이하로 입력해 주세요.",
    invalid_phone: "전화번호는 40자 이하로 입력해 주세요.",
    registered_profile: "이미 등록된 회원입니다. 로그인 또는 비밀번호 재설정을 진행하세요.",
    auth_without_profile:
      "해당 이메일은 Supabase Auth에는 이미 존재하지만, 앱 프로필 연결 상태를 확인해야 합니다. 테스트 계정이면 Supabase Authentication에서 삭제 후 다시 등록하세요.",
    auth_lookup_failed:
      "기존 Auth 사용자 여부를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    auth_create_failed: "인증 사용자 생성에 실패했습니다.",
    profile_create_failed: "프로필 생성에 실패했습니다.",
    role_create_failed: "역할 부여에 실패했습니다.",
    super_admin_protected: "super_admin 역할은 이 화면에서 생성할 수 없습니다.",
    invalid_affiliation:
      "소속 국가, 소속 기관 및 단체, 소속 교회, 소속 직분 값을 확인해 주세요.",
    invalid_country: "소속 국가 값이 올바르지 않습니다.",
    country_not_found: "선택한 국가가 존재하지 않습니다.",
    country_inactive: "선택한 국가는 현재 사용할 수 없습니다.",
    country_lookup_failed:
      "선택한 국가를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    invalid_organization: "소속 기관 및 단체 ID 형식이 올바르지 않습니다.",
    invalid_region: "지역/도시 값이 올바르지 않습니다.",
    region_lookup_failed: "선택한 지역/도시를 확인하지 못했습니다.",
    region_not_found: "선택한 지역/도시를 찾을 수 없습니다.",
    organization_lookup_failed:
      "선택한 소속 기관 및 단체를 확인하지 못했습니다.",
    organization_not_found: "선택한 소속 기관 및 단체를 찾을 수 없습니다.",
    invalid_church: "소속 교회 ID 형식이 올바르지 않습니다.",
    church_lookup_failed: "선택한 소속 교회를 확인하지 못했습니다.",
    church_not_found: "선택한 소속 교회를 찾을 수 없습니다.",
    invalid_group: "그룹/팀/목장 값이 올바르지 않습니다.",
    group_lookup_failed: "선택한 그룹/팀/목장을 확인하지 못했습니다.",
    group_not_found: "선택한 그룹/팀/목장을 찾을 수 없습니다.",
    invalid_ministry_position: "소속 직분은 100자 이하로 입력해 주세요.",
    invalid_generation: "세대 값은 1 이상의 숫자여야 합니다.",
  };

  return {
    tone: "error" as const,
    message: `${stageLabel[errorStage] ?? "직접 회원 등록"} 단계에서 실패했습니다. ${errorLabel[error] ?? "입력값 또는 기존 계정 여부를 확인해 주세요."}`,
  };
}

function getRoleChangeMessage({
  added,
  statusUpdated,
  updated,
  error,
}: {
  added: string;
  statusUpdated: string;
  updated: string;
  error: string;
}) {
  if (added === "1") {
    return {
      tone: "success" as const,
      message: "역할이 추가되었습니다.",
    };
  }

  if (updated === "1") {
    return {
      tone: "success" as const,
      message: "역할이 변경되었습니다.",
    };
  }

  if (statusUpdated === "active") {
    return {
      tone: "success" as const,
      message: "시스템 역할이 활성화되었습니다.",
    };
  }

  if (statusUpdated === "inactive") {
    return {
      tone: "success" as const,
      message: "시스템 역할이 비활성화되었습니다.",
    };
  }

  if (!error) {
    return null;
  }

  const errorLabel: Record<string, string> = {
    duplicate_role:
      "이미 부여된 역할입니다. 비활성 역할은 역할 상태에서 다시 활성화해 주세요.",
    invalid_role: "허용되지 않은 역할입니다.",
    invalid_scope: "권한 범위 유형이 올바르지 않습니다.",
    invalid_scope_id: "권한 범위 ID 형식이 올바르지 않습니다.",
    invalid_status: "허용되지 않은 역할 상태입니다.",
    member_not_found: "회원을 찾을 수 없습니다.",
    missing_scope_id: "global이 아닌 권한 범위에는 범위 ID가 필요합니다.",
    profile_lookup_failed: "프로필 테이블 조회에 실패했습니다.",
    role_add_failed: "역할 추가에 실패했습니다.",
    role_lookup_failed: "역할 정보를 조회할 수 없습니다.",
    role_not_found: "변경할 역할을 찾을 수 없습니다.",
    role_status_update_failed: "역할 상태 변경에 실패했습니다.",
    role_update_failed: "역할 변경에 실패했습니다.",
    self_role_change: "자기 자신의 역할은 변경할 수 없습니다.",
    super_admin_protected: "super_admin 역할은 이 화면에서 변경할 수 없습니다.",
  };

  return {
    tone: "error" as const,
    message: errorLabel[error] ?? "역할 변경 중 오류가 발생했습니다.",
  };
}

function getStatusChangeMessage({
  updated,
  error,
}: {
  updated: string;
  error: string;
}) {
  if (updated === "inactive") {
    return {
      tone: "success" as const,
      message: "회원이 비활성화되었습니다.",
    };
  }

  if (updated === "active") {
    return {
      tone: "success" as const,
      message: "회원이 재활성화되었습니다.",
    };
  }

  if (!error) {
    return null;
  }

  const errorLabel: Record<string, string> = {
    disable_failed: "비활성화 처리에 실패했습니다.",
    invalid_status: "허용되지 않은 상태값입니다.",
    member_not_found: "회원을 찾을 수 없습니다.",
    profile_lookup_failed: "프로필 테이블 조회에 실패했습니다.",
    reactivate_failed: "재활성화 처리에 실패했습니다.",
    role_lookup_failed: "역할 정보를 조회할 수 없습니다.",
    self_disable: "현재 로그인한 본인 계정은 비활성화할 수 없습니다.",
    super_admin_protected: "super_admin 계정은 이 화면에서 비활성화할 수 없습니다.",
  };

  return {
    tone: "error" as const,
    message: errorLabel[error] ?? "회원 상태 변경 중 오류가 발생했습니다.",
  };
}

function getProfileUpdateMessage({
  updated,
  error,
}: {
  updated: string;
  error: string;
}) {
  if (updated === "1") {
    return {
      tone: "success" as const,
      message: "회원 정보가 수정되었습니다.",
    };
  }

  if (!error) {
    return null;
  }

  const errorLabel: Record<string, string> = {
    country_inactive: "선택한 국가는 현재 사용할 수 없습니다.",
    country_lookup_failed: "선택한 국가를 확인하지 못했습니다.",
    country_not_found: "선택한 국가를 찾을 수 없습니다.",
    invalid_church: "소속 교회 ID 형식이 올바르지 않습니다.",
    invalid_country: "국가 값이 올바르지 않습니다.",
    invalid_display_name: "표시 이름은 120자 이하로 입력해 주세요.",
    invalid_generation: "세대 값은 1 이상의 숫자여야 합니다.",
    invalid_ministry_position: "소속 직분은 100자 이하로 입력해 주세요.",
    invalid_name: "이름을 입력해 주세요. 이름은 120자 이하로 입력해야 합니다.",
    invalid_organization: "소속 기관 및 단체 ID 형식이 올바르지 않습니다.",
    invalid_region: "지역/도시 값이 올바르지 않습니다.",
    region_lookup_failed: "선택한 지역/도시를 확인하지 못했습니다.",
    region_not_found: "선택한 지역/도시를 찾을 수 없습니다.",
    church_lookup_failed: "선택한 소속 교회를 확인하지 못했습니다.",
    church_not_found: "선택한 소속 교회를 찾을 수 없습니다.",
    invalid_group: "그룹/팀/목장 값이 올바르지 않습니다.",
    group_lookup_failed: "선택한 그룹/팀/목장을 확인하지 못했습니다.",
    group_not_found: "선택한 그룹/팀/목장을 찾을 수 없습니다.",
    organization_lookup_failed:
      "선택한 소속 기관 및 단체를 확인하지 못했습니다.",
    organization_not_found: "선택한 소속 기관 및 단체를 찾을 수 없습니다.",
    invalid_phone: "전화번호는 40자 이하로 입력해 주세요.",
    invalid_status: "허용되지 않은 회원 상태입니다.",
    member_not_found: "회원을 찾을 수 없습니다.",
    permission_denied: "회원 정보 수정은 super_admin만 가능합니다.",
    profile_lookup_failed: "프로필 조회에 실패했습니다.",
    update_failed: "회원 정보 수정에 실패했습니다.",
  };

  return {
    tone: "error" as const,
    message: errorLabel[error] ?? "회원 정보 수정 중 오류가 발생했습니다.",
  };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    if (admin.status === 401) {
      redirect("/login?redirectTo=%2Fadmin%2Fusers");
    }

    redirect("/unauthorized");
  }

  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};
  const q = normalizeAdminUserSearch(resolvedSearchParams.q);
  const role = normalizeAdminUserRole(resolvedSearchParams.role);
  const status = normalizeAdminUserStatus(resolvedSearchParams.status);
  const page = normalizeAdminUsersPage(resolvedSearchParams.page);
  const createUserMessage = getCreateUserMessage({
    created: firstParam(resolvedSearchParams.created),
    createdEmail: firstParam(resolvedSearchParams.created_email),
    error: firstParam(resolvedSearchParams.create_error),
    errorStage: firstParam(resolvedSearchParams.create_error_stage),
  });
  const roleChangeMessage = getRoleChangeMessage({
    added: firstParam(resolvedSearchParams.role_added),
    statusUpdated: firstParam(resolvedSearchParams.role_status_updated),
    updated: firstParam(resolvedSearchParams.role_updated),
    error: firstParam(resolvedSearchParams.role_error),
  });
  const statusChangeMessage = getStatusChangeMessage({
    updated: firstParam(resolvedSearchParams.status_updated),
    error: firstParam(resolvedSearchParams.status_error),
  });
  const profileUpdateMessage = getProfileUpdateMessage({
    updated: firstParam(resolvedSearchParams.profile_updated),
    error: firstParam(resolvedSearchParams.profile_error),
  });
  const adminUsersResult = await getAdminUsers({
    authorizedAdmin: admin,
    q,
    role,
    status,
    page,
    limit: 50,
  });
  const { users, error } = adminUsersResult;

  const getUserCountryLabel = (user: AdminUserSummary) => formatCountryValue(user);
  return (
    <main className="min-h-screen bg-[var(--trust-bg)] px-4 py-6 text-ink-strong sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-7xl">
        <Card>
          <CardHeader className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Badge icon="users" tone="info">
                <I18nText k="members.admin" fallback="관리자" />
              </Badge>
              <CardTitle className="mt-3 text-2xl sm:text-3xl">
                <I18nText k="members.usersAndRoles" fallback="사용자 및 역할" />
              </CardTitle>
              <CardDescription className="mt-4 max-w-3xl leading-7">
                <I18nText
                  k="members.pageDescription"
                  fallback="프로필과 활성 역할을 조회하고, 필요한 경우 관리자가 직접 회원을 등록할 수 있습니다."
                />
              </CardDescription>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-faint">
                <I18nText
                  k="members.invitationNotice"
                  fallback="기존 이메일 초대 방식은 그대로 유지됩니다. 직접 등록 시 임시 비밀번호는 별도로 전달해야 합니다."
                />
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-3 lg:justify-end">
              <PageNavigationButtons className="justify-start sm:justify-end" />
              <ButtonLink
                href="/admin/coaching-relationships/new"
                icon="users"
                variant="secondary"
              >
                <I18nText k="members.createRelationship" fallback="코칭 관계 생성" />
              </ButtonLink>
              <ButtonLink href="/admin/invitations/new" icon="users">
                <I18nText k="members.addMember" fallback="회원 추가" />
              </ButtonLink>
            </div>
          </CardHeader>
        </Card>

        <div className="mt-6">
          <AdminUserDirectCreatePanel />
        </div>

        {!error ? (
          <section className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">역할별 회원 요약</CardTitle>
                <CardDescription>
                  회원 목록은 먼저 표시하고, 역할별 요약은 별도로 불러옵니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminUserRoleSummaryCards />
              </CardContent>
            </Card>
          </section>
        ) : null}

        {createUserMessage ? (
          <div
            className={`mt-6 rounded-lg border p-4 text-sm leading-6 ${
              createUserMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {createUserMessage.message}
          </div>
        ) : null}

        {roleChangeMessage ? (
          <div
            className={`mt-6 rounded-lg border p-4 text-sm leading-6 ${
              roleChangeMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {roleChangeMessage.message}
          </div>
        ) : null}

        {statusChangeMessage ? (
          <div
            className={`mt-6 rounded-lg border p-4 text-sm leading-6 ${
              statusChangeMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {statusChangeMessage.message}
          </div>
        ) : null}

        {profileUpdateMessage ? (
          <div
            className={`mt-6 rounded-lg border p-4 text-sm leading-6 ${
              profileUpdateMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {profileUpdateMessage.message}
          </div>
        ) : null}

        {error && (
          <div className="mt-6 rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            지금 사용자를 불러올 수 없습니다.
          </div>
        )}

        {!error && users.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6 text-sm text-ink-muted">
            {getEmptyUsersMessage({ q, role, status })}
            </CardContent>
          </Card>
        )}

        {!error && users.length > 0 && (
          <AdminUsersClientFilters
            roleOptions={USER_ROLES.map((userRole) => ({
              value: userRole,
              label: getRoleLabel(userRole),
            }))}
            statusOptions={PROFILE_STATUSES.map((profileStatus) => ({
              value: profileStatus,
              label: getStatusLabel(profileStatus),
            }))}
            totalCount={users.length}
          >
            <Card className="mt-6 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">
                  <I18nText k="members.title" fallback="회원목록" />
                </CardTitle>
                <CardDescription>
                  <I18nText
                    k="members.currentListDescription"
                    fallback="검색, 필터, 정렬, 페이지네이션을 사용해 현재 목록을 확인합니다."
                  />
                </CardDescription>
                <p className="text-sm text-ink-faint lg:hidden">
                  표는 가로로 스크롤해 전체 내용을 확인하세요.
                </p>
              </CardHeader>
              <CardContent className="p-3 pt-0 lg:p-0">
                <div className="overflow-x-auto">
                  <table className="block min-w-full table-auto border-collapse text-left text-sm lg:table">
                <thead className="hidden lg:table-header-group">
                  <tr className="border-b border-line-soft bg-surface-sunken/80 text-xs uppercase tracking-wide text-ink-faint">
                    <th className="w-[22%] px-3 py-3 font-medium">
                      <button
                        className="font-medium"
                        data-admin-user-sort="name"
                        data-sort-label="이름"
                        type="button"
                      >
                        <I18nText k="members.memberInfo" fallback="회원 정보" />
                      </button>
                    </th>
                    <th className="w-[9%] px-3 py-3 font-medium">
                      <button
                        className="font-medium"
                        data-admin-user-sort="status"
                        data-sort-label="상태"
                        type="button"
                      >
                        <I18nText k="members.status" fallback="상태" />
                      </button>
                    </th>
                    <th className="w-[20%] px-3 py-3 font-medium">
                      <button
                        className="font-medium"
                        data-admin-user-sort="role"
                        data-sort-label="역할"
                        type="button"
                      >
                        <I18nText k="members.roleScope" fallback="역할/범위" />
                      </button>
                    </th>
                    <th className="w-[22%] px-3 py-3 font-medium">
                      <I18nText k="members.organization" fallback="소속 정보" />
                    </th>
                    <th className="w-[12%] px-3 py-3 font-medium">
                      <button
                        className="font-medium"
                        data-admin-user-sort="created_at"
                        data-sort-label="생성일"
                        type="button"
                      >
                        <I18nText k="members.recordInfo" fallback="기록 정보" />
                      </button>
                    </th>
                    <th className="w-[8%] px-3 py-3 font-medium">
                      <I18nText k="members.loginGuide" fallback="로그인 안내" />
                    </th>
                    <th className="w-[12%] px-3 py-3 text-right font-medium">
                      <I18nText k="members.actions" fallback="관리" />
                    </th>
                  </tr>
                </thead>
                <tbody className="block space-y-4 lg:table-row-group lg:space-y-0">
                  {users.map((user) => (
                    <tr
                      className="block rounded-card border border-line-base bg-surface-card p-4 text-ink-base shadow-sm transition lg:table-row lg:border-0 lg:border-b lg:border-line-soft lg:p-0 lg:shadow-none lg:hover:bg-[var(--trust-primary-soft)]/40"
                      data-admin-user-row
                      data-created-at={user.created_at}
                      data-email={user.email ?? ""}
                      data-name={formatName(user)}
                      data-primary-role={getRepresentativeRole(user)?.role ?? ""}
                      data-roles={getRowRoleValues(user)}
                      data-search={getRowSearchText(user)}
                      data-scope={`${formatScopeSummary(user.roles)} ${formatProfileAffiliationSummary(user)}`}
                      data-status={user.status}
                      key={user.id}
                    >
                      {(() => {
                        const representativeRole = getRepresentativeRole(user);

                        return (
                          <>
                            <td className="block border-b border-line-soft pb-3 lg:table-cell lg:border-b-0 lg:px-3 lg:py-3">
                              <div className="flex items-start justify-between gap-3 lg:block">
                                <div className="min-w-0">
                                  <p className="break-words text-base font-semibold text-ink-strong lg:text-sm">
                                    {formatName(user)}
                                  </p>
                                  <p className="mt-1 break-all text-sm text-ink-faint lg:max-w-[220px] lg:truncate">
                                    {formatEmail(user.email)}
                                  </p>
                                </div>
                                <span className="shrink-0 lg:hidden">
                                  <StatusBadge status={user.status} />
                                </span>
                              </div>
                            </td>
                            <td className="hidden lg:table-cell lg:px-3 lg:py-3">
                              <StatusBadge status={user.status} />
                            </td>
                            <td className="block border-b border-line-soft py-3 lg:table-cell lg:border-b-0 lg:max-w-[240px] lg:px-3 lg:py-3">
                              <span className="mb-1 block text-xs font-semibold text-ink-faint lg:hidden">
                                <I18nText k="members.roleScope" fallback="역할/범위" />
                              </span>
                              <RoleBadgeList roles={user.roles} />
                              <p className="mt-2 break-words text-xs leading-5 text-ink-faint">
                                {formatScopeSummary(user.roles)}
                              </p>
                            </td>
                            <td className="block border-b border-line-soft py-3 lg:table-cell lg:border-b-0 lg:max-w-[260px] lg:px-3 lg:py-3">
                              <span className="mb-1 block text-xs font-semibold text-ink-faint lg:hidden">
                                <I18nText k="members.organization" fallback="소속 정보" />
                              </span>
                              <ProfileAffiliationBadges user={user} />
                            </td>
                            <td className="block border-b border-line-soft py-3 lg:table-cell lg:border-b-0 lg:px-3 lg:py-3">
                              <span className="mb-1 block text-xs font-semibold text-ink-faint lg:hidden">
                                <I18nText k="members.recordInfo" fallback="기록 정보" />
                              </span>
                              <div className="grid grid-cols-2 gap-3 text-xs text-ink-faint lg:block lg:space-y-1">
                                <p>
                                  <span className="font-medium text-ink-muted">
                                    <I18nText k="members.createdShort" fallback="생성" />
                                  </span>{" "}
                                  <span className="whitespace-nowrap">
                                    {formatDate(user.created_at)}
                                  </span>
                                </p>
                                <p>
                                  <span className="font-medium text-ink-muted">
                                    <I18nText k="members.updatedShort" fallback="수정" />
                                  </span>{" "}
                                  <span className="whitespace-nowrap">
                                    {formatDate(user.updated_at)}
                                  </span>
                                </p>
                              </div>
                            </td>
                            <td className="block border-b border-line-soft py-3 lg:table-cell lg:border-b-0 lg:px-3 lg:py-3">
                              <span className="mb-1 block text-xs font-semibold text-ink-faint lg:hidden">
                                <I18nText k="members.loginGuide" fallback="로그인 안내" />
                              </span>
                              <div className="flex flex-wrap gap-2 lg:block">
                                <LoginGuideCopyButton email={user.email} />
                              </div>
                            </td>
                            <td className="block pt-3 lg:table-cell lg:px-3 lg:py-3 lg:text-right">
                              <span className="mb-1 block text-xs font-semibold text-ink-faint lg:hidden">
                                <I18nText k="members.actions" fallback="관리" />
                              </span>
                              <div className="flex flex-wrap gap-2 lg:justify-end">
                                <StatusChangeForm
                                  representativeRole={representativeRole}
                                  user={user}
                                />
                                <AdminUserDetailDrawer user={user} />
                              </div>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </AdminUsersClientFilters>
        )}
      </section>
    </main>
  );
}
