"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CoachingGenealogyData,
  GenerationBreakdownItem,
  MapMarker,
} from "@/lib/api/admin/coaching-genealogy";

type GenealogyMapViewProps = {
  data: CoachingGenealogyData;
};

type MarkerTypeFilter = "all" | "country" | "region" | "church";

type VisibleMarker = MapMarker & {
  latitude: number;
  longitude: number;
};

const LeafletGenealogyMap = dynamic(
  () =>
    import("./LeafletGenealogyMap").then(
      (module) => module.LeafletGenealogyMap,
    ),
  {
    loading: () => (
      <div className="flex h-[620px] items-center justify-center rounded-md border border-line-base bg-surface-sunken text-sm text-ink-muted">
        지도를 불러오는 중입니다.
      </div>
    ),
    ssr: false,
  },
);

const FALLBACK_CENTER = {
  latitude: 15.87,
  longitude: 100.9925,
};

const COUNTRY_COORDINATES: Record<string, { latitude: number; longitude: number }> =
  {
    AU: { latitude: -25.2744, longitude: 133.7751 },
    CA: { latitude: 56.1304, longitude: -106.3468 },
    CN: { latitude: 35.8617, longitude: 104.1954 },
    DE: { latitude: 51.1657, longitude: 10.4515 },
    FR: { latitude: 46.2276, longitude: 2.2137 },
    GB: { latitude: 55.3781, longitude: -3.436 },
    ID: { latitude: -0.7893, longitude: 113.9213 },
    IN: { latitude: 20.5937, longitude: 78.9629 },
    JP: { latitude: 36.2048, longitude: 138.2529 },
    KH: { latitude: 12.5657, longitude: 104.991 },
    KR: { latitude: 35.9078, longitude: 127.7669 },
    LA: { latitude: 19.8563, longitude: 102.4955 },
    MM: { latitude: 21.9162, longitude: 95.956 },
    MY: { latitude: 4.2105, longitude: 101.9758 },
    NZ: { latitude: -40.9006, longitude: 174.886 },
    PH: { latitude: 12.8797, longitude: 121.774 },
    SG: { latitude: 1.3521, longitude: 103.8198 },
    TH: { latitude: 15.87, longitude: 100.9925 },
    US: { latitude: 37.0902, longitude: -95.7129 },
    VN: { latitude: 14.0583, longitude: 108.2772 },
  };

function getMarkerTypeLabel(markerType: MapMarker["markerType"]) {
  if (markerType === "country") {
    return "국가";
  }

  if (markerType === "region") {
    return "지역";
  }

  return "교회";
}

function formatGenerationBreakdown(items: GenerationBreakdownItem[]) {
  return items.length > 0
    ? items.map((item) => `${item.label} ${item.profileCount}명`).join(" / ")
    : "세대 정보 없음";
}

function resolveCoordinates(marker: MapMarker) {
  if (
    typeof marker.latitude === "number" &&
    Number.isFinite(marker.latitude) &&
    typeof marker.longitude === "number" &&
    Number.isFinite(marker.longitude)
  ) {
    return {
      latitude: marker.latitude,
      longitude: marker.longitude,
    };
  }

  return marker.code ? COUNTRY_COORDINATES[marker.code] ?? null : null;
}

function getVisibleMarkers(
  markers: MapMarker[],
  markerType: MarkerTypeFilter,
): VisibleMarker[] {
  return markers
    .filter((marker) => markerType === "all" || marker.markerType === markerType)
    .flatMap((marker) => {
      const coordinates = resolveCoordinates(marker);

      if (!coordinates) {
        return [];
      }

      return [
        {
          ...marker,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      ];
    });
}

function getCenter(markers: VisibleMarker[]) {
  if (markers.length === 0) {
    return FALLBACK_CENTER;
  }

  const totals = markers.reduce(
    (acc, marker) => ({
      latitude: acc.latitude + marker.latitude,
      longitude: acc.longitude + marker.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: totals.latitude / markers.length,
    longitude: totals.longitude / markers.length,
  };
}

function buildTreeHref(searchParams: URLSearchParams, marker: MapMarker | null) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", "tree");
  params.delete("selectedMarkerId");
  params.delete("selectedMarkerType");

  if (marker?.id && marker.markerType === "country") {
    params.set("countryId", marker.id);
  }

  if (marker?.id && marker.markerType === "region") {
    params.set("regionId", marker.id);
  }

  if (marker?.id && marker.markerType === "church") {
    params.set("churchId", marker.id);
  }

  return `/admin/coaching-genealogy?${params.toString()}`;
}

function MarkerDetail({
  marker,
  searchParams,
}: {
  marker: MapMarker | null;
  searchParams: URLSearchParams;
}) {
  if (!marker) {
    return (
      <div className="rounded-card border border-line-base bg-surface-card p-5">
        <h2 className="text-lg font-semibold">선택 지역</h2>
        <p className="mt-3 text-sm text-ink-muted">
          지도 마커를 선택하면 지역별 상세 통계가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line-base bg-surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-faint">
            {getMarkerTypeLabel(marker.markerType)}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{marker.name}</h2>
        </div>
        <span className="rounded-full border border-line-base bg-surface-app px-2.5 py-1 text-xs font-medium text-ink-muted">
          {marker.code ?? "코드 없음"}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-faint">전체 프로필 수</dt>
          <dd className="font-medium">{marker.profileCount}명</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-faint">코치 수</dt>
          <dd className="font-medium">{marker.coachCount}명</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-faint">코치이 수</dt>
          <dd className="font-medium">{marker.coacheeCount}명</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-faint">활성 관계 수</dt>
          <dd className="font-medium">{marker.relationshipCount}개</dd>
        </div>
      </dl>

      <p className="mt-4 rounded-md bg-surface-app p-3 text-sm text-ink-muted">
        {formatGenerationBreakdown(marker.generationBreakdown)}
      </p>

      <Link
        className="mt-4 inline-flex rounded-control bg-navy-900 px-4 py-2 text-sm font-medium text-white"
        href={buildTreeHref(searchParams, marker)}
      >
        트리로 보기
      </Link>
    </div>
  );
}

export function GenealogyMapView({ data }: GenealogyMapViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const markerType = (searchParams.get("markerType") ??
    "all") as MarkerTypeFilter;
  const selectedMarkerId = searchParams.get("selectedMarkerId");
  const selectedMarkerType = searchParams.get("selectedMarkerType");
  const markerTypeFilteredMarkers = useMemo(
    () =>
      data.mapMarkers.filter(
        (marker) => markerType === "all" || marker.markerType === markerType,
      ),
    [data.mapMarkers, markerType],
  );
  const visibleMarkers = useMemo(
    () => getVisibleMarkers(data.mapMarkers, markerType),
    [data.mapMarkers, markerType],
  );
  const selectedMarker =
    data.mapMarkers.find(
      (marker) =>
        marker.id === selectedMarkerId &&
        marker.markerType === selectedMarkerType,
    ) ?? null;
  const center = getCenter(visibleMarkers);
  const markerTypeLabel =
    markerType === "all" ? "전체" : getMarkerTypeLabel(markerType);
  const coordinateMissingCount = markerTypeFilteredMarkers.filter(
    (marker) => !resolveCoordinates(marker),
  ).length;

  function updateMapFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("view", "map");
    params.delete("selectedMarkerId");
    params.delete("selectedMarkerType");
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectMarker(marker: MapMarker) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "map");
    params.set("selectedMarkerId", marker.id ?? "");
    params.set("selectedMarkerType", marker.markerType);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="genealogy-map-print-layout grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="map-screen-map-section rounded-card border border-line-base bg-surface-card p-5">
        <div className="map-screen-filter mb-5 flex flex-wrap items-end gap-4">
          <div className="min-w-44">
            <label
              className="block text-sm font-medium text-ink-muted"
              htmlFor="marker-type-filter"
            >
              마커 표시 기준
            </label>
            <select
              className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm"
              id="marker-type-filter"
              onChange={(event) =>
                updateMapFilter("markerType", event.target.value)
              }
              value={markerType}
            >
              <option value="all">전체</option>
              <option value="country">국가</option>
              <option value="region">지역</option>
              <option value="church">교회</option>
            </select>
          </div>
        </div>

        {data.mapMarkers.length === 0 ? (
          <div className="rounded-md border border-line-base bg-surface-app p-8 text-ink-muted">
            지도에 표시할 코칭 지역 데이터가 없습니다.
          </div>
        ) : (
          <>
            <LeafletGenealogyMap
              activeGenerationNumber={data.filters.generationNumber}
              center={center}
              formatGenerationBreakdown={formatGenerationBreakdown}
              getMarkerTypeLabel={getMarkerTypeLabel}
              markers={visibleMarkers}
              onSelectMarker={selectMarker}
              selectedMarkerId={selectedMarkerId}
              selectedMarkerType={selectedMarkerType}
            />
            {coordinateMissingCount > 0 ? (
              <p className="genealogy-map-coordinate-warning no-print mt-2 text-xs text-ink-faint">
                좌표 미등록 {coordinateMissingCount}개 항목은 지도에 표시되지 않습니다.
              </p>
            ) : null}
          </>
        )}
      </section>

      <aside className="map-screen-aside space-y-5">
        <MarkerDetail marker={selectedMarker} searchParams={searchParams} />

        <section className="rounded-card border border-line-base bg-surface-card p-5">
          <h2 className="text-lg font-semibold">지도 전체 현황</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-line-base bg-surface-app p-3">
              <p className="text-ink-faint">전체 코치</p>
              <p className="mt-1 text-xl font-semibold">
                {data.summaryStats.totalCoaches}
              </p>
            </div>
            <div className="rounded-md border border-line-base bg-surface-app p-3">
              <p className="text-ink-faint">전체 코치이</p>
              <p className="mt-1 text-xl font-semibold">
                {data.summaryStats.totalCoachees}
              </p>
            </div>
            <div className="rounded-md border border-line-base bg-surface-app p-3">
              <p className="text-ink-faint">활성 관계</p>
              <p className="mt-1 text-xl font-semibold">
                {data.summaryStats.totalActiveRelationships}
              </p>
            </div>
            <div className="rounded-md border border-line-base bg-surface-app p-3">
              <p className="text-ink-faint">활동 국가</p>
              <p className="mt-1 text-xl font-semibold">
                {data.summaryStats.totalCountries}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-line-base bg-surface-card p-5">
          <h2 className="text-lg font-semibold">세대별 분포</h2>
          <div className="mt-3 space-y-2 text-sm text-ink-base">
            {data.generationStats.length > 0 ? (
              data.generationStats.map((generation) => (
                <div
                  className="flex justify-between gap-3"
                  key={generation.generationNumber ?? "missing"}
                >
                  <span>{generation.label}</span>
                  <span className="font-medium">{generation.profileCount}명</span>
                </div>
              ))
            ) : (
              <p className="text-ink-muted">세대 통계가 없습니다.</p>
            )}
          </div>
        </section>
      </aside>

      <section className="map-print-summary print-only">
        <div>
          <h2>지역 지도 요약</h2>
          <dl>
            <div>
              <dt>마커 표시 기준</dt>
              <dd>{markerTypeLabel}</dd>
            </div>
            <div>
              <dt>표시 마커</dt>
              <dd>{visibleMarkers.length}개</dd>
            </div>
            <div>
              <dt>전체 노드</dt>
              <dd>{data.nodes.length}명</dd>
            </div>
            <div>
              <dt>국가</dt>
              <dd>{data.summaryStats.totalCountries}개</dd>
            </div>
            <div>
              <dt>교회</dt>
              <dd>{data.summaryStats.totalChurches}개</dd>
            </div>
            <div>
              <dt>세대</dt>
              <dd>
                {
                  data.generationStats.filter(
                    (generation) => generation.generationNumber !== null,
                  ).length
                }
                개
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2>선택 지역</h2>
          {selectedMarker ? (
            <dl>
              <div>
                <dt>이름</dt>
                <dd>{selectedMarker.name}</dd>
              </div>
              <div>
                <dt>구분</dt>
                <dd>{getMarkerTypeLabel(selectedMarker.markerType)}</dd>
              </div>
              <div>
                <dt>프로필</dt>
                <dd>{selectedMarker.profileCount}명</dd>
              </div>
              <div>
                <dt>코치/코치이</dt>
                <dd>
                  {selectedMarker.coachCount}명 / {selectedMarker.coacheeCount}명
                </dd>
              </div>
              <div>
                <dt>관계</dt>
                <dd>{selectedMarker.relationshipCount}개</dd>
              </div>
            </dl>
          ) : (
            <p>선택된 지역이 없습니다.</p>
          )}
        </div>

        <div>
          <h2>세대 분포</h2>
          {data.generationStats.length > 0 ? (
            <ul>
              {data.generationStats.slice(0, 6).map((generation) => (
                <li key={generation.generationNumber ?? "missing"}>
                  <span>{generation.label}</span>
                  <strong>{generation.profileCount}명</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>세대 통계가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
