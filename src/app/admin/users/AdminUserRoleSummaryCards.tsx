"use client";

import { useEffect, useState } from "react";

type RoleSummary = {
  totalProfiles: number;
  coacheeCount: number;
  coachCount: number;
  coachMakerCount: number;
  churchAdminCount: number;
  organizationAdminCount: number;
  superAdminCount: number;
};

const EMPTY_SUMMARY: RoleSummary = {
  totalProfiles: 0,
  coacheeCount: 0,
  coachCount: 0,
  coachMakerCount: 0,
  churchAdminCount: 0,
  organizationAdminCount: 0,
  superAdminCount: 0,
};

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeSummary(value: unknown): RoleSummary {
  const source = value && typeof value === "object" ? value : {};
  const record = source as Partial<Record<keyof RoleSummary, unknown>>;

  return {
    totalProfiles: asNumber(record.totalProfiles),
    coacheeCount: asNumber(record.coacheeCount),
    coachCount: asNumber(record.coachCount),
    coachMakerCount: asNumber(record.coachMakerCount),
    churchAdminCount: asNumber(record.churchAdminCount),
    organizationAdminCount: asNumber(record.organizationAdminCount),
    superAdminCount: asNumber(record.superAdminCount),
  };
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

export function AdminUserRoleSummaryCards() {
  const [summary, setSummary] = useState<RoleSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/admin/users/summary", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("summary request failed");
        }

        const payload = (await response.json()) as unknown;
        setSummary(normalizeSummary(payload));
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }

        setError("요약 정보를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, []);

  const cards = [
    {
      label: "전체 회원 수",
      value: summary.totalProfiles,
      description: "profiles 기준",
    },
    {
      label: "코치이 수",
      value: summary.coacheeCount,
      description: "활성 역할 기준",
    },
    {
      label: "코치 수",
      value: summary.coachCount,
      description: "활성 역할 기준",
    },
    {
      label: "코치메이커 수",
      value: summary.coachMakerCount,
      description: "활성 역할 기준",
    },
    {
      label: "교회 관리자 수",
      value: summary.churchAdminCount,
      description: "활성 역할 기준",
    },
    {
      label: "기관 관리자 수",
      value: summary.organizationAdminCount,
      description: "활성 역할 기준",
    },
    {
      label: "최고 관리자 수",
      value: summary.superAdminCount,
      description: "활성 역할 기준",
    },
  ];

  if (error) {
    return (
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => (
        <article
          className="rounded-md border border-slate-200 bg-white p-4"
          key={card.label}
        >
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {isLoading ? (
              <span className="inline-block h-8 w-14 animate-pulse rounded bg-slate-200 align-middle" />
            ) : (
              formatCount(card.value)
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isLoading ? "요약 불러오는 중..." : card.description}
          </p>
        </article>
      ))}
    </div>
  );
}
