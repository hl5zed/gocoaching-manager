"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AdminOrganizationCountryOption,
  AdminOrganizationSummary,
} from "@/lib/api/admin/organizations";
import { ORGANIZATION_TYPES, type OrganizationType } from "@/types/database";

const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  denomination: "교단/교파",
  mission_body: "선교단체",
  church_network: "교회 네트워크/노회",
  local_ministry: "지역 사역",
  nonprofit: "비영리단체",
  other: "기타",
};

type OrganizationsClientProps = {
  countries: AdminOrganizationCountryOption[];
  initialOrganizations: AdminOrganizationSummary[];
  loadError: string | null;
};

type OrganizationApiResponse =
  | {
      ok: true;
      data: {
        message?: string;
        organization?: AdminOrganizationSummary;
        organizations?: AdminOrganizationSummary[];
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

function formatDateTime(value: string | null) {
  if (!value) {
    return "미지정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미지정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function statusLabel(isActive: boolean) {
  return isActive ? "사용 중" : "비활성";
}

function formatCountry(country: AdminOrganizationCountryOption | undefined) {
  if (!country) {
    return "미지정";
  }

  return country.code ? `${country.name} (${country.code})` : country.name;
}

function sortOrganizations(organizations: AdminOrganizationSummary[]) {
  return [...organizations].sort((left, right) => {
    const countryCompare = left.country_name.localeCompare(right.country_name);

    if (countryCompare !== 0) {
      return countryCompare;
    }

    const typeCompare = left.organization_type_label.localeCompare(
      right.organization_type_label,
    );

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

function isOrganizationType(value: string): value is OrganizationType {
  return ORGANIZATION_TYPES.includes(value as OrganizationType);
}

function validateOrganizationInput(
  name: string,
  countryId: string,
  organizationType: string,
) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    return {
      ok: false as const,
      message: "기관 및 단체명을 입력해 주세요.",
    };
  }

  if (!countryId) {
    return {
      ok: false as const,
      message: "소속 국가를 선택해 주세요.",
    };
  }

  if (!isOrganizationType(organizationType)) {
    return {
      ok: false as const,
      message: "기관 유형을 선택해 주세요.",
    };
  }

  return {
    ok: true as const,
    countryId,
    name: normalizedName,
    organizationType,
  };
}

export function OrganizationsClient({
  countries,
  initialOrganizations,
  loadError,
}: OrganizationsClientProps) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [organizationType, setOrganizationType] =
    useState<OrganizationType>("mission_body");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCountryId, setEditCountryId] = useState("");
  const [editOrganizationType, setEditOrganizationType] =
    useState<OrganizationType>("mission_body");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(loadError);

  useEffect(() => {
    setOrganizations(initialOrganizations);
  }, [initialOrganizations]);

  useEffect(() => {
    setErrorMessage(loadError);
  }, [loadError]);

  const countryMap = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  );
  const activeCountries = countries.filter((country) => country.is_active);
  const activeCount = organizations.filter(
    (organization) => organization.is_active,
  ).length;

  async function readResponse(response: Response) {
    const result = (await response.json()) as OrganizationApiResponse;

    if (!response.ok || !result.ok) {
      throw new Error(
        result.ok === false
          ? result.error.message
          : "기관 및 단체 정보를 처리하지 못했습니다.",
      );
    }

    return result.data;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const validation = validateOrganizationInput(
      name,
      countryId,
      organizationType,
    );

    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setPendingAction("create");

    try {
      const response = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country_id: validation.countryId,
          name: validation.name,
          organization_type: validation.organizationType,
        }),
      });
      const data = await readResponse(response);

      if (data.organization) {
        setOrganizations((current) =>
          sortOrganizations([...current, data.organization!]),
        );
      }

      setName("");
      setCountryId("");
      setOrganizationType("mission_body");
      setMessage(data.message ?? "기관 및 단체가 추가되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "기관 및 단체 추가에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEdit(organization: AdminOrganizationSummary) {
    setEditingId(organization.id);
    setEditName(organization.name);
    setEditCountryId(organization.country_id);
    setEditOrganizationType(organization.organization_type);
    setMessage(null);
    setErrorMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCountryId("");
    setEditOrganizationType("mission_body");
  }

  async function handleUpdate(organizationId: string) {
    setMessage(null);
    setErrorMessage(null);

    const validation = validateOrganizationInput(
      editName,
      editCountryId,
      editOrganizationType,
    );

    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setPendingAction(`update:${organizationId}`);

    try {
      const response = await fetch("/api/admin/organizations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country_id: validation.countryId,
          id: organizationId,
          name: validation.name,
          organization_type: validation.organizationType,
        }),
      });
      const data = await readResponse(response);

      if (data.organization) {
        setOrganizations((current) =>
          sortOrganizations(
            current.map((organization) =>
              organization.id === data.organization?.id
                ? data.organization
                : organization,
            ),
          ),
        );
      }

      cancelEdit();
      setMessage(data.message ?? "기관 및 단체 정보가 수정되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "기관 및 단체 수정에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleToggleActive(organization: AdminOrganizationSummary) {
    setMessage(null);
    setErrorMessage(null);

    const nextActive = !organization.is_active;
    setPendingAction(`active:${organization.id}`);

    try {
      const response = await fetch("/api/admin/organizations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: organization.id,
          is_active: nextActive,
        }),
      });
      const data = await readResponse(response);

      if (data.organization) {
        setOrganizations((current) =>
          sortOrganizations(
            current.map((item) =>
              item.id === data.organization?.id ? data.organization : item,
            ),
          ),
        );
      }

      setMessage(
        nextActive
          ? "기관 및 단체가 다시 활성화되었습니다."
          : "기관 및 단체가 비활성화되었습니다. 기존 회원의 소속 정보는 유지됩니다.",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "기관 및 단체 사용 여부 변경에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        기관 및 단체는 회원의 소속 기관 선택에 사용됩니다. 이미 회원에게
        연결된 기관은 삭제하지 않고 비활성화만 할 수 있습니다.
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">
            전체 기관 및 단체 수
          </p>
          <p className="mt-3 text-3xl font-semibold">{organizations.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">사용 중</p>
          <p className="mt-3 text-3xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">비활성</p>
          <p className="mt-3 text-3xl font-semibold">
            {organizations.length - activeCount}
          </p>
        </div>
      </section>

      <form
        className="mt-8 rounded-md border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">기관 및 단체 추가</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              기관명, 기관 유형, 소속 국가를 선택해 등록합니다.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_240px_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              기관 및 단체명
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) => setName(event.target.value)}
              placeholder="GO Coaching Thailand"
              value={name}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              기관 유형
            </span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) =>
                setOrganizationType(event.target.value as OrganizationType)
              }
              value={organizationType}
            >
              {ORGANIZATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ORGANIZATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              소속 국가
            </span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) => setCountryId(event.target.value)}
              value={countryId}
            >
              <option value="">국가 선택</option>
              {activeCountries.map((country) => (
                <option key={country.id} value={country.id}>
                  {formatCountry(country)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={pendingAction !== null}
            type="submit"
          >
            {pendingAction === "create" ? "추가 중..." : "기관 및 단체 추가"}
          </button>
        </div>
      </form>

      {message ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {organizations.length === 0 ? (
        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6 text-slate-600">
          등록된 기관 및 단체가 없습니다.
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-4 py-3 font-medium">기관명</th>
                <th className="px-4 py-3 font-medium">기관 유형</th>
                <th className="px-4 py-3 font-medium">소속 국가</th>
                <th className="px-4 py-3 font-medium">사용 여부</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                <th className="px-4 py-3 font-medium">최근 수정일</th>
                <th className="px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => {
                const isEditing = editingId === organization.id;

                return (
                  <tr
                    className="border-b border-slate-100 last:border-b-0"
                    key={organization.id}
                  >
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {isEditing ? (
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                          onChange={(event) => setEditName(event.target.value)}
                          value={editName}
                        />
                      ) : (
                        organization.name || "미지정"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {isEditing ? (
                        <select
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                          onChange={(event) =>
                            setEditOrganizationType(
                              event.target.value as OrganizationType,
                            )
                          }
                          value={editOrganizationType}
                        >
                          {ORGANIZATION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {ORGANIZATION_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        organization.organization_type_label || "미지정"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {isEditing ? (
                        <select
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                          onChange={(event) =>
                            setEditCountryId(event.target.value)
                          }
                          value={editCountryId}
                        >
                          <option value="">국가 선택</option>
                          {activeCountries.map((country) => (
                            <option key={country.id} value={country.id}>
                              {formatCountry(country)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        formatCountry(countryMap.get(organization.country_id))
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          organization.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel(organization.is_active)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(organization.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(organization.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                            disabled={pendingAction !== null}
                            onClick={() => handleUpdate(organization.id)}
                            type="button"
                          >
                            {pendingAction === `update:${organization.id}`
                              ? "저장 중..."
                              : "저장"}
                          </button>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            disabled={pendingAction !== null}
                            onClick={cancelEdit}
                            type="button"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            disabled={pendingAction !== null}
                            onClick={() => startEdit(organization)}
                            type="button"
                          >
                            수정
                          </button>
                          <button
                            className={`rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 ${
                              organization.is_active
                                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            disabled={pendingAction !== null}
                            onClick={() => handleToggleActive(organization)}
                            type="button"
                          >
                            {pendingAction === `active:${organization.id}`
                              ? "처리 중..."
                              : organization.is_active
                                ? "비활성화"
                                : "다시 활성화"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
