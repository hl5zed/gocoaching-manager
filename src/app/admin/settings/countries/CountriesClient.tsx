"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { AdminCountrySummary } from "@/lib/api/admin/countries";

type CountriesClientProps = {
  initialCountries: AdminCountrySummary[];
  loadError: string | null;
};

type CountryApiResponse =
  | {
      ok: true;
      data: {
        country?: AdminCountrySummary;
        countries?: AdminCountrySummary[];
        message?: string;
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
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
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

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function validateCountryInput(name: string, code: string) {
  const normalizedName = name.trim();
  const normalizedCode = normalizeCode(code);

  if (!normalizedName) {
    return {
      ok: false as const,
      message: "국가명을 입력해 주세요.",
    };
  }

  if (!/^[A-Z]{2,3}$/.test(normalizedCode)) {
    return {
      ok: false as const,
      message: "국가 코드는 영문 대문자 2~3자리로 입력해 주세요.",
    };
  }

  return {
    ok: true as const,
    name: normalizedName,
    code: normalizedCode,
  };
}

function statusLabel(isActive: boolean) {
  return isActive ? "사용 중" : "비활성";
}

function sortCountries(countries: AdminCountrySummary[]) {
  return [...countries].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function CountriesClient({
  initialCountries,
  loadError,
}: CountriesClientProps) {
  const router = useRouter();
  const [countries, setCountries] = useState(initialCountries);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(loadError);

  useEffect(() => {
    setCountries(initialCountries);
  }, [initialCountries]);

  useEffect(() => {
    setErrorMessage(loadError);
  }, [loadError]);

  const activeCount = countries.filter((country) => country.is_active).length;

  async function readResponse(response: Response) {
    const result = (await response.json()) as CountryApiResponse;

    if (!response.ok || !result.ok) {
      throw new Error(
        result.ok === false
          ? result.error.message
          : "국가 정보를 처리하지 못했습니다.",
      );
    }

    return result.data;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const validation = validateCountryInput(name, code);

    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setPendingAction("create");

    try {
      const response = await fetch("/api/admin/countries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: validation.name,
          code: validation.code,
        }),
      });
      const data = await readResponse(response);

      if (data.country) {
        setCountries((current) => sortCountries([...current, data.country!]));
      }

      setName("");
      setCode("");
      setMessage(data.message ?? "국가가 추가되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "국가 추가에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEdit(country: AdminCountrySummary) {
    setEditingId(country.id);
    setEditName(country.name);
    setEditCode(country.code);
    setMessage(null);
    setErrorMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCode("");
  }

  async function handleUpdate(countryId: string) {
    setMessage(null);
    setErrorMessage(null);

    const validation = validateCountryInput(editName, editCode);

    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setPendingAction(`update:${countryId}`);

    try {
      const response = await fetch("/api/admin/countries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: countryId,
          name: validation.name,
          code: validation.code,
        }),
      });
      const data = await readResponse(response);

      if (data.country) {
        setCountries((current) =>
          sortCountries(
            current.map((country) =>
              country.id === data.country?.id ? data.country : country,
            ),
          ),
        );
      }

      cancelEdit();
      setMessage(data.message ?? "국가 정보가 수정되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "국가 수정에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleToggleActive(country: AdminCountrySummary) {
    setMessage(null);
    setErrorMessage(null);

    const nextActive = !country.is_active;
    setPendingAction(`active:${country.id}`);

    try {
      const response = await fetch("/api/admin/countries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: country.id,
          is_active: nextActive,
        }),
      });
      const data = await readResponse(response);

      if (data.country) {
        setCountries((current) =>
          sortCountries(
            current.map((item) =>
              item.id === data.country?.id ? data.country : item,
            ),
          ),
        );
      }

      setMessage(
        nextActive
          ? "국가가 다시 활성화되었습니다."
          : "국가가 비활성화되었습니다. 새 회원가입/초대 수락 국가 선택 목록에서 숨겨집니다.",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "국가 사용 여부 변경에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="mt-8 rounded-control border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        국가는 회원의 소속 국가 선택에 사용됩니다. 이미 회원에게 연결된
        국가는 삭제하지 않고 비활성화만 할 수 있습니다.
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-card border border-line-base bg-surface-card p-5">
          <p className="text-sm font-medium text-ink-faint">전체 국가 수</p>
          <p className="mt-3 text-3xl font-semibold">{countries.length}</p>
        </div>
        <div className="rounded-card border border-line-base bg-surface-card p-5">
          <p className="text-sm font-medium text-ink-faint">사용 중</p>
          <p className="mt-3 text-3xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-card border border-line-base bg-surface-card p-5">
          <p className="text-sm font-medium text-ink-faint">비활성</p>
          <p className="mt-3 text-3xl font-semibold">
            {countries.length - activeCount}
          </p>
        </div>
      </section>

      <form
        className="mt-8 rounded-card border border-line-base bg-surface-card p-5"
        onSubmit={handleCreate}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">국가 추가</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              국가 코드는 ISO 2~3자리 대문자 코드를 사용합니다.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">국가명</span>
            <input
              className="rounded-control border border-line-base px-3 py-2"
              onChange={(event) => setName(event.target.value)}
              placeholder="Thailand"
              value={name}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-base">
              국가 코드
            </span>
            <input
              className="rounded-control border border-line-base px-3 py-2 uppercase"
              maxLength={3}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
              placeholder="TH"
              value={code}
            />
          </label>
          <button
            className="rounded-control bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pendingAction !== null}
            type="submit"
          >
            {pendingAction === "create" ? "추가 중..." : "국가 추가"}
          </button>
        </div>
      </form>

      {message ? (
        <div className="mt-5 rounded-control border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {countries.length === 0 ? (
        <div className="mt-8 rounded-card border border-line-base bg-surface-card p-6 text-ink-muted">
          등록된 국가가 없습니다. 국가를 추가해 주세요.
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-md border border-line-base bg-surface-card">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-surface-sunken text-ink-faint">
                <th className="px-4 py-3 font-medium">국가명</th>
                <th className="px-4 py-3 font-medium">국가 코드</th>
                <th className="px-4 py-3 font-medium">사용 여부</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                <th className="px-4 py-3 font-medium">수정일</th>
                <th className="px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((country) => {
                const isEditing = editingId === country.id;

                return (
                  <tr
                    className="border-b border-line-soft last:border-b-0"
                    key={country.id}
                  >
                    <td className="px-4 py-3 font-medium text-ink-strong">
                      {isEditing ? (
                        <input
                          className="w-full rounded-control border border-line-base px-3 py-2"
                          onChange={(event) => setEditName(event.target.value)}
                          value={editName}
                        />
                      ) : (
                        country.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-base">
                      {isEditing ? (
                        <input
                          className="w-full rounded-control border border-line-base px-3 py-2 uppercase"
                          maxLength={3}
                          onChange={(event) =>
                            setEditCode(normalizeCode(event.target.value))
                          }
                          value={editCode}
                        />
                      ) : (
                        country.code || "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          country.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-surface-sunken text-ink-muted"
                        }`}
                      >
                        {statusLabel(country.is_active)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTime(country.created_at)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTime(country.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-control bg-navy-900 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={pendingAction !== null}
                            onClick={() => handleUpdate(country.id)}
                            type="button"
                          >
                            {pendingAction === `update:${country.id}`
                              ? "저장 중..."
                              : "저장"}
                          </button>
                          <button
                            className="rounded-control border border-line-base px-3 py-1.5 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
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
                            className="rounded-control border border-line-base px-3 py-1.5 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
                            disabled={pendingAction !== null}
                            onClick={() => startEdit(country)}
                            type="button"
                          >
                            수정
                          </button>
                          <button
                            className={`rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:border-line-base disabled:text-ink-faint ${
                              country.is_active
                                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            disabled={pendingAction !== null}
                            onClick={() => handleToggleActive(country)}
                            type="button"
                          >
                            {pendingAction === `active:${country.id}`
                              ? "처리 중..."
                              : country.is_active
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
