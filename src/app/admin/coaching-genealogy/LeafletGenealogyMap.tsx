"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { MapMarker } from "@/lib/api/admin/coaching-genealogy";

type VisibleMarker = MapMarker & {
  latitude: number;
  longitude: number;
};

type LeafletGenealogyMapProps = {
  activeGenerationNumber: number | null;
  center: {
    latitude: number;
    longitude: number;
  };
  formatGenerationBreakdown: (items: MapMarker["generationBreakdown"]) => string;
  getMarkerTypeLabel: (markerType: MapMarker["markerType"]) => string;
  markers: VisibleMarker[];
  onSelectMarker: (marker: MapMarker) => void;
  selectedMarkerId: string | null;
  selectedMarkerType: string | null;
};

const GEN_COLORS: Record<number, string> = {
  1: "#534AB7",
  2: "#0F6E56",
  3: "#BA7517",
  4: "#993C1D",
};

function getMarkerRadius(totalMembers: number): number {
  const r = Math.sqrt(Math.max(totalMembers, 1)) * 4;
  return Math.min(Math.max(r, 20), 60);
}

function polarToCartesian(r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: r * Math.cos(rad),
    y: r * Math.sin(rad),
  };
}

function describeArc(r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(r, endAngle);
  const end = polarToCartesian(r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    "M 0 0",
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function normalizeGeneration(generationNumber: number | null) {
  if (generationNumber === 1 || generationNumber === 2 || generationNumber === 3) {
    return generationNumber;
  }

  if (typeof generationNumber === "number" && Number.isFinite(generationNumber)) {
    return 4;
  }

  return null;
}

function getGenerationCounts(marker: MapMarker) {
  const counts: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };

  for (const item of marker.generationBreakdown) {
    const generation = normalizeGeneration(item.generationNumber);

    if (generation) {
      counts[generation] += item.profileCount;
    }
  }

  return counts;
}

function computePieSlices(genCounts: Record<number, number>) {
  const total = [1, 2, 3, 4].reduce(
    (sum, gen) => sum + (genCounts[gen] ?? 0),
    0,
  );

  if (total <= 0) {
    return [];
  }

  let currentAngle = 0;

  return [1, 2, 3, 4]
    .map((generation) => {
      const count = genCounts[generation] ?? 0;

      if (count <= 0) {
        return null;
      }

      const angle = (count / total) * 360;
      const slice = {
        color: GEN_COLORS[generation],
        count,
        endAngle: currentAngle + angle,
        generation,
        startAngle: currentAngle,
        total,
      };

      currentAngle += angle;
      return slice;
    })
    .filter((slice): slice is NonNullable<typeof slice> => Boolean(slice));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getShortMarkerName(marker: MapMarker) {
  const name = marker.name.trim();

  if (name.length <= 12) {
    return name;
  }

  return `${name.slice(0, 11)}…`;
}

function markerHasGeneration(marker: MapMarker, generationNumber: number | null) {
  if (!generationNumber) {
    return true;
  }

  const normalized = normalizeGeneration(generationNumber);

  if (!normalized) {
    return true;
  }

  const counts = getGenerationCounts(marker);

  return counts[normalized] > 0;
}

type PixelOffset = {
  dx: number;
  dy: number;
};

const MARKER_TYPE_ORDER: Record<MapMarker["markerType"], number> = {
  country: 0,
  region: 1,
  church: 2,
};

function getMarkerKey(marker: MapMarker) {
  return `${marker.markerType}-${marker.id ?? marker.name}`;
}

// 같은 좌표에 겹친 마커를 화면상에서 원형으로 펼친다. 실제 좌표는 그대로 두고
// 아이콘 위치만 픽셀 단위로 이동하므로 확대/축소와 무관하게 간격이 유지된다.
function computeSpreadOffsets(markers: VisibleMarker[]) {
  const groups = new Map<string, VisibleMarker[]>();

  for (const marker of markers) {
    const groupKey = `${marker.latitude.toFixed(4)},${marker.longitude.toFixed(4)}`;
    const group = groups.get(groupKey);

    if (group) {
      group.push(marker);
    } else {
      groups.set(groupKey, [marker]);
    }
  }

  const offsets = new Map<string, PixelOffset>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const sorted = [...group].sort(
      (a, b) =>
        MARKER_TYPE_ORDER[a.markerType] - MARKER_TYPE_ORDER[b.markerType] ||
        b.profileCount - a.profileCount,
    );
    const maxRadius = Math.max(
      ...sorted.map((marker) => getMarkerRadius(marker.profileCount)),
    );
    const slotSize = Math.max(maxRadius * 2 + 12, 96);
    const spreadRadius = Math.max(
      slotSize / 2 + 6,
      (sorted.length * slotSize) / (2 * Math.PI),
    );

    sorted.forEach((marker, index) => {
      const angle = (index / sorted.length) * 2 * Math.PI - Math.PI / 2;

      offsets.set(getMarkerKey(marker), {
        dx: Math.round(spreadRadius * Math.cos(angle)),
        dy: Math.round(spreadRadius * Math.sin(angle)),
      });
    });
  }

  return offsets;
}

// 표시 마커가 바뀔 때(필터 변경 등) 모든 마커가 보이도록 지도 범위를 다시 맞춘다.
function FitToMarkers({ markers }: { markers: VisibleMarker[] }) {
  const map = useMap();
  // boundsKey가 같으면 마커 선택 등으로 배열이 새로 만들어져도 다시 맞추지 않는다.
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const boundsKey = markers
    .map((marker) => `${getMarkerKey(marker)}@${marker.latitude},${marker.longitude}`)
    .sort()
    .join("|");

  useEffect(() => {
    const currentMarkers = markersRef.current;

    if (currentMarkers.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      currentMarkers.map((marker) => [marker.latitude, marker.longitude] as [number, number]),
    );

    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getCenter(), 6);
      return;
    }

    map.fitBounds(bounds, { maxZoom: 7, padding: [80, 80] });
  }, [boundsKey, map]);

  return null;
}

function createMarkerIcon({
  activeGenerationNumber,
  marker,
  offset,
  selected,
}: {
  activeGenerationNumber: number | null;
  marker: MapMarker;
  offset: PixelOffset;
  selected: boolean;
}) {
  const counts = getGenerationCounts(marker);
  const slices = computePieSlices(counts);
  const r = getMarkerRadius(marker.profileCount);
  const svgSize = r * 2 + 8;
  const containerWidth = Math.max(svgSize + 16, 92);
  const label = escapeHtml(getShortMarkerName(marker));
  const dimmed = !markerHasGeneration(marker, activeGenerationNumber);
  const opacity = dimmed ? 0.32 : 1;
  const strokeWidth = selected ? 4 : 2;
  const shadow = selected
    ? "0 12px 28px rgba(15,23,42,0.34)"
    : "0 8px 20px rgba(15,23,42,0.22)";
  const sliceMarkup =
    slices.length === 0
      ? `<circle cx="0" cy="0" r="${r}" fill="#cbd5e1" />`
      : slices.length === 1
        ? `<circle cx="0" cy="0" r="${r}" fill="${slices[0].color}" />`
        : slices
            .map(
              (slice) =>
                `<path d="${describeArc(r, slice.startAngle, slice.endAngle)}" fill="${slice.color}" />`,
            )
            .join("");
  const value = marker.profileCount > 99 ? "99+" : marker.profileCount.toString();

  return L.divIcon({
    className: "genealogy-map-marker",
    html: `<div style="
      align-items:center;
      display:flex;
      flex-direction:column;
      opacity:${opacity};
      width:${containerWidth}px;
    ">
      <svg width="${svgSize}" height="${svgSize}" viewBox="${-r - 4} ${-r - 4} ${svgSize} ${svgSize}" style="filter:drop-shadow(${shadow});overflow:visible;">
        <circle cx="1" cy="2" r="${r}" fill="rgba(0,0,0,0.10)" />
        <circle cx="0" cy="0" r="${r}" fill="white" />
        ${sliceMarkup}
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="white" stroke-width="${strokeWidth}" />
        <text x="0" y="4" text-anchor="middle" fill="white" font-size="${Math.max(11, Math.min(18, r / 2.4))}" font-weight="800" paint-order="stroke" stroke="rgba(15,23,42,0.28)" stroke-width="2">${value}</text>
      </svg>
      <div class="genealogy-map-marker-label" style="
        background:rgba(255,255,255,0.86);
        border:1px solid rgba(148,163,184,0.45);
        border-radius:999px;
        color:#0f172a;
        font-size:11px;
        font-weight:700;
        line-height:1;
        margin-top:3px;
        max-width:${containerWidth}px;
        overflow:hidden;
        padding:4px 7px;
        text-align:center;
        text-overflow:ellipsis;
        white-space:nowrap;
      ">${label}</div>
    </div>`,
    iconAnchor: [containerWidth / 2 - offset.dx, svgSize / 2 - offset.dy],
    iconSize: [containerWidth, svgSize + 24],
    popupAnchor: [offset.dx, offset.dy - svgSize / 2],
    tooltipAnchor: [offset.dx, offset.dy - svgSize / 2],
  });
}

export function LeafletGenealogyMap({
  activeGenerationNumber,
  center,
  formatGenerationBreakdown,
  getMarkerTypeLabel,
  markers,
  onSelectMarker,
  selectedMarkerId,
  selectedMarkerType,
}: LeafletGenealogyMapProps) {
  const spreadOffsets = useMemo(() => computeSpreadOffsets(markers), [markers]);

  return (
    <div className="genealogy-map-panel relative h-[620px] overflow-hidden rounded-2xl border border-line-base bg-gradient-to-br from-blue-100 via-blue-200 to-emerald-100">
      <style>{`
        .genealogy-map-panel .leaflet-container {
          background: linear-gradient(160deg, #dbeafe 0%, #bfdbfe 35%, #a7f3d0 70%, #d1fae5 100%);
        }

        .genealogy-map-panel .leaflet-tile {
          filter: saturate(0.78) contrast(0.92) brightness(1.05);
          opacity: 0.78 !important;
        }

        .genealogy-map-marker {
          background: transparent !important;
          border: 0 !important;
        }
      `}</style>
      <MapContainer
        center={[center.latitude, center.longitude]}
        className="genealogy-map-print-panel h-full w-full"
        scrollWheelZoom
        zoom={markers.length > 0 ? 5 : 4}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarkers markers={markers} />
        {markers.map((marker) => {
          const selected =
            marker.id === selectedMarkerId &&
            marker.markerType === selectedMarkerType;

          return (
          <Marker
            eventHandlers={{
              click: () => onSelectMarker(marker),
            }}
            icon={createMarkerIcon({
              activeGenerationNumber,
              marker,
              offset: spreadOffsets.get(getMarkerKey(marker)) ?? { dx: 0, dy: 0 },
              selected,
            })}
            key={getMarkerKey(marker)}
            position={[marker.latitude, marker.longitude]}
            zIndexOffset={selected ? 1000 : 0}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              {marker.name}
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{marker.name}</p>
                <p>구분: {getMarkerTypeLabel(marker.markerType)}</p>
                <p>코치: {marker.coachCount}명</p>
                <p>코치이: {marker.coacheeCount}명</p>
                <p>관계: {marker.relationshipCount}개</p>
                <p>{formatGenerationBreakdown(marker.generationBreakdown)}</p>
              </div>
            </Popup>
          </Marker>
          );
        })}
      </MapContainer>
      <div className="genealogy-map-legend pointer-events-none absolute bottom-4 left-4 z-[500] rounded-xl border border-white/70 bg-surface-card/85 px-3 py-2 text-xs text-ink-base shadow-sm backdrop-blur">
        <p className="mb-1 font-semibold text-ink-strong">파이 = 세대 비율</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((generation) => (
            <span className="inline-flex items-center gap-1" key={generation}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: GEN_COLORS[generation] }}
              />
              G{generation}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
