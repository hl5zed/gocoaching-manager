"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AssignCandidate,
  AssignCoachingGenealogyResult,
  CoachingGenealogyData,
} from "@/lib/api/admin/coaching-genealogy";

type AssignPanelProps = {
  data: CoachingGenealogyData;
};

type GenerationInputMode = "none" | "option" | "custom";
type AssignSuccessData = Extract<
  AssignCoachingGenealogyResult,
  { ok: true }
>["data"];

const ROLE_OPTIONS = [
  { label: "전체", value: "all" },
  { label: "코치", value: "coach" },
  { label: "코치메이커", value: "coach_maker" },
  { label: "코치이", value: "coachee" },
];

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "미지정";
}

function generationLabel(value: number | null | undefined) {
  return Number.isInteger(value) && value ? `${value}세대` : "미지정";
}

function countryLabel(candidate: AssignCandidate) {
  if (!candidate.countryName) {
    return "미지정";
  }

  return candidate.countryCode
    ? `${candidate.countryName} (${candidate.countryCode})`
    : candidate.countryName;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "미지정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미지정";
  }

  return date.toLocaleDateString("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function assignmentStatusLabel(status: AssignCandidate["assignmentStatus"]) {
  if (status === "assigned_to_selected_coach") {
    return "현재 선택 코치에게 이미 배정됨";
  }

  if (status === "assigned") {
    return "이미 담당 코치 있음";
  }

  return "미배정";
}

function assignmentStatusClass(status: AssignCandidate["assignmentStatus"]) {
  if (status === "assigned_to_selected_coach") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "assigned") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function inferScope(data: CoachingGenealogyData) {
  if (data.filters.churchId) {
    return { scopeId: data.filters.churchId, scopeType: "church" };
  }

  if (data.filters.organizationId) {
    return { scopeId: data.filters.organizationId, scopeType: "organization" };
  }

  if (data.filters.countryId) {
    return { scopeId: data.filters.countryId, scopeType: "country" };
  }

  return { scopeId: null, scopeType: "global" };
}

function ResultList({
  items,
  title,
}: {
  items: Array<{ coacheeProfileId?: string; profileId?: string; message: string }>;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((item, index) => (
          <li key={`${item.coacheeProfileId ?? item.profileId ?? "item"}-${index}`}>
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GenealogyAssignPanel({ data }: AssignPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedCoachId, setSelectedCoachId] = useState(
    data.filters.coachProfileId ?? "",
  );
  const [selectedCoacheeIds, setSelectedCoacheeIds] = useState<string[]>([]);
  const [generationMode, setGenerationMode] =
    useState<GenerationInputMode>("none");
  const [generationOption, setGenerationOption] = useState("");
  const [customGeneration, setCustomGeneration] = useState("");
  const [searchText, setSearchText] = useState(data.filters.q ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AssignSuccessData | null>(null);

  const selectedCoach =
    data.assignData.coaches.find((coach) => coach.profileId === selectedCoachId) ??
    null;
  const recommendedGeneration =
    selectedCoach?.generationNumber && selectedCoach.generationNumber > 0
      ? selectedCoach.generationNumber + 1
      : null;
  const scope = useMemo(() => inferScope(data), [data]);
  const selectableCoachees = data.assignData.coachees.filter(
    (coachee) => coachee.profileId !== selectedCoachId,
  );

  function updateQuery(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("view", "assign");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetAssignFilters() {
    router.push(`${pathname}?view=assign`);
  }

  function handleCoachChange(value: string) {
    setSelectedCoachId(value);
    setSelectedCoacheeIds((current) => current.filter((id) => id !== value));
    updateQuery("coachProfileId", value);
  }

  function toggleCoachee(id: string) {
    setSelectedCoacheeIds((current) =>
      current.includes(id)
        ? current.filter((coacheeId) => coacheeId !== id)
        : [...current, id],
    );
  }

  function resolveGenerationNumber() {
    if (generationMode === "none") {
      return null;
    }

    const rawValue =
      generationMode === "custom" ? customGeneration : generationOption;

    if (!rawValue.trim()) {
      return null;
    }

    const value = Number(rawValue);

    if (!Number.isInteger(value) || value < 1) {
      throw new Error("세대는 1 이상의 숫자로 입력해 주세요.");
    }

    return value;
  }

  async function handleAssign() {
    setMessage(null);
    setErrorMessage(null);
    setLastResult(null);

    if (!selectedCoachId) {
      setErrorMessage("코치를 선택해 주세요.");
      return;
    }

    if (selectedCoacheeIds.length === 0) {
      setErrorMessage("배정할 코치이를 선택해 주세요.");
      return;
    }

    let generationNumber: number | null = null;

    try {
      generationNumber = resolveGenerationNumber();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "세대 값을 확인해 주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/coaching-genealogy/assign", {
          body: JSON.stringify({
            coachProfileId: selectedCoachId,
            coacheeProfileIds: selectedCoacheeIds,
            generationNumber,
            scopeId: scope.scopeId,
            scopeType: scope.scopeType,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = (await response.json()) as AssignCoachingGenealogyResult;

        if (!response.ok || !result.ok) {
          setErrorMessage(
            result.ok
              ? "배정 처리 중 오류가 발생했습니다."
              : result.error.message,
          );
          return;
        }

        const { created, skipped, updatedGenerations } = result.data;
        setLastResult(result.data);
        setMessage(
          `배정 처리 완료: 생성 ${created.length}건, 세대 변경 ${updatedGenerations.length}건, 건너뜀 ${skipped.length}건`,
        );
        setSelectedCoacheeIds([]);
        router.refresh();
      } catch (error) {
        console.error("[GENEALOGY_ASSIGN_REQUEST_FAILED]", error);
        setErrorMessage("배정 처리 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">배정 관리</h2>
        <p className="mt-2 text-sm text-slate-600">
          코치와 코치이를 배정하고, 세대를 지정할 수 있습니다. 세대 변경은
          자동으로 이력에 기록됩니다.
        </p>
      </div>

      <div className="rounded-md border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-900">
        <p className="font-semibold">세대 정의 안내</p>
        <p className="mt-2">
          세대는 재귀 계보 방식으로 이해합니다. 코치이가 성장하여 다른 사람의
          코치가 되면 다음 세대로 이어집니다. 다만 실제 세대 값은 관리자가
          수동으로 지정하며, 변경 이력은 자동으로 기록됩니다.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">필터</h3>
            <p className="mt-1 text-sm text-slate-600">
              코치와 코치이 후보, 현재 배정 관계 목록에 함께 적용됩니다.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            onClick={resetAssignFilters}
            type="button"
          >
            배정 필터 초기화
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-700">
            국가
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => updateQuery("countryId", event.target.value)}
              value={data.filters.countryId ?? ""}
            >
              <option value="">전체</option>
              {data.countryStats
                .filter((country) => country.countryId)
                .map((country) => (
                  <option key={country.countryId} value={country.countryId ?? ""}>
                    {country.countryCode
                      ? `${country.countryName} (${country.countryCode})`
                      : country.countryName}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            교회
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => updateQuery("churchId", event.target.value)}
              value={data.filters.churchId ?? ""}
            >
              <option value="">전체</option>
              {data.churchStats
                .filter((church) => church.churchId)
                .map((church) => (
                  <option key={church.churchId} value={church.churchId ?? ""}>
                    {church.churchName}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            세대
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) =>
                updateQuery("generationNumber", event.target.value)
              }
              value={data.filters.generationNumber?.toString() ?? ""}
            >
              <option value="">전체</option>
              {data.generationStats
                .filter((generation) => generation.generationNumber !== null)
                .map((generation) => (
                  <option
                    key={generation.generationNumber}
                    value={generation.generationNumber ?? ""}
                  >
                    {generation.label}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            역할
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => updateQuery("role", event.target.value)}
              value={data.filters.role ?? "all"}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <form
            className="text-sm font-medium text-slate-700"
            onSubmit={(event) => {
              event.preventDefault();
              updateQuery("q", searchText.trim());
            }}
          >
            검색어
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="이름, 이메일"
                value={searchText}
              />
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                type="submit"
              >
                적용
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">코치 선택</h3>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              배정할 코치
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                onChange={(event) => handleCoachChange(event.target.value)}
                value={selectedCoachId}
              >
                <option value="">코치를 선택해 주세요</option>
                {data.assignData.coaches.map((coach) => (
                  <option key={coach.profileId} value={coach.profileId}>
                    {coach.label} / {generationLabel(coach.generationNumber)} /{" "}
                    담당 {coach.activeCoacheeCount}명
                  </option>
                ))}
              </select>
            </label>
            {data.assignData.coaches.length === 0 ? (
              <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                배정 가능한 코치가 없습니다.
              </p>
            ) : selectedCoach ? (
              <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{selectedCoach.label}</p>
                <p className="mt-1">{displayValue(selectedCoach.email)}</p>
                <p className="mt-1">
                  {generationLabel(selectedCoach.generationNumber)} ·{" "}
                  {countryLabel(selectedCoach)} ·{" "}
                  {displayValue(selectedCoach.churchName)}
                </p>
                <p className="mt-2 text-slate-600">
                  추천 세대:{" "}
                  {recommendedGeneration
                    ? `${recommendedGeneration}세대`
                    : "코치 세대가 없어 추천할 수 없습니다."}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">세대 지정</h3>
            <p className="mt-1 text-sm text-slate-600">
              선택한 코치이에게만 적용됩니다. 비워두면 세대는 변경하지 않습니다.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={generationMode === "none"}
                  onChange={() => setGenerationMode("none")}
                  type="radio"
                />
                세대 변경 안 함
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={generationMode === "option"}
                  onChange={() => setGenerationMode("option")}
                  type="radio"
                />
                세대 옵션에서 선택
              </label>
              {generationMode === "option" ? (
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  onChange={(event) => setGenerationOption(event.target.value)}
                  value={generationOption}
                >
                  <option value="">세대 선택</option>
                  {data.assignData.generationOptions.map((option) => (
                    <option
                      key={option.generationNumber}
                      value={option.generationNumber}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={generationMode === "custom"}
                  onChange={() => setGenerationMode("custom")}
                  type="radio"
                />
                직접 입력
              </label>
              {generationMode === "custom" ? (
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  min={1}
                  onChange={(event) => setCustomGeneration(event.target.value)}
                  placeholder="예: 6"
                  type="number"
                  value={customGeneration}
                />
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                코치이 선택
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                선택됨 {selectedCoacheeIds.length}명 / 후보{" "}
                {selectableCoachees.length}명
              </p>
            </div>
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={
                isPending || !selectedCoachId || selectedCoacheeIds.length === 0
              }
              onClick={handleAssign}
              type="button"
            >
              {isPending ? "배정 처리 중..." : "선택한 코치이 배정"}
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
          {lastResult ? (
            <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-4">
              <ResultList items={lastResult.created} title="생성된 관계" />
              <ResultList
                items={lastResult.updatedGenerations.map((item) => ({
                  ...item,
                  message: `${item.generationNumber}세대로 변경되었습니다.`,
                }))}
                title="세대 변경"
              />
              <ResultList items={lastResult.skipped} title="건너뜀" />
              <ResultList items={lastResult.errors} title="오류" />
            </div>
          ) : null}

          {selectableCoachees.length === 0 ? (
            <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              배정 가능한 코치이가 없습니다.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">선택</th>
                    <th className="px-3 py-3">코치이</th>
                    <th className="px-3 py-3">세대</th>
                    <th className="px-3 py-3">소속</th>
                    <th className="px-3 py-3">현재 담당 코치</th>
                    <th className="px-3 py-3">배정 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectableCoachees.map((coachee) => (
                    <tr key={coachee.profileId}>
                      <td className="px-3 py-3">
                        <input
                          checked={selectedCoacheeIds.includes(coachee.profileId)}
                          onChange={() => toggleCoachee(coachee.profileId)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-950">
                          {coachee.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {displayValue(coachee.email)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {generationLabel(coachee.generationNumber)}
                      </td>
                      <td className="px-3 py-3">
                        <p>{countryLabel(coachee)}</p>
                        <p className="text-xs text-slate-500">
                          {displayValue(coachee.churchName)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {displayValue(coachee.currentCoachLabel)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${assignmentStatusClass(
                            coachee.assignmentStatus,
                          )}`}
                        >
                          {assignmentStatusLabel(coachee.assignmentStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-950">
          현재 배정 관계 목록
        </h3>
        {data.assignData.relationships.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            현재 조건에 해당하는 활성 배정 관계가 없습니다.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">코치</th>
                  <th className="px-3 py-3">코치이</th>
                  <th className="px-3 py-3">소속 국가</th>
                  <th className="px-3 py-3">소속 교회</th>
                  <th className="px-3 py-3">상태</th>
                  <th className="px-3 py-3">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.assignData.relationships.map((relationship) => (
                  <tr key={relationship.relationshipId}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-950">
                        {relationship.coachLabel}
                      </p>
                      <p className="text-xs text-slate-500">
                        {generationLabel(relationship.coachGenerationNumber)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-950">
                        {relationship.coacheeLabel}
                      </p>
                      <p className="text-xs text-slate-500">
                        {generationLabel(relationship.coacheeGenerationNumber)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {relationship.countryCode
                        ? `${relationship.countryName} (${relationship.countryCode})`
                        : displayValue(relationship.countryName)}
                    </td>
                    <td className="px-3 py-3">
                      {displayValue(relationship.churchName)}
                    </td>
                    <td className="px-3 py-3">{relationship.status}</td>
                    <td className="px-3 py-3">
                      {formatDate(relationship.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
