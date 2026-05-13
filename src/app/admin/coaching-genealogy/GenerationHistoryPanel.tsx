"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CoachingGenealogyData,
  GenerationHistoryData,
  GenerationHistoryItem,
} from "@/lib/api/admin/coaching-genealogy";

type GenerationHistoryPanelProps = {
  data: CoachingGenealogyData;
};

function displayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "미지정";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "미지정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "미지정";
  }

  return date.toLocaleString("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCountry(item: GenerationHistoryItem) {
  if (item.countryName === "미지정") {
    return "미지정";
  }

  return item.countryCode
    ? `${item.countryName} (${item.countryCode})`
    : item.countryName;
}

function getHasActiveHistoryFilter(searchParams: URLSearchParams) {
  return [
    "profileId",
    "changedByProfileId",
    "countryId",
    "organizationId",
    "churchId",
    "oldGenerationNumber",
    "newGenerationNumber",
    "generationNumber",
    "changeSource",
    "dateFrom",
    "dateTo",
    "search",
  ].some((key) => {
    const value = searchParams.get(key);
    return value !== null && value.trim().length > 0 && value !== "all";
  });
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[70%] text-right font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}

type HistoryApiResponse = {
  ok?: boolean;
  data?: unknown;
  error?: {
    message?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toPositiveInteger(value: unknown, fallback: number) {
  const numberValue = toNumber(value, fallback);

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeHistoryData(value: unknown): GenerationHistoryData {
  const source = isRecord(value) ? value : {};
  const items = Array.isArray(source.items)
    ? (source.items as GenerationHistoryItem[])
    : [];
  const summary = isRecord(source.summary) ? source.summary : {};
  const pagination = isRecord(source.pagination) ? source.pagination : {};
  const options = isRecord(source.options) ? source.options : {};
  const page = toPositiveInteger(pagination.page, 1);
  const pageSize = toPositiveInteger(pagination.pageSize, 20);
  const totalItems = toNumber(
    pagination.totalItems ?? pagination.totalCount,
    items.length,
  );
  const totalPages = toNumber(
    pagination.totalPages,
    totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
  );

  return {
    items,
    summary: {
      totalChanges: toNumber(
        summary.totalChanges ?? summary.totalCount,
        items.length,
      ),
      last7DaysChanges: toNumber(
        summary.last7DaysChanges ?? summary.recent7DaysCount,
      ),
      last30DaysChanges: toNumber(
        summary.last30DaysChanges ?? summary.recent30DaysCount,
      ),
      mostChangedGeneration:
        typeof summary.mostChangedGeneration === "string"
          ? summary.mostChangedGeneration
          : "미지정",
      changedProfileCount: toNumber(summary.changedProfileCount),
    },
    filters: isRecord(source.filters)
      ? (source.filters as GenerationHistoryData["filters"])
      : {
          changeSource: null,
          changedByProfileId: null,
          churchId: null,
          countryId: null,
          dateFrom: null,
          dateTo: null,
          generationNumber: null,
          newGenerationNumber: null,
          oldGenerationNumber: null,
          organizationId: null,
          page,
          pageSize,
          profileId: null,
          search: null,
        },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    options: {
      changedByProfiles: Array.isArray(options.changedByProfiles)
        ? (options.changedByProfiles as Array<{ id: string; label: string }>)
        : [],
      changeSources: Array.isArray(options.changeSources)
        ? (options.changeSources as string[])
        : [],
    },
  };
}

export function GenerationHistoryPanel({ data }: GenerationHistoryPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [historyData, setHistoryData] = useState<GenerationHistoryData | null>(
    null,
  );
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(searchParams.get("search") ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedHistory =
    historyData?.items.find((item) => item.id === selectedHistoryId) ?? null;
  const hasActiveFilter = getHasActiveHistoryFilter(searchParams);
  const organizationOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const node of data.nodes) {
      if (node.organizationId && node.organizationName) {
        map.set(node.organizationId, node.organizationName);
      }
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data.nodes]);

  useEffect(() => {
    setSearchText(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    setIsLoading(true);
    setErrorMessage(null);

    fetch(`/api/admin/coaching-genealogy/history?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as HistoryApiResponse;

        if (!response.ok || result.ok !== true) {
          throw new Error("세대 변경 이력을 조회하는 중 오류가 발생했습니다.");
        }

        const normalizedData = normalizeHistoryData(result.data);

        setHistoryData(normalizedData);
        setErrorMessage(null);
        setSelectedHistoryId((current) =>
          current && normalizedData.items.some((item) => item.id === current)
            ? current
            : null,
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setHistoryData(null);
        setSelectedHistoryId(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "세대 변경 이력을 조회하는 중 오류가 발생했습니다.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [searchParams]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("view", "history");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "history");
    params.set("page", page.toString());
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    router.push(`${pathname}?view=history`);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">변경 이력</h2>
        <p className="mt-2 text-sm text-slate-600">
          회원의 세대 변경 이력을 확인합니다. 세대 변경은 배정 관리 또는
          관리자 수정 시 자동으로 기록됩니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="전체 변경 건수"
          value={historyData?.summary.totalChanges ?? 0}
        />
        <SummaryCard
          label="최근 7일"
          value={historyData?.summary.last7DaysChanges ?? 0}
        />
        <SummaryCard
          label="최근 30일"
          value={historyData?.summary.last30DaysChanges ?? 0}
        />
        <SummaryCard
          label="가장 많이 변경된 세대"
          value={historyData?.summary.mostChangedGeneration ?? "미지정"}
        />
        <SummaryCard
          label="변경 대상 회원 수"
          value={historyData?.summary.changedProfileCount ?? 0}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">필터</h3>
            <p className="mt-1 text-sm text-slate-600">
              필터 변경은 URL에 반영되어 브라우저 뒤로가기로 이전 상태를
              복구할 수 있습니다.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            onClick={resetFilters}
            type="button"
          >
            필터 초기화
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <form
            className="text-sm font-medium text-slate-700"
            onSubmit={(event) => {
              event.preventDefault();
              updateFilter("search", searchText.trim());
            }}
          >
            검색어
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="이름, 이메일, 국가, 교회"
                value={searchText}
              />
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="submit"
              >
                적용
              </button>
            </div>
          </form>

          <label className="text-sm font-medium text-slate-700">
            국가
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => updateFilter("countryId", event.target.value)}
              value={searchParams.get("countryId") ?? ""}
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
            기관
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) =>
                updateFilter("organizationId", event.target.value)
              }
              value={searchParams.get("organizationId") ?? ""}
            >
              <option value="">전체</option>
              {organizationOptions.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            교회
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => updateFilter("churchId", event.target.value)}
              value={searchParams.get("churchId") ?? ""}
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
            변경 전 세대
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) =>
                updateFilter("oldGenerationNumber", event.target.value)
              }
              value={searchParams.get("oldGenerationNumber") ?? ""}
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
            변경 후 세대
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) =>
                updateFilter("newGenerationNumber", event.target.value)
              }
              value={searchParams.get("newGenerationNumber") ?? ""}
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
            변경자
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) =>
                updateFilter("changedByProfileId", event.target.value)
              }
              value={searchParams.get("changedByProfileId") ?? ""}
            >
              <option value="">전체</option>
              {historyData?.options.changedByProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            기간 시작일
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              type="date"
              value={searchParams.get("dateFrom") ?? ""}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            기간 종료일
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              type="date"
              value={searchParams.get("dateTo") ?? ""}
            />
          </label>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                세대 변경 타임라인
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                최신 변경일수록 위에 표시됩니다.
              </p>
            </div>
            <p className="text-sm text-slate-500">
              전체 {historyData?.pagination.totalItems ?? 0}건
            </p>
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              세대 변경 이력을 불러오는 중입니다.
            </p>
          ) : historyData && historyData.items.length === 0 ? (
            <p className="mt-6 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              {hasActiveFilter
                ? "선택한 조건에 해당하는 세대 변경 이력이 없습니다."
                : "세대 변경 이력이 없습니다."}
            </p>
          ) : (
            <ol className="mt-6 space-y-4">
              {historyData?.items.map((item) => {
                const isSelected = selectedHistoryId === item.id;

                return (
                  <li key={item.id}>
                    <button
                      className={`w-full rounded-md border p-4 text-left transition ${
                        isSelected
                          ? "border-slate-950 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                      onClick={() => setSelectedHistoryId(item.id)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {item.profileName}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {displayValue(item.profileEmail)}
                          </p>
                        </div>
                        <p className="text-sm text-slate-500">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          {item.oldGenerationLabel}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
                          {item.newGenerationLabel}
                        </span>
                        <span className="text-slate-500">
                          변경자: {item.changedByName}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {formatCountry(item)} · {displayValue(item.organizationName)} ·{" "}
                        {displayValue(item.churchName)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {historyData && historyData.pagination.totalPages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                {historyData.pagination.page} / {historyData.pagination.totalPages}
                페이지
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
                  disabled={historyData.pagination.page <= 1}
                  onClick={() => updatePage(historyData.pagination.page - 1)}
                  type="button"
                >
                  이전
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
                  disabled={
                    historyData.pagination.page >=
                    historyData.pagination.totalPages
                  }
                  onClick={() => updatePage(historyData.pagination.page + 1)}
                  type="button"
                >
                  다음
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="rounded-md border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-950">이력 상세</h3>
          {selectedHistory ? (
            <div className="mt-4">
              <DetailRow label="이력 ID" value={selectedHistory.id} />
              <DetailRow
                label="대상 회원"
                value={`${selectedHistory.profileName} / ${displayValue(
                  selectedHistory.profileEmail,
                )}`}
              />
              <DetailRow
                label="변경 전 세대"
                value={selectedHistory.oldGenerationLabel}
              />
              <DetailRow
                label="변경 후 세대"
                value={selectedHistory.newGenerationLabel}
              />
              <DetailRow label="변경자" value={selectedHistory.changedByName} />
              <DetailRow
                label="변경 시각"
                value={formatDateTime(selectedHistory.createdAt)}
              />
              <DetailRow
                label="변경 출처"
                value={displayValue(selectedHistory.changeSource)}
              />
              <DetailRow
                label="사유"
                value={displayValue(selectedHistory.reason)}
              />
              <DetailRow
                label="현재 회원 상태"
                value={displayValue(selectedHistory.currentStatus)}
              />
              <DetailRow label="소속 국가" value={formatCountry(selectedHistory)} />
              <DetailRow
                label="소속 기관 및 단체"
                value={displayValue(selectedHistory.organizationName)}
              />
              <DetailRow
                label="소속 교회"
                value={displayValue(selectedHistory.churchName)}
              />
              <DetailRow
                label="현재 역할"
                value={displayValue(selectedHistory.currentRoleSummary)}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              타임라인 항목을 선택하면 상세 정보가 표시됩니다.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
