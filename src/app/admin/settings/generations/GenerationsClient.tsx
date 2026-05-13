"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { AdminGenerationOption } from "@/lib/api/admin/generations";

type GenerationsClientProps = {
  initialGenerations: AdminGenerationOption[];
  loadError: string | null;
};

type GenerationApiResponse =
  | {
      ok: true;
      data: {
        generation?: AdminGenerationOption;
        generations?: AdminGenerationOption[];
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

function normalizeInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function validateGenerationInput(
  generationNumber: string,
  label: string,
  sortOrder: string,
) {
  const parsedGenerationNumber = normalizeInteger(generationNumber);
  const parsedSortOrder = sortOrder.trim()
    ? normalizeInteger(sortOrder)
    : parsedGenerationNumber;
  const normalizedLabel = label.trim();

  if (!parsedGenerationNumber || parsedGenerationNumber < 1) {
    return {
      ok: false as const,
      message: "세대 번호는 1 이상의 정수로 입력해 주세요.",
    };
  }

  if (!normalizedLabel) {
    return {
      ok: false as const,
      message: "표시 이름을 입력해 주세요.",
    };
  }

  if (parsedSortOrder === null) {
    return {
      ok: false as const,
      message: "정렬 순서를 확인해 주세요.",
    };
  }

  return {
    ok: true as const,
    generation_number: parsedGenerationNumber,
    label: normalizedLabel,
    sort_order: parsedSortOrder,
  };
}

function sortGenerations(generations: AdminGenerationOption[]) {
  return [...generations].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.generation_number - right.generation_number;
  });
}

function statusLabel(isActive: boolean) {
  return isActive ? "사용 중" : "비활성";
}

export function GenerationsClient({
  initialGenerations,
  loadError,
}: GenerationsClientProps) {
  const router = useRouter();
  const [generations, setGenerations] = useState(initialGenerations);
  const [generationNumber, setGenerationNumber] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGenerationNumber, setEditGenerationNumber] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(loadError);

  useEffect(() => {
    setGenerations(initialGenerations);
  }, [initialGenerations]);

  useEffect(() => {
    setErrorMessage(loadError);
  }, [loadError]);

  const activeCount = generations.filter((generation) => generation.is_active)
    .length;

  async function readResponse(response: Response) {
    const result = (await response.json()) as GenerationApiResponse;

    if (!response.ok || !result.ok) {
      throw new Error(
        result.ok === false
          ? result.error.message
          : "세대 옵션을 처리하지 못했습니다.",
      );
    }

    return result.data;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const validation = validateGenerationInput(
      generationNumber,
      label,
      sortOrder,
    );

    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setPendingAction("create");

    try {
      const response = await fetch("/api/admin/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation),
      });
      const data = await readResponse(response);

      if (data.generation) {
        setGenerations((current) =>
          sortGenerations([...current, data.generation!]),
        );
      }

      setGenerationNumber("");
      setLabel("");
      setSortOrder("");
      setMessage(data.message ?? "세대 옵션이 추가되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "세대 옵션 추가에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEdit(generation: AdminGenerationOption) {
    setEditingId(generation.id);
    setEditGenerationNumber(String(generation.generation_number));
    setEditLabel(generation.label);
    setEditSortOrder(String(generation.sort_order));
    setMessage(null);
    setErrorMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditGenerationNumber("");
    setEditLabel("");
    setEditSortOrder("");
  }

  async function handleUpdate(generationId: string) {
    setMessage(null);
    setErrorMessage(null);

    const validation = validateGenerationInput(
      editGenerationNumber,
      editLabel,
      editSortOrder,
    );

    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setPendingAction(`update:${generationId}`);

    try {
      const response = await fetch("/api/admin/generations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: generationId,
          ...validation,
        }),
      });
      const data = await readResponse(response);

      if (data.generation) {
        setGenerations((current) =>
          sortGenerations(
            current.map((generation) =>
              generation.id === data.generation?.id
                ? data.generation
                : generation,
            ),
          ),
        );
      }

      cancelEdit();
      setMessage(data.message ?? "세대 옵션이 수정되었습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "세대 옵션 수정에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleToggleActive(generation: AdminGenerationOption) {
    setMessage(null);
    setErrorMessage(null);

    const nextActive = !generation.is_active;
    setPendingAction(`active:${generation.id}`);

    try {
      const response = await fetch("/api/admin/generations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: generation.id,
          is_active: nextActive,
        }),
      });
      const data = await readResponse(response);

      if (data.generation) {
        setGenerations((current) =>
          sortGenerations(
            current.map((item) =>
              item.id === data.generation?.id ? data.generation : item,
            ),
          ),
        );
      }

      setMessage(
        nextActive
          ? "세대 옵션이 다시 활성화되었습니다."
          : "세대 옵션이 비활성화되었습니다. 새 회원가입/초대 수락 세대 선택 목록에서 숨겨집니다.",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "세대 옵션 사용 여부 변경에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        세대 옵션은 회원가입/초대 수락 시 표시되는 선택 항목입니다.
        회원에게 저장되는 실제 값은 profiles.generation_number입니다.
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">전체 옵션 수</p>
          <p className="mt-3 text-3xl font-semibold">{generations.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">사용 중</p>
          <p className="mt-3 text-3xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">비활성</p>
          <p className="mt-3 text-3xl font-semibold">
            {generations.length - activeCount}
          </p>
        </div>
      </section>

      <form
        className="mt-8 rounded-md border border-slate-200 bg-white p-5"
        onSubmit={handleCreate}
      >
        <h2 className="text-lg font-semibold">세대 추가</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          세대 번호는 1 이상의 정수로 입력합니다. 정렬 순서를 비우면 세대 번호를 사용합니다.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_160px_auto] md:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              세대 번호
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              min="1"
              onChange={(event) => setGenerationNumber(event.target.value)}
              type="number"
              value={generationNumber}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              표시 이름
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) => setLabel(event.target.value)}
              placeholder="6세대"
              value={label}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              정렬 순서
            </span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) => setSortOrder(event.target.value)}
              type="number"
              value={sortOrder}
            />
          </label>
          <button
            className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={pendingAction !== null}
            type="submit"
          >
            {pendingAction === "create" ? "추가 중..." : "세대 추가"}
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

      {generations.length === 0 ? (
        <div className="mt-8 rounded-md border border-slate-200 bg-white p-6 text-slate-600">
          등록된 세대 옵션이 없습니다. 세대 옵션을 추가해 주세요.
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-4 py-3 font-medium">세대 번호</th>
                <th className="px-4 py-3 font-medium">표시 이름</th>
                <th className="px-4 py-3 font-medium">범위</th>
                <th className="px-4 py-3 font-medium">사용 여부</th>
                <th className="px-4 py-3 font-medium">정렬 순서</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                <th className="px-4 py-3 font-medium">수정일</th>
                <th className="px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((generation) => {
                const isEditing = editingId === generation.id;

                return (
                  <tr
                    className="border-b border-slate-100 last:border-b-0"
                    key={generation.id}
                  >
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="w-28 rounded-md border border-slate-300 px-3 py-2"
                          min="1"
                          onChange={(event) =>
                            setEditGenerationNumber(event.target.value)
                          }
                          type="number"
                          value={editGenerationNumber}
                        />
                      ) : (
                        generation.generation_number
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {isEditing ? (
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2"
                          onChange={(event) => setEditLabel(event.target.value)}
                          value={editLabel}
                        />
                      ) : (
                        generation.label
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {generation.scope_type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          generation.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel(generation.is_active)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="w-28 rounded-md border border-slate-300 px-3 py-2"
                          onChange={(event) =>
                            setEditSortOrder(event.target.value)
                          }
                          type="number"
                          value={editSortOrder}
                        />
                      ) : (
                        generation.sort_order
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(generation.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(generation.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                            disabled={pendingAction !== null}
                            onClick={() => handleUpdate(generation.id)}
                            type="button"
                          >
                            {pendingAction === `update:${generation.id}`
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
                            onClick={() => startEdit(generation)}
                            type="button"
                          >
                            수정
                          </button>
                          <button
                            className={`rounded-md border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 ${
                              generation.is_active
                                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            disabled={pendingAction !== null}
                            onClick={() => handleToggleActive(generation)}
                            type="button"
                          >
                            {pendingAction === `active:${generation.id}`
                              ? "처리 중..."
                              : generation.is_active
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
