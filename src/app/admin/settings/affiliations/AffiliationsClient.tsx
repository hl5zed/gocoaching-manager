"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminAffiliationCountryOption,
  AdminAffiliationOrganizationOption,
  AdminChurchSummary,
  AdminGroupSummary,
  AdminRegionSummary,
} from "@/lib/api/admin/affiliations";

type AffiliationKind = "region" | "church" | "group";
type AffiliationIntent =
  | "create_region"
  | "create_church"
  | "create_group"
  | "update_region"
  | "update_church"
  | "update_group";

const GROUP_TYPE_OPTIONS = [
  { label: "사역팀", value: "ministry_team" },
  { label: "소그룹/목장", value: "small_group" },
  { label: "코호트 그룹", value: "cohort_group" },
  { label: "훈련반", value: "training_group" },
  { label: "지역 그룹", value: "regional_group" },
  { label: "기타", value: "other" },
];
const DEFAULT_GROUP_TYPE = "small_group";

type AffiliationsClientProps = {
  churches: AdminChurchSummary[];
  countries: AdminAffiliationCountryOption[];
  groups: AdminGroupSummary[];
  initialError: string | null;
  organizations: AdminAffiliationOrganizationOption[];
  regions: AdminRegionSummary[];
};

type AffiliationApiResponse =
  | {
      ok: true;
      data: {
        church?: AdminChurchSummary;
        group?: AdminGroupSummary;
        message?: string;
        region?: AdminRegionSummary;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(date);
}

function formatCountry(country: AdminAffiliationCountryOption | undefined) {
  if (!country) {
    return "미지정";
  }

  return country.code ? `${country.name} (${country.code})` : country.name;
}

function findName<T extends { id: string; name: string }>(
  items: T[],
  id: string | null,
) {
  if (!id) {
    return "미지정";
  }

  return items.find((item) => item.id === id)?.name ?? "미지정";
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function updateById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function createIntent(kind: AffiliationKind): AffiliationIntent {
  return kind === "region"
    ? "create_region"
    : kind === "church"
      ? "create_church"
      : "create_group";
}

function updateIntent(kind: AffiliationKind): AffiliationIntent {
  return kind === "region"
    ? "update_region"
    : kind === "church"
      ? "update_church"
      : "update_group";
}

export function AffiliationsClient({
  churches: initialChurches,
  countries,
  groups: initialGroups,
  initialError,
  organizations,
  regions: initialRegions,
}: AffiliationsClientProps) {
  const router = useRouter();
  const [regions, setRegions] = useState(initialRegions);
  const [churches, setChurches] = useState(initialChurches);
  const [groups, setGroups] = useState(initialGroups);
  const [regionName, setRegionName] = useState("");
  const [regionCountryId, setRegionCountryId] = useState("");
  const [churchName, setChurchName] = useState("");
  const [churchOrganizationId, setChurchOrganizationId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupChurchId, setGroupChurchId] = useState("");
  const [groupType, setGroupType] = useState(DEFAULT_GROUP_TYPE);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  const countryMap = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  );
  const activeCountries = countries.filter((country) => country.is_active);
  const activeOrganizations = organizations.filter(
    (organization) => organization.is_active,
  );

  async function readResponse(response: Response) {
    const result = (await response.json()) as AffiliationApiResponse;

    if (!response.ok || !result.ok) {
      throw new Error(
        result.ok === false
          ? result.error.message
          : "소속 선택값을 처리하지 못했습니다.",
      );
    }

    return result.data;
  }

  function validateName(name: string) {
    const normalized = name.trim();

    if (!normalized) {
      setErrorMessage("이름을 입력해 주세요.");
      return null;
    }

    return normalized;
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
    kind: AffiliationKind,
  ) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const name =
      kind === "region"
        ? validateName(regionName)
        : kind === "church"
          ? validateName(churchName)
          : validateName(groupName);

    if (!name) {
      return;
    }

    setPendingAction(`create:${kind}`);

    try {
      const response = await fetch("/api/admin/affiliations", {
        body: JSON.stringify({
          church_id: kind === "group" ? groupChurchId || null : undefined,
          country_id: kind === "region" ? regionCountryId || null : undefined,
          group_type: kind === "group" ? groupType : undefined,
          intent: createIntent(kind),
          name,
          organization_id:
            kind === "church" ? churchOrganizationId || null : undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await readResponse(response);

      if (kind === "region" && data.region) {
        setRegions((current) => sortByName([...current, data.region!]));
        setRegionName("");
        setRegionCountryId("");
      }

      if (kind === "church" && data.church) {
        setChurches((current) => sortByName([...current, data.church!]));
        setChurchName("");
        setChurchOrganizationId("");
      }

      if (kind === "group" && data.group) {
        setGroups((current) => sortByName([...current, data.group!]));
        setGroupName("");
        setGroupChurchId("");
        setGroupType(DEFAULT_GROUP_TYPE);
      }

      setMessage(data.message ?? "소속 선택값이 추가되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "소속 선택값 추가에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEdit(
    kind: AffiliationKind,
    item: AdminRegionSummary | AdminChurchSummary | AdminGroupSummary,
    parentId: string | null,
  ) {
    setEditingKey(`${kind}:${item.id}`);
    setEditName(item.name);
    setEditParentId(parentId ?? "");
    setMessage(null);
    setErrorMessage(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditName("");
    setEditParentId("");
  }

  async function handleUpdate(kind: AffiliationKind, id: string) {
    setMessage(null);
    setErrorMessage(null);

    const name = validateName(editName);

    if (!name) {
      return;
    }

    setPendingAction(`update:${kind}:${id}`);

    try {
      const response = await fetch("/api/admin/affiliations", {
        body: JSON.stringify({
          church_id: kind === "group" ? editParentId || null : undefined,
          country_id: kind === "region" ? editParentId || null : undefined,
          id,
          intent: updateIntent(kind),
          name,
          organization_id: kind === "church" ? editParentId || null : undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = await readResponse(response);

      if (kind === "region" && data.region) {
        setRegions((current) => sortByName(updateById(current, data.region!)));
      }

      if (kind === "church" && data.church) {
        setChurches((current) => sortByName(updateById(current, data.church!)));
      }

      if (kind === "group" && data.group) {
        setGroups((current) => sortByName(updateById(current, data.group!)));
      }

      cancelEdit();
      setMessage(data.message ?? "소속 선택값이 수정되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "소속 선택값 수정에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="rounded-control border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        이 화면은 회원정보수정 드롭다운의 선택값을 관리합니다. 기존 DB
        구조를 사용하며 삭제 기능은 제공하지 않습니다.
      </div>

      {message ? (
        <div className="rounded-control border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="지역/도시" value={regions.length} />
        <SummaryCard label="세부 교회" value={churches.length} />
        <SummaryCard label="그룹/팀/목장" value={groups.length} />
      </section>

      <ManagementSection
        createForm={
          <form
            action="/api/admin/affiliations"
            className="grid gap-3 lg:grid-cols-[1fr_240px_auto] lg:items-end"
            method="post"
            onSubmit={(event) => handleCreate(event, "region")}
          >
            <input name="intent" type="hidden" value="create_region" />
            <TextInput
              label="지역/도시명"
              name="name"
              onChange={setRegionName}
              placeholder="Chiang Rai"
              value={regionName}
            />
            <SelectInput
              label="소속 국가"
              name="country_id"
              onChange={setRegionCountryId}
              value={regionCountryId}
            >
              <option value="">미지정</option>
              {activeCountries.map((country) => (
                <option key={country.id} value={country.id}>
                  {formatCountry(country)}
                </option>
              ))}
            </SelectInput>
            <SubmitButton
              isPending={pendingAction === "create:region"}
              pendingLabel="추가 중..."
            >
              지역/도시 추가
            </SubmitButton>
          </form>
        }
        description="국가 하위의 지역 또는 도시 선택값입니다."
        emptyText="등록된 지역/도시가 없습니다."
        title="지역/도시 관리"
      >
        {regions.map((region) => {
          const isEditing = editingKey === `region:${region.id}`;

          return (
            <TableRow key={region.id}>
              <td className="px-4 py-3">
                {isEditing ? (
                  <InlineTextInput onChange={setEditName} value={editName} />
                ) : (
                  <span className="font-medium">{region.name}</span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {isEditing ? (
                  <InlineSelectInput
                    onChange={setEditParentId}
                    value={editParentId}
                  >
                    <option value="">미지정</option>
                    {activeCountries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {formatCountry(country)}
                      </option>
                    ))}
                  </InlineSelectInput>
                ) : (
                  formatCountry(countryMap.get(region.country_id ?? ""))
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {formatDateTime(region.updated_at)}
              </td>
              <ActionCell
                isEditing={isEditing}
                isPending={pendingAction !== null}
                onCancel={cancelEdit}
                onEdit={() => startEdit("region", region, region.country_id)}
                onSave={() => handleUpdate("region", region.id)}
                pending={pendingAction === `update:region:${region.id}`}
              />
            </TableRow>
          );
        })}
      </ManagementSection>

      <ManagementSection
        createForm={
          <form
            action="/api/admin/affiliations"
            className="grid gap-3 lg:grid-cols-[1fr_260px_auto] lg:items-end"
            method="post"
            onSubmit={(event) => handleCreate(event, "church")}
          >
            <input name="intent" type="hidden" value="create_church" />
            <TextInput
              label="세부 교회명"
              name="name"
              onChange={setChurchName}
              placeholder="Grace Church"
              value={churchName}
            />
            <SelectInput
              label="소속 기관/교회"
              name="organization_id"
              onChange={setChurchOrganizationId}
              value={churchOrganizationId}
            >
              <option value="">미지정</option>
              {activeOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </SelectInput>
            <SubmitButton
              isPending={pendingAction === "create:church"}
              pendingLabel="추가 중..."
            >
              세부 교회 추가
            </SubmitButton>
          </form>
        }
        description="기관 또는 교회 네트워크 아래의 세부 교회 선택값입니다."
        emptyText="등록된 세부 교회가 없습니다."
        title="세부 교회 관리"
      >
        {churches.map((church) => {
          const isEditing = editingKey === `church:${church.id}`;

          return (
            <TableRow key={church.id}>
              <td className="px-4 py-3">
                {isEditing ? (
                  <InlineTextInput onChange={setEditName} value={editName} />
                ) : (
                  <span className="font-medium">{church.name}</span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {isEditing ? (
                  <InlineSelectInput
                    onChange={setEditParentId}
                    value={editParentId}
                  >
                    <option value="">미지정</option>
                    {activeOrganizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </InlineSelectInput>
                ) : (
                  findName(organizations, church.organization_id)
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {formatDateTime(church.updated_at)}
              </td>
              <ActionCell
                isEditing={isEditing}
                isPending={pendingAction !== null}
                onCancel={cancelEdit}
                onEdit={() =>
                  startEdit("church", church, church.organization_id)
                }
                onSave={() => handleUpdate("church", church.id)}
                pending={pendingAction === `update:church:${church.id}`}
              />
            </TableRow>
          );
        })}
      </ManagementSection>

      <ManagementSection
        createForm={
          <form
            action="/api/admin/affiliations"
            className="grid gap-3 lg:grid-cols-[1fr_260px_auto] lg:items-end"
            method="post"
            onSubmit={(event) => handleCreate(event, "group")}
          >
            <input name="intent" type="hidden" value="create_group" />
            <TextInput
              label="그룹/팀/목장명"
              name="name"
              onChange={setGroupName}
              placeholder="청년팀"
              value={groupName}
            />
            <SelectInput
              label="세부 교회"
              name="church_id"
              onChange={setGroupChurchId}
              value={groupChurchId}
            >
              <option value="">미지정</option>
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              label="유형"
              name="group_type"
              onChange={setGroupType}
              value={groupType}
            >
              {GROUP_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
            <SubmitButton
              isPending={pendingAction === "create:group"}
              pendingLabel="추가 중..."
            >
              그룹/팀/목장 추가
            </SubmitButton>
          </form>
        }
        description="세부 교회 하위의 그룹, 팀, 목장 선택값입니다."
        emptyText="등록된 그룹/팀/목장이 없습니다."
        title="그룹/팀/목장 관리"
      >
        {groups.map((group) => {
          const isEditing = editingKey === `group:${group.id}`;

          return (
            <TableRow key={group.id}>
              <td className="px-4 py-3">
                {isEditing ? (
                  <InlineTextInput onChange={setEditName} value={editName} />
                ) : (
                  <span className="font-medium">{group.name}</span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {isEditing ? (
                  <InlineSelectInput
                    onChange={setEditParentId}
                    value={editParentId}
                  >
                    <option value="">미지정</option>
                    {churches.map((church) => (
                      <option key={church.id} value={church.id}>
                        {church.name}
                      </option>
                    ))}
                  </InlineSelectInput>
                ) : (
                  findName(churches, group.church_id)
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {formatDateTime(group.updated_at)}
              </td>
              <ActionCell
                isEditing={isEditing}
                isPending={pendingAction !== null}
                onCancel={cancelEdit}
                onEdit={() => startEdit("group", group, group.church_id)}
                onSave={() => handleUpdate("group", group.id)}
                pending={pendingAction === `update:group:${group.id}`}
              />
            </TableRow>
          );
        })}
      </ManagementSection>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line-base bg-surface-card p-5">
      <p className="text-sm font-medium text-ink-faint">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function ManagementSection({
  children,
  createForm,
  description,
  emptyText,
  title,
}: {
  children: React.ReactNode;
  createForm: React.ReactNode;
  description: string;
  emptyText: string;
  title: string;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="rounded-card border border-line-base bg-surface-card p-5">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
      </div>

      <div className="mt-5">{createForm}</div>

      <div className="mt-6 overflow-x-auto rounded-md border border-line-base">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line-soft bg-surface-sunken text-ink-faint">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">상위 소속</th>
              <th className="px-4 py-3 font-medium">최근 수정일</th>
              <th className="px-4 py-3 font-medium">작업</th>
            </tr>
          </thead>
          <tbody>
            {hasRows ? (
              children
            ) : (
              <tr>
                <td className="px-4 py-6 text-ink-faint" colSpan={4}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-line-soft last:border-b-0">{children}</tr>;
}

function TextInput({
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-ink-base">{label}</span>
      <input
        className="rounded-control border border-line-base px-3 py-2"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function SelectInput({
  children,
  label,
  name,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-ink-base">{label}</span>
      <select
        className="rounded-control border border-line-base px-3 py-2"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function InlineTextInput({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <input
      className="w-full rounded-control border border-line-base px-3 py-2"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  );
}

function InlineSelectInput({
  children,
  onChange,
  value,
}: {
  children: React.ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      className="w-full rounded-control border border-line-base px-3 py-2"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function SubmitButton({
  children,
  isPending,
  pendingLabel,
}: {
  children: React.ReactNode;
  isPending: boolean;
  pendingLabel: string;
}) {
  return (
    <button
      className="rounded-control bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isPending}
      type="submit"
    >
      {isPending ? pendingLabel : children}
    </button>
  );
}

function ActionCell({
  isEditing,
  isPending,
  onCancel,
  onEdit,
  onSave,
  pending,
}: {
  isEditing: boolean;
  isPending: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <td className="px-4 py-3">
      {isEditing ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-control bg-navy-900 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending}
            onClick={onSave}
            type="button"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
          <button
            className="rounded-control border border-line-base px-3 py-1.5 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          className="rounded-control border border-line-base px-3 py-1.5 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
          disabled={isPending}
          onClick={onEdit}
          type="button"
        >
          수정
        </button>
      )}
    </td>
  );
}
