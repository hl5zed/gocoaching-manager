"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from "react-leaflet";
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

function createMarkerIcon({
  activeGenerationNumber,
  marker,
  selected,
}: {
  activeGenerationNumber: number | null;
  marker: MapMarker;
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
    iconAnchor: [containerWidth / 2, svgSize / 2],
    iconSize: [containerWidth, svgSize + 24],
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
  return (
    <div className="genealogy-map-panel relative h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-100 via-blue-200 to-emerald-100">
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker) => (
          <Marker
            eventHandlers={{
              click: () => onSelectMarker(marker),
            }}
            icon={createMarkerIcon({
              activeGenerationNumber,
              marker,
              selected:
                marker.id === selectedMarkerId &&
                marker.markerType === selectedMarkerType,
            })}
            key={`${marker.markerType}-${marker.id ?? marker.name}`}
            position={[marker.latitude, marker.longitude]}
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
        ))}
      </MapContainer>
      <div className="genealogy-map-legend pointer-events-none absolute bottom-4 left-4 z-[500] rounded-xl border border-white/70 bg-white/85 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
        <p className="mb-1 font-semibold text-slate-900">파이 = 세대 비율</p>
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
