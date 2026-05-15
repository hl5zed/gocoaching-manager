"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  FieldLabel,
  FieldText,
  SelectInput,
  TextInput,
} from "@/components/ui";
import { useI18n } from "@/lib/i18n/useI18n";

type FilterOption = {
  value: string;
  label: string;
};

type SortKey = "name" | "email" | "role" | "status" | "scope" | "created_at";
type SortDirection = "asc" | "desc";

type AdminUsersClientFiltersProps = {
  children: ReactNode;
  roleOptions: FilterOption[];
  statusOptions: FilterOption[];
  totalCount: number;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function getRows() {
  return Array.from(
    document.querySelectorAll<HTMLTableRowElement>("[data-admin-user-row]"),
  );
}

function getSortableHeaders() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-admin-user-sort]"),
  );
}

function closeRowDetails(row: HTMLTableRowElement) {
  const details = row.querySelector<HTMLDetailsElement>("details[open]");

  if (details) {
    details.open = false;
  }
}

function getSortValue(row: HTMLTableRowElement, sortKey: SortKey) {
  switch (sortKey) {
    case "name":
      return row.dataset.name ?? "";
    case "email":
      return row.dataset.email ?? "";
    case "role":
      return row.dataset.primaryRole ?? "";
    case "status":
      return row.dataset.status ?? "";
    case "scope":
      return row.dataset.scope ?? "";
    case "created_at":
      return row.dataset.createdAt ?? "";
  }
}

function compareRows(sortKey: SortKey, sortDirection: SortDirection) {
  return (left: HTMLTableRowElement, right: HTMLTableRowElement) => {
    const leftValue = getSortValue(left, sortKey);
    const rightValue = getSortValue(right, sortKey);
    const result = leftValue.localeCompare(rightValue, "ko", {
      numeric: true,
      sensitivity: "base",
    });

    return sortDirection === "asc" ? result : -result;
  };
}

function getEmptyFilterMessage({
  search,
  role,
  status,
  t,
}: {
  search: string;
  role: string;
  status: string;
  t: (key: string, fallback?: string) => string;
}) {
  if (role !== "all") {
    return t("adminUsers.selectedRoleEmpty", "선택한 역할에 해당하는 회원이 없습니다.");
  }

  if (search.trim().length > 0 || status !== "all") {
    return t("adminUsers.searchEmpty", "검색 조건에 맞는 회원이 없습니다.");
  }

  return t("adminUsers.noUsers", "등록된 회원이 없습니다.");
}

function formatMessage(
  template: string,
  values: Record<string, number | string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}

export function AdminUsersClientFilters({
  children,
  roleOptions,
  statusOptions,
  totalCount,
}: AdminUsersClientFiltersProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [filteredCount, setFilteredCount] = useState(totalCount);

  const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch, role, status, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const rows = getRows();
    const matchingRows = rows.filter((row) => {
      const rowSearch = row.dataset.search?.toLowerCase() ?? "";
      const rowRoles = row.dataset.roles?.split(",").filter(Boolean) ?? [];
      const rowStatus = row.dataset.status ?? "";
      const matchesSearch =
        normalizedSearch.length === 0 || rowSearch.includes(normalizedSearch);
      const matchesRole = role === "all" || rowRoles.includes(role);
      const matchesStatus = status === "all" || rowStatus === status;

      return matchesSearch && matchesRole && matchesStatus;
    });
    const sortedRows = [...matchingRows].sort(compareRows(sortKey, sortDirection));
    const firstVisibleIndex = (currentPage - 1) * pageSize;
    const lastVisibleIndex = firstVisibleIndex + pageSize;
    const visibleRows = new Set(
      sortedRows.slice(firstVisibleIndex, lastVisibleIndex),
    );
    const tableBody = rows[0]?.parentElement ?? null;

    if (tableBody) {
      for (const row of sortedRows) {
        tableBody.appendChild(row);
      }
    }

    for (const row of rows) {
      const isVisible = visibleRows.has(row);

      row.hidden = !isVisible;

      if (!isVisible) {
        closeRowDetails(row);
      }
    }

    setFilteredCount(matchingRows.length);
  }, [currentPage, normalizedSearch, pageSize, role, sortDirection, sortKey, status]);

  useEffect(() => {
    const headers = getSortableHeaders();

    for (const header of headers) {
      const headerSortKey = header.dataset.adminUserSort;
      const label = header.dataset.sortLabel ?? header.textContent?.trim() ?? "";
      const isActive = headerSortKey === sortKey;

      header.textContent = `${label}${isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}`;
      header.setAttribute(
        "aria-sort",
        isActive
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none",
      );
    }
  }, [sortDirection, sortKey]);

  useEffect(() => {
    const headers = getSortableHeaders();
    const listeners = headers.map((header) => {
      const nextSortKey = header.dataset.adminUserSort as SortKey | undefined;
      const listener = () => {
        if (!nextSortKey) {
          return;
        }

        setSortKey((currentSortKey) => {
          if (currentSortKey === nextSortKey) {
            setSortDirection((currentDirection) =>
              currentDirection === "asc" ? "desc" : "asc",
            );
            return currentSortKey;
          }

          setSortDirection("asc");
          return nextSortKey;
        });
      };

      header.addEventListener("click", listener);

      return {
        header,
        listener,
      };
    });

    return () => {
      for (const { header, listener } of listeners) {
        header.removeEventListener("click", listener);
      }
    };
  }, []);

  function resetFilters() {
    setSearch("");
    setRole("all");
    setStatus("all");
    setCurrentPage(1);
  }

  return (
    <>
      <Card className="mt-6">
        <CardContent className="p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <FieldLabel>
            <FieldText>
              {t("common.search", "검색")}
            </FieldText>
            <TextInput
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("adminUsers.searchPlaceholder", "이름, 이메일, 역할, 소속/조직")}
              type="search"
              value={search}
            />
          </FieldLabel>

          <FieldLabel>
            <FieldText>
              {t("members.role", "역할")}
            </FieldText>
            <SelectInput
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option value="all">{t("common.all", "전체")}</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`roles.${option.value}`, option.label)}
                </option>
              ))}
            </SelectInput>
          </FieldLabel>

          <FieldLabel>
            <FieldText>
              {t("members.status", "상태")}
            </FieldText>
            <SelectInput
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="all">{t("common.all", "전체")}</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`status.${option.value}`, option.label)}
                </option>
              ))}
            </SelectInput>
          </FieldLabel>

          <FieldLabel>
            <FieldText>
              {t("adminUsers.pageSize", "페이지 크기")}
            </FieldText>
            <SelectInput
              onChange={(event) =>
                setPageSize(Number(event.target.value) as typeof pageSize)
              }
              value={pageSize}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
          </FieldLabel>

          <Button
            icon="filter"
            onClick={resetFilters}
            type="button"
            variant="secondary"
          >
            {t("adminUsers.resetFilters", "필터 초기화")}
          </Button>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          {formatMessage(
            t("adminUsers.filterInfo", "필터 결과 {filtered}명 / 현재 페이지 데이터 {total}명"),
            { filtered: filteredCount, total: totalCount },
          )}
        </p>
        </CardContent>
      </Card>

      {children}

      {filteredCount === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-6 text-sm text-slate-600">
            {getEmptyFilterMessage({ search, role, status, t })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <p className="text-sm text-slate-600">
          {formatMessage(
            t("adminUsers.pageInfo", "전체 결과 {total}명 · 현재 페이지 {page} / {pages}"),
            { page: currentPage, pages: totalPages, total: filteredCount },
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            disabled={currentPage <= 1}
            icon="arrow-left"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t("adminUsers.previousPage", "이전")}
          </Button>
          <Button
            disabled={currentPage >= totalPages}
            icon="arrow-right"
            iconPosition="right"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t("adminUsers.nextPage", "다음")}
          </Button>
        </div>
        </CardContent>
      </Card>
    </>
  );
}
