import type {
  RelationshipType,
  ScopeType,
  UserRole,
} from "@/types/database";

export type SupportedLocale = "ko" | "en" | "th";

type LabelMap = Record<string, string>;

const roleLabels: Record<SupportedLocale, LabelMap> = {
  ko: {
    super_admin: "최고 관리자",
    country_admin: "국가 관리자",
    organization_admin: "기관 관리자",
    church_admin: "교회 관리자",
    group_leader: "그룹 리더",
    coach_maker: "코치메이커",
    coach: "코치",
    coachee: "코치이",
  },
  en: {
    super_admin: "Super Admin",
    country_admin: "Country Admin",
    organization_admin: "Organization Admin",
    church_admin: "Church Admin",
    group_leader: "Group Leader",
    coach_maker: "Coach Maker",
    coach: "Coach",
    coachee: "Coachee",
  },
  th: {
    coach: "โค้ช",
    coachee: "โค้ชชี่",
  },
};

const statusLabels: Record<SupportedLocale, LabelMap> = {
  ko: {
    active: "활성",
    inactive: "비활성",
    suspended: "중지됨",
    archived: "보관됨",
    anonymized: "익명화됨",
    pending: "대기 중",
    accepted: "수락됨",
    expired: "만료됨",
    revoked: "취소됨",
    paused: "일시 중지",
    ended: "종료됨",
    draft: "임시 저장",
    submitted: "제출됨",
  },
  en: {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    archived: "Archived",
    anonymized: "Anonymized",
    pending: "Pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
    paused: "Paused",
    ended: "Ended",
    draft: "Draft",
    submitted: "Submitted",
  },
  th: {
    active: "ใช้งาน",
    draft: "ฉบับร่าง",
    submitted: "ส่งแล้ว",
  },
};

const relationshipTypeLabels: Record<SupportedLocale, LabelMap> = {
  ko: {
    individual_coaching: "개인 코칭",
    group_coaching: "그룹 코칭",
    leadership_coaching: "리더십 코칭",
    pastoral_coaching: "목회 코칭",
    missionary_coaching: "선교 코칭",
  },
  en: {
    individual_coaching: "Individual Coaching",
    group_coaching: "Group Coaching",
    leadership_coaching: "Leadership Coaching",
    pastoral_coaching: "Pastoral Coaching",
    missionary_coaching: "Missionary Coaching",
  },
  th: {
    individual_coaching: "การโค้ชรายบุคคล",
  },
};

const scopeTypeLabels: Record<SupportedLocale, LabelMap> = {
  ko: {
    global: "전체",
    country: "국가",
    region: "지역",
    organization: "기관",
    church: "교회",
    group: "그룹",
    cohort: "코호트",
    coach: "코치",
  },
  en: {
    global: "Global",
    country: "Country",
    region: "Region",
    organization: "Organization",
    church: "Church",
    group: "Group",
    cohort: "Cohort",
    coach: "Coach",
  },
  th: {
    global: "ทั้งหมด",
  },
};

function getLabel(
  map: Record<SupportedLocale, LabelMap>,
  value: string,
  locale: SupportedLocale,
) {
  return map[locale][value] ?? map.en[value] ?? value;
}

export function getRoleLabel(role: UserRole, locale: SupportedLocale = "ko") {
  return getLabel(roleLabels, role, locale);
}

export function getStatusLabel(
  status: string,
  locale: SupportedLocale = "ko",
) {
  return getLabel(statusLabels, status, locale);
}

export function getRelationshipTypeLabel(
  type: RelationshipType,
  locale: SupportedLocale = "ko",
) {
  return getLabel(relationshipTypeLabels, type, locale);
}

export function getScopeTypeLabel(
  scopeType: ScopeType,
  locale: SupportedLocale = "ko",
) {
  return getLabel(scopeTypeLabels, scopeType, locale);
}

function shortenScopeId(scopeId: string) {
  if (scopeId.length <= 12) {
    return scopeId;
  }

  return `${scopeId.slice(0, 8)}...${scopeId.slice(-4)}`;
}

export function formatScope(
  scopeType: ScopeType,
  scopeId: string | null | undefined,
  locale: SupportedLocale = "ko",
) {
  const scopeLabel = getScopeTypeLabel(scopeType, locale);

  if (scopeType === "global") {
    return locale === "ko" ? "전체" : scopeLabel;
  }

  if (!scopeId) {
    return scopeLabel;
  }

  return `${scopeLabel}: ${shortenScopeId(scopeId)}`;
}
