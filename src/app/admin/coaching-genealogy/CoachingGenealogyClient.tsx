"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CoachingGenealogyData,
  GenealogyNode,
} from "@/lib/api/admin/coaching-genealogy";
import { useI18n } from "@/lib/i18n/useI18n";
import { GenealogyAssignPanel } from "./GenealogyAssignPanel";
import { GenealogyMapView } from "./GenealogyMapView";
import { GenealogyStatsPanel } from "./GenealogyStatsPanel";
import { GenealogyTreeView } from "./GenealogyTreeView";
import { GenerationHistoryPanel } from "./GenerationHistoryPanel";

type GenealogyView = "tree" | "map" | "assign" | "history";

type CoachingGenealogyClientProps = {
  data: CoachingGenealogyData;
  view: GenealogyView;
};

const TABS: Array<{ fallback: string; key: string; value: GenealogyView }> = [
  { fallback: "계보 트리", key: "genealogy.tree", value: "tree" },
  { fallback: "지역 지도", key: "genealogy.map", value: "map" },
  { fallback: "배정 관리", key: "genealogy.assign", value: "assign" },
  { fallback: "변경 이력", key: "genealogy.history", value: "history" },
];

function getViewLabel(
  view: GenealogyView,
  t: (key: string, fallback?: string) => string,
) {
  const tab = TABS.find((item) => item.value === view);

  return tab ? t(tab.key, tab.fallback) : t("genealogy.tree", "계보 트리");
}

function buildHref(searchParams: URLSearchParams, view: GenealogyView) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", view);
  return `/admin/coaching-genealogy?${params.toString()}`;
}

function getNodeLabel(node: GenealogyNode | null) {
  return node?.label ?? "선택된 회원이 없습니다.";
}

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "미지정";
}

function generationLabel(value: number | null) {
  return value ? `${value}세대` : "미지정";
}

function countryLabel(node: GenealogyNode) {
  if (!node.countryName) {
    return "미지정";
  }

  return node.countryCode
    ? `${node.countryName} (${node.countryCode})`
    : node.countryName;
}

function getCountryOptions(data: CoachingGenealogyData) {
  return data.countryStats.filter((country) => country.countryId);
}

function getChurchOptions(data: CoachingGenealogyData) {
  return data.churchStats.filter((church) => church.churchId);
}

function getGenerationOptions(data: CoachingGenealogyData) {
  return data.generationStats.filter(
    (generation) => generation.generationNumber !== null,
  );
}

function formatPrintTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getFilterSummary(
  data: CoachingGenealogyData,
  t: (key: string, fallback?: string) => string,
) {
  const country =
    data.countryStats.find(
      (countryItem) => countryItem.countryId === data.filters.countryId,
    ) ?? null;
  const region =
    data.regionStats.find(
      (regionItem) => regionItem.regionId === data.filters.regionId,
    ) ?? null;
  const church =
    data.churchStats.find(
      (churchItem) => churchItem.churchId === data.filters.churchId,
    ) ?? null;
  const generation =
    data.generationStats.find(
      (generationItem) =>
        generationItem.generationNumber === data.filters.generationNumber,
    ) ?? null;

  return [
    `${t("genealogy.filterCountry", "국가")}: ${
      country
        ? country.countryCode
          ? `${country.countryName} (${country.countryCode})`
          : country.countryName
        : t("common.all", "전체")
    }`,
    `${t("genealogy.filterRegion", "지역")}: ${region?.regionName ?? t("common.all", "전체")}`,
    `${t("genealogy.filterChurch", "교회")}: ${church?.churchName ?? t("common.all", "전체")}`,
    `${t("genealogy.filterGeneration", "세대")}: ${generation?.label ?? t("common.all", "전체")}`,
  ].join(" / ");
}

function PrintReportHeader({
  filterSummary,
  printedAt,
  printedAtLabel,
  printedAtPlaceholder,
  title,
}: {
  filterSummary: string;
  printedAt: string;
  printedAtLabel: string;
  printedAtPlaceholder: string;
  title: string;
}) {
  return (
    <div className="genealogy-print-header">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        GO Coaching Genealogy Report
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
      <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        <p>{printedAtLabel}: {printedAt || printedAtPlaceholder}</p>
        <p>{filterSummary}</p>
      </div>
    </div>
  );
}

function CompactPrintStatsPanel({
  data,
  selectedNode,
}: {
  data: CoachingGenealogyData;
  selectedNode: GenealogyNode | null;
}) {
  const topGenerations = data.generationStats.slice(0, 6);
  const remainingGenerationCount = Math.max(0, data.generationStats.length - 6);
  const topCountries = [...data.countryStats]
    .sort((left, right) => right.profileCount - left.profileCount)
    .slice(0, 4);
  const remainingCountryCount = Math.max(0, data.countryStats.length - 4);
  const topChurches = [...data.churchStats]
    .sort((left, right) => right.profileCount - left.profileCount)
    .slice(0, 4);
  const remainingChurchCount = Math.max(0, data.churchStats.length - 4);

  return (
    <aside className="genealogy-print-side print-only">
      <section className="print-card">
        <h2>선택 노드 정보</h2>
        {selectedNode ? (
          <dl className="print-compact-list">
            <div>
              <dt>이름</dt>
              <dd>{selectedNode.label}</dd>
            </div>
            <div>
              <dt>세대</dt>
              <dd>{generationLabel(selectedNode.generationNumber)}</dd>
            </div>
            <div>
              <dt>국가</dt>
              <dd>{countryLabel(selectedNode)}</dd>
            </div>
            <div>
              <dt>교회</dt>
              <dd>{displayValue(selectedNode.churchName)}</dd>
            </div>
            <div>
              <dt>역할</dt>
              <dd>{displayValue(selectedNode.primaryRole)}</dd>
            </div>
            <div>
              <dt>코치이</dt>
              <dd>{selectedNode.activeCoacheeCount}명</dd>
            </div>
          </dl>
        ) : (
          <p>선택된 노드 없음</p>
        )}
      </section>

      <section className="print-card">
        <h2>전체 현황</h2>
        <dl className="print-compact-list print-summary-grid">
          <div>
            <dt>코치</dt>
            <dd>{data.summaryStats.totalCoaches}명</dd>
          </div>
          <div>
            <dt>코치이</dt>
            <dd>{data.summaryStats.totalCoachees}명</dd>
          </div>
          <div>
            <dt>관계</dt>
            <dd>{data.summaryStats.totalActiveRelationships}개</dd>
          </div>
          <div>
            <dt>최대 세대</dt>
            <dd>{data.summaryStats.maxGeneration}</dd>
          </div>
          <div>
            <dt>국가</dt>
            <dd>{data.summaryStats.totalCountries}개</dd>
          </div>
          <div>
            <dt>교회</dt>
            <dd>{data.summaryStats.totalChurches}개</dd>
          </div>
        </dl>
      </section>

      <section className="print-card">
        <h2>세대별 인원 분포</h2>
        {topGenerations.length > 0 ? (
          <>
            <ul className="print-compact-list">
              {topGenerations.map((stat) => (
                <li key={stat.generationNumber ?? "missing"}>
                  <span>
                    {stat.generationNumber ? `G${stat.generationNumber}` : "미지정"}
                  </span>
                  <strong>{stat.profileCount}명</strong>
                </li>
              ))}
            </ul>
            {remainingGenerationCount > 0 ? (
              <p className="print-more">외 {remainingGenerationCount}개 세대</p>
            ) : null}
          </>
        ) : (
          <p>세대 통계가 없습니다.</p>
        )}
      </section>

      <section className="print-card">
        <h2>국가별 현황</h2>
        {topCountries.length > 0 ? (
          <>
            <ul className="print-compact-list">
              {topCountries.map((country) => (
                <li key={country.countryId ?? "missing"}>
                  <span>
                    {country.countryCode
                      ? `${country.countryName} (${country.countryCode})`
                      : country.countryName}
                  </span>
                  <strong>
                    {country.profileCount}명 / 관계 {country.relationshipCount}
                  </strong>
                </li>
              ))}
            </ul>
            {remainingCountryCount > 0 ? (
              <p className="print-more">외 {remainingCountryCount}개 국가</p>
            ) : null}
          </>
        ) : (
          <p>국가 통계가 없습니다.</p>
        )}
      </section>

      <section className="print-card">
        <h2>교회별 현황</h2>
        {topChurches.length > 0 ? (
          <>
            <ul className="print-compact-list">
              {topChurches.map((church) => (
                <li key={church.churchId ?? "missing"}>
                  <span>{church.churchName}</span>
                  <strong>
                    {church.profileCount}명 / 관계 {church.relationshipCount}
                  </strong>
                </li>
              ))}
            </ul>
            {remainingChurchCount > 0 ? (
              <p className="print-more">외 {remainingChurchCount}개 교회</p>
            ) : null}
          </>
        ) : (
          <p>교회 통계가 없습니다.</p>
        )}
      </section>
    </aside>
  );
}

function PlaceholderPanel({ view }: { view: GenealogyView }) {
  const { t } = useI18n();
  const label = getViewLabel(view, t);
  const message =
    view === "map"
      ? "지역 지도는 다음 단계에서 구현됩니다."
      : view === "assign"
        ? "배정 관리는 다음 단계에서 구현됩니다."
        : "세대 변경 이력은 다음 단계에서 구현됩니다.";

  return (
    <section className="rounded-md border border-slate-200 bg-white p-8">
      <h2 className="text-xl font-semibold">{label}</h2>
      <p className="mt-3 text-slate-600">{message}</p>
    </section>
  );
}

export function CoachingGenealogyClient({
  data,
  view,
}: CoachingGenealogyClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [printedAt, setPrintedAt] = useState("");
  const selectedNode =
    data.nodes.find((node) => node.id === searchParams.get("selectedNodeId")) ??
    null;
  const countryOptions = getCountryOptions(data);
  const churchOptions = getChurchOptions(data);
  const generationOptions = getGenerationOptions(data);
  const hasFilterOptions =
    countryOptions.length > 0 ||
    churchOptions.length > 0 ||
    generationOptions.length > 0;
  const printTarget = view === "tree" || view === "map" ? view : null;
  const filterSummary = getFilterSummary(data, t);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("view", view);
    params.delete("selectedNodeId");
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    router.push(`${pathname}?view=${view}`);
  }

  function selectNode(nodeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "tree");
    params.set("selectedNodeId", nodeId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handlePrint(target: "tree" | "map") {
    if (typeof window === "undefined") {
      return;
    }

    setPrintedAt(formatPrintTimestamp());

    const className =
      target === "tree" ? "printing-genealogy-tree" : "printing-genealogy-map";
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      document.body.classList.remove(className);
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add(className);
    window.addEventListener("afterprint", cleanup);
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <style>{`
        .genealogy-print-header {
          display: none;
        }

        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          body.printing-genealogy-tree,
          body.printing-genealogy-map {
            background: white !important;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area,
          body.printing-genealogy-map #genealogy-map-print-area {
            display: block !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            height: auto !important;
            max-width: none !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            visibility: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area *,
          body.printing-genealogy-map #genealogy-map-print-area * {
            visibility: visible !important;
          }

          body.printing-genealogy-tree main > section > div:first-child,
          body.printing-genealogy-map main > section > div:first-child,
          body.printing-genealogy-tree .no-print,
          body.printing-genealogy-map .no-print {
            display: none !important;
          }

          body.printing-genealogy-tree .genealogy-print-content,
          body.printing-genealogy-map #genealogy-map-print-area > .grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 78mm !important;
            gap: 6mm !important;
            align-items: start !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            height: auto !important;
            overflow: visible !important;
          }

          body.printing-genealogy-tree .genealogy-print-content {
            grid-template-columns: minmax(0, 70%) minmax(0, 30%) !important;
            gap: 4mm !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area > .grid {
            display: grid !important;
            grid-template-columns: minmax(0, 72%) minmax(0, 28%) !important;
            gap: 5mm !important;
            align-items: stretch !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .genealogy-map-print-layout {
            display: grid !important;
            grid-template-columns: minmax(0, 72%) minmax(0, 28%) !important;
            gap: 5mm !important;
            align-items: stretch !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area > .grid > section,
          body.printing-genealogy-map #genealogy-map-print-area > .grid > aside {
            min-width: 0 !important;
            max-width: 100% !important;
            padding: 2mm !important;
            margin: 0 !important;
            position: static !important;
            inset: auto !important;
            z-index: auto !important;
            overflow: hidden !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-screen-map-section {
            min-width: 0 !important;
            max-width: 100% !important;
            height: 115mm !important;
            max-height: 115mm !important;
            padding: 0 !important;
            margin: 0 !important;
            position: relative !important;
            inset: auto !important;
            z-index: auto !important;
            overflow: hidden !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-screen-filter {
            display: none !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-screen-aside {
            display: none !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-print-summary {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 2mm !important;
            align-content: start !important;
            height: 115mm !important;
            max-height: 115mm !important;
            margin-top: 0 !important;
            padding: 0 !important;
            position: static !important;
            z-index: auto !important;
            overflow: hidden !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-print-summary > div {
            border: 1px solid #e5e7eb !important;
            border-radius: 4px !important;
            background: white !important;
            margin: 0 !important;
            padding: 2mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-print-summary dl,
          body.printing-genealogy-map #genealogy-map-print-area .map-print-summary ul {
            display: grid !important;
            gap: 1mm !important;
            margin: 0 !important;
            padding: 0 !important;
            list-style: none !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .map-print-summary dl > div,
          body.printing-genealogy-map #genealogy-map-print-area .map-print-summary li {
            display: flex !important;
            justify-content: space-between !important;
            gap: 2mm !important;
            border-bottom: 1px solid #f1f5f9 !important;
            padding-bottom: 0.7mm !important;
          }

          body.printing-genealogy-tree .genealogy-print-main {
            min-width: 0 !important;
            min-height: 0 !important;
            padding: 2mm !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            overflow: visible !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            height: auto !important;
          }

          body.printing-genealogy-tree .genealogy-print-main > div:first-child {
            margin: 0 0 2mm 0 !important;
          }

          body.printing-genealogy-tree .genealogy-print-main > div:first-child h2 {
            font-size: 11pt !important;
            line-height: 1.15 !important;
            margin: 0 !important;
          }

          body.printing-genealogy-tree .genealogy-print-main > div:first-child p {
            display: none !important;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area,
          body.printing-genealogy-map #genealogy-map-print-area {
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area .space-y-4 {
            display: block !important;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area .overflow-x-auto {
            overflow: visible !important;
            max-height: none !important;
            max-width: 100% !important;
            border: 0 !important;
            background: white !important;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area svg,
          body.printing-genealogy-map #genealogy-map-print-area svg {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            display: block !important;
            height: auto !important;
            max-height: 145mm !important;
          }

          body.printing-genealogy-tree #genealogy-tree-print-area svg {
            max-height: 132mm !important;
          }

          body.printing-genealogy-map .leaflet-container {
            height: 113mm !important;
            max-height: 113mm !important;
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
            overflow: hidden !important;
            z-index: auto !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          body.printing-genealogy-map .leaflet-pane,
          body.printing-genealogy-map .leaflet-map-pane,
          body.printing-genealogy-map .leaflet-tile-pane,
          body.printing-genealogy-map .leaflet-tile-container,
          body.printing-genealogy-map .leaflet-marker-pane,
          body.printing-genealogy-map .leaflet-overlay-pane {
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            will-change: auto !important;
          }

          body.printing-genealogy-map .genealogy-map-print-panel,
          body.printing-genealogy-map .genealogy-map-panel {
            width: 100% !important;
            height: 115mm !important;
            max-height: 115mm !important;
            overflow: hidden !important;
            position: relative !important;
            left: auto !important;
            top: auto !important;
            right: auto !important;
            bottom: auto !important;
            inset: auto !important;
            z-index: auto !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body.printing-genealogy-map .genealogy-map-panel {
            background: linear-gradient(160deg, #dbeafe 0%, #bfdbfe 35%, #a7f3d0 70%, #d1fae5 100%) !important;
          }

          body.printing-genealogy-map .genealogy-map-print-panel {
            display: block !important;
          }

          body.printing-genealogy-map .genealogy-map-legend {
            display: none !important;
          }

          body.printing-genealogy-map .leaflet-control-container,
          body.printing-genealogy-map .leaflet-popup-pane {
            display: none !important;
          }

          body.printing-genealogy-map .genealogy-map-coordinate-warning {
            display: none !important;
          }

          body.printing-genealogy-map .genealogy-print-header > p:first-child {
            display: none !important;
          }

          body.printing-genealogy-map .genealogy-print-header h1 {
            font-size: 14px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }

          body.printing-genealogy-map .genealogy-print-header > div {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 1mm 5mm !important;
            margin-top: 1mm !important;
          }

          body.printing-genealogy-map .genealogy-print-header > div p {
            font-size: 8px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }

          body.printing-genealogy-map .genealogy-print-header {
            margin: 0 0 2mm 0 !important;
            padding: 0 !important;
          }

          body.printing-genealogy-tree .genealogy-print-header,
          body.printing-genealogy-map .genealogy-print-header {
            display: block !important;
            margin: 0 0 2mm 0 !important;
            padding: 0 0 2mm 0 !important;
            border-bottom: 1px solid #d4d4d8 !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          body.printing-genealogy-map .genealogy-print-header {
            padding: 0 !important;
          }

          body.printing-genealogy-tree .genealogy-print-header > p:first-child {
            display: none !important;
          }

          body.printing-genealogy-tree .genealogy-print-header h1 {
            font-size: 14pt !important;
            line-height: 1.15 !important;
            margin: 0 !important;
          }

          body.printing-genealogy-tree .genealogy-print-header > div {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 1mm 5mm !important;
            margin-top: 1mm !important;
          }

          body.printing-genealogy-tree .genealogy-print-header > div p {
            font-size: 8pt !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area label,
          body.printing-genealogy-map #genealogy-map-print-area select,
          body.printing-genealogy-map #genealogy-map-print-area button,
          body.printing-genealogy-map #genealogy-map-print-area a {
            display: none !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area h2 {
            font-size: 9pt !important;
            line-height: 1.15 !important;
            margin: 0 0 2mm 0 !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area .mt-4,
          body.printing-genealogy-map #genealogy-map-print-area .mt-3,
          body.printing-genealogy-map #genealogy-map-print-area .space-y-2 {
            margin-top: 1.5mm !important;
          }

          body.printing-genealogy-map #genealogy-map-print-area p,
          body.printing-genealogy-map #genealogy-map-print-area dt,
          body.printing-genealogy-map #genealogy-map-print-area dd,
          body.printing-genealogy-map #genealogy-map-print-area span {
            font-size: 8px !important;
            line-height: 1.2 !important;
          }

          body.printing-genealogy-tree .genealogy-print-side {
            min-width: 0 !important;
            max-width: 100% !important;
            max-height: 142mm !important;
            overflow: hidden !important;
            display: grid !important;
            gap: 1.5mm !important;
            align-content: start !important;
            font-size: 7.5px !important;
            line-height: 1.15 !important;
          }

          body.printing-genealogy-tree .genealogy-print-side .print-card {
            border: 1px solid #e5e7eb !important;
            border-radius: 4px !important;
            padding: 1.6mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            background: white !important;
          }

          body.printing-genealogy-tree .genealogy-print-side h2,
          body.printing-genealogy-tree .genealogy-print-side h3 {
            font-size: 8.5px !important;
            margin: 0 0 1mm 0 !important;
            line-height: 1.2 !important;
          }

          body.printing-genealogy-tree .genealogy-print-side p,
          body.printing-genealogy-tree .genealogy-print-side li,
          body.printing-genealogy-tree .genealogy-print-side span,
          body.printing-genealogy-tree .genealogy-print-side dt,
          body.printing-genealogy-tree .genealogy-print-side dd,
          body.printing-genealogy-tree .genealogy-print-side strong {
            font-size: 7.5px !important;
            line-height: 1.15 !important;
          }

          body.printing-genealogy-tree .print-compact-list {
            display: grid !important;
            gap: 0.7mm !important;
            margin: 0 !important;
            padding: 0 !important;
            list-style: none !important;
          }

          body.printing-genealogy-tree .print-compact-list div,
          body.printing-genealogy-tree .print-compact-list li {
            display: flex !important;
            justify-content: space-between !important;
            gap: 1.5mm !important;
            border-bottom: 1px solid #f1f5f9 !important;
            padding-bottom: 0.5mm !important;
          }

          body.printing-genealogy-tree .print-summary-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          body.printing-genealogy-tree .print-compact-list dt,
          body.printing-genealogy-tree .print-compact-list span {
            color: #64748b !important;
            font-weight: 500 !important;
          }

          body.printing-genealogy-tree .print-compact-list dd,
          body.printing-genealogy-tree .print-compact-list strong {
            color: #0f172a !important;
            font-weight: 600 !important;
            margin: 0 !important;
            text-align: right !important;
          }

          body.printing-genealogy-tree .print-more {
            margin: 2mm 0 0 0 !important;
            color: #64748b !important;
          }

          body.printing-genealogy-tree section,
          body.printing-genealogy-tree aside,
          body.printing-genealogy-map section,
          body.printing-genealogy-map aside {
            break-before: auto !important;
            page-break-before: auto !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            box-shadow: none !important;
          }

          body.printing-genealogy-tree .genealogy-print-side .print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label={t("genealogy.title", "계보도 보기 탭")}>
          {TABS.map((tab) => {
            const isActive = view === tab.value;

            return (
              <Link
                className={`rounded-md border px-4 py-2 text-sm font-medium ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                }`}
                href={buildHref(searchParams, tab.value)}
                key={tab.value}
              >
                {t(tab.key, tab.fallback)}
              </Link>
            );
          })}
        </nav>

        {printTarget ? (
          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500"
            onClick={() => handlePrint(printTarget)}
            type="button"
          >
            {printTarget === "tree"
              ? t("genealogy.printTree", "계보 트리 인쇄")
              : t("genealogy.printMap", "지역 지도 인쇄")}
          </button>
        ) : null}
      </div>

      <section className="no-print rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-48">
            <label
              className="block text-sm font-medium text-slate-600"
              htmlFor="country-filter"
            >
              {t("genealogy.country", "국가")}
            </label>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              id="country-filter"
              onChange={(event) => updateFilter("countryId", event.target.value)}
              value={data.filters.countryId ?? ""}
            >
              <option value="">{t("common.all", "전체")}</option>
              {countryOptions.map((country) => (
                <option key={country.countryId} value={country.countryId ?? ""}>
                  {country.countryCode
                    ? `${country.countryName} (${country.countryCode})`
                    : country.countryName}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-48">
            <label
              className="block text-sm font-medium text-slate-600"
              htmlFor="church-filter"
            >
              {t("genealogy.church", "교회")}
            </label>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              id="church-filter"
              onChange={(event) => updateFilter("churchId", event.target.value)}
              value={data.filters.churchId ?? ""}
            >
              <option value="">{t("common.all", "전체")}</option>
              {churchOptions.map((church) => (
                <option key={church.churchId} value={church.churchId ?? ""}>
                  {church.churchName}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-40">
            <label
              className="block text-sm font-medium text-slate-600"
              htmlFor="generation-filter"
            >
              {t("genealogy.generation", "세대")}
            </label>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              id="generation-filter"
              onChange={(event) =>
                updateFilter("generationNumber", event.target.value)
              }
              value={data.filters.generationNumber?.toString() ?? ""}
            >
              <option value="">{t("common.all", "전체")}</option>
              {generationOptions.map((generation) => (
                <option
                  key={generation.generationNumber}
                  value={generation.generationNumber ?? ""}
                >
                  {generation.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            onClick={resetFilters}
            type="button"
          >
            {t("genealogy.resetFilters", "필터 초기화")}
          </button>
        </div>
        {!hasFilterOptions ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              {t(
                "genealogy.noFilterOptions",
                "현재 활성 코칭 관계에 연결된 회원 중 국가/교회/세대 정보가 있는 회원이 없습니다. 배정 관리 탭에서 국가/세대가 입력된 회원을 코치 관계에 연결하면 필터 옵션이 표시됩니다.",
              )}
            </p>
            <Link
              className="mt-3 inline-flex rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900"
              href="/admin/coaching-genealogy?view=assign"
            >
              {t("genealogy.goAssign", "배정 관리로 이동")}
            </Link>
          </div>
        ) : null}
      </section>

      {view === "tree" ? (
        data.nodes.length === 0 || data.edges.length === 0 ? (
          <div id="genealogy-tree-print-area">
            <PrintReportHeader
              filterSummary={filterSummary}
              printedAt={printedAt}
              printedAtLabel={t("genealogy.printedAt", "출력일")}
              printedAtPlaceholder={t("genealogy.generatedOnPrint", "인쇄 시 생성")}
              title={t("genealogy.title", "세대별 코칭 계보도")}
            />
            <section className="rounded-md border border-slate-200 bg-white p-8">
              <h2 className="text-xl font-semibold">
                {t("genealogy.tree", "계보 트리")}
              </h2>
              <p className="mt-3 text-slate-600">
                {t("genealogy.noRelationships", "표시할 코칭 관계가 없습니다. 아직 활성 코칭 관계가 없습니다.")}
              </p>
            </section>
          </div>
        ) : (
          <div id="genealogy-tree-print-area">
            <PrintReportHeader
              filterSummary={filterSummary}
              printedAt={printedAt}
              printedAtLabel={t("genealogy.printedAt", "출력일")}
              printedAtPlaceholder={t("genealogy.generatedOnPrint", "인쇄 시 생성")}
              title={t("genealogy.title", "세대별 코칭 계보도")}
            />
            <div className="genealogy-print-content grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="genealogy-print-main min-h-[680px] rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">
                    {t("genealogy.tree", "계보 트리")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {t("genealogy.nodeClickHelp", "노드를 클릭하면 오른쪽 패널에서 상세 정보를 확인할 수 있습니다.")}
                    {" "}
                    {t("genealogy.currentSelection", "현재 선택")}: {getNodeLabel(selectedNode)}
                  </p>
                </div>
                <GenealogyTreeView
                  diagnostics={data.diagnostics}
                  edges={data.edges}
                  filterCountryId={data.filters.countryId}
                  filterGenerationNumber={data.filters.generationNumber}
                  nodes={data.nodes}
                  onSelectNode={selectNode}
                  selectedNodeId={selectedNode?.id ?? null}
                />
              </section>

              <div className="no-print">
                <GenealogyStatsPanel data={data} selectedNode={selectedNode} />
              </div>
              <CompactPrintStatsPanel data={data} selectedNode={selectedNode} />
            </div>
          </div>
        )
      ) : view === "map" ? (
        <div id="genealogy-map-print-area">
          <PrintReportHeader
            filterSummary={filterSummary}
            printedAt={printedAt}
            printedAtLabel={t("genealogy.printedAt", "출력일")}
            printedAtPlaceholder={t("genealogy.generatedOnPrint", "인쇄 시 생성")}
            title={t("genealogy.regionalMap", "지역별 코칭 분포 지도")}
          />
          <GenealogyMapView data={data} />
        </div>
      ) : view === "assign" ? (
        <GenealogyAssignPanel data={data} />
      ) : view === "history" ? (
        <GenerationHistoryPanel data={data} />
      ) : (
        <PlaceholderPanel view={view} />
      )}
    </div>
  );
}
