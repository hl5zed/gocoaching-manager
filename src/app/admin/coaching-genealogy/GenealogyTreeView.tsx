"use client";

import { useMemo, type KeyboardEvent } from "react";
import type {
  GenealogyDiagnostics,
  GenealogyEdge,
  GenealogyNode,
} from "@/lib/api/admin/coaching-genealogy";

type GenealogyTreeViewProps = {
  diagnostics: GenealogyDiagnostics;
  edges: GenealogyEdge[];
  filterCountryId?: string | null;
  filterGenerationNumber?: number | null;
  relationshipStatus?: string | null;
  nodes: GenealogyNode[];
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
};

type GenerationKey = 1 | 2 | 3 | 4;

type PyramidLayoutNode = {
  generation: GenerationKey;
  height: number;
  node: GenealogyNode;
  unknown: boolean;
  width: number;
  x: number;
  y: number;
};

type NodeColors = {
  fill: string;
  stroke: string;
  sub: string;
  text: string;
  title: string;
};

// 세대 값이 없는 회원은 G4 층에 배치하되 회색으로 구분하고 별도로 집계한다.
const UNKNOWN_COLORS: NodeColors = {
  fill: "#F1F5F9",
  stroke: "#64748B",
  sub: "#64748B",
  text: "#475569",
  title: "#1E293B",
};

const GENERATIONS: GenerationKey[] = [1, 2, 3, 4];

const GEN_COLORS: Record<GenerationKey, NodeColors> = {
  1: {
    fill: "#EEEDFE",
    stroke: "#534AB7",
    sub: "#534AB7",
    text: "#3C3489",
    title: "#26215C",
  },
  2: {
    fill: "#E1F5EE",
    stroke: "#0F6E56",
    sub: "#0F6E56",
    text: "#085041",
    title: "#04342C",
  },
  3: {
    fill: "#FAEEDA",
    stroke: "#BA7517",
    sub: "#BA7517",
    text: "#633806",
    title: "#412402",
  },
  4: {
    fill: "#FAECE7",
    stroke: "#993C1D",
    sub: "#993C1D",
    text: "#712B13",
    title: "#4A1B0C",
  },
};

const GEN_NODE_SIZE: Record<GenerationKey, { height: number; width: number }> = {
  1: { height: 42, width: 86 },
  2: { height: 38, width: 84 },
  3: { height: 34, width: 74 },
  4: { height: 28, width: 50 },
};

const GEN_Y: Record<GenerationKey, number> = {
  1: 20,
  2: 78,
  3: 134,
  4: 200,
};

const GEN_BOUNDS: Record<GenerationKey, { left: number; right: number }> = {
  1: { left: 195, right: 305 },
  2: { left: 160, right: 340 },
  3: { left: 115, right: 385 },
  4: { left: 80, right: 420 },
};

const GEN_LABEL_Y: Record<GenerationKey, number> = {
  1: 48,
  2: 106,
  3: 166,
  4: 232,
};

const PYRAMID_BACKGROUNDS: Array<{
  fill: string;
  generation: GenerationKey;
  points: string;
}> = [
  { fill: "#EEEDFE", generation: 1, points: "250,18 305,68 195,68" },
  { fill: "#E1F5EE", generation: 2, points: "195,74 305,74 340,124 160,124" },
  { fill: "#FAEEDA", generation: 3, points: "160,130 340,130 385,190 115,190" },
  { fill: "#FAECE7", generation: 4, points: "115,196 385,196 420,260 80,260" },
];

function layoutGeneration(generationNumber: number | null): GenerationKey {
  if (generationNumber === 1 || generationNumber === 2 || generationNumber === 3) {
    return generationNumber;
  }

  return 4;
}

function generationLabel(generationNumber: number | null) {
  return typeof generationNumber === "number" && Number.isFinite(generationNumber)
    ? `G${generationNumber}`
    : "G?";
}

function hasKnownGeneration(generationNumber: number | null) {
  return typeof generationNumber === "number" && Number.isFinite(generationNumber);
}

function generationName(generation: GenerationKey, hasG5Plus = false) {
  if (generation === 1) {
    return "G1 루트코치";
  }

  return generation === 4 && hasG5Plus ? "G4 이상" : `G${generation}`;
}

function statusLabel(status: string | null | undefined) {
  if (status === "paused") {
    return "일시중지";
  }

  if (status === "ended") {
    return "종료";
  }

  if (status === "archived") {
    return "보관";
  }

  return "활성";
}

function roleSummary(node: GenealogyNode) {
  return node.ministryPosition ?? node.primaryRole ?? "역할 미지정";
}

function locationSummary(node: GenealogyNode) {
  const country = node.countryCode ?? node.countryName;
  const place = node.churchName ?? node.organizationName;
  const summary = [country, place].filter(Boolean).join(" ");

  return summary.length > 0 ? summary : "지역 미지정";
}

function truncateText(value: string, width: number) {
  const maxLength = Math.max(4, Math.floor(width / 7));

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
}

function computePyramidLayout(nodes: GenealogyNode[]) {
  const grouped = new Map<GenerationKey, GenealogyNode[]>();
  const counts: Record<GenerationKey, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  const layoutMap = new Map<string, PyramidLayoutNode>();
  let unknownCount = 0;
  let hasG5Plus = false;

  for (const generation of GENERATIONS) {
    grouped.set(generation, []);
  }

  for (const node of nodes) {
    const generation = layoutGeneration(node.generationNumber);
    grouped.get(generation)?.push(node);

    if (hasKnownGeneration(node.generationNumber)) {
      counts[generation] += 1;
      hasG5Plus = hasG5Plus || (node.generationNumber ?? 0) >= 5;
    } else {
      unknownCount += 1;
    }
  }

  for (const generation of GENERATIONS) {
    const siblings = (grouped.get(generation) ?? []).sort((a, b) =>
      a.label.localeCompare(b.label, "ko"),
    );
    const bounds = GEN_BOUNDS[generation];
    const size = GEN_NODE_SIZE[generation];
    const span = bounds.right - bounds.left;

    siblings.forEach((node, index) => {
      const centerX =
        generation === 1 && siblings.length === 1
          ? 250
          : bounds.left + (span / (siblings.length + 1)) * (index + 1);

      layoutMap.set(node.id, {
        generation,
        height: size.height,
        node,
        unknown: !hasKnownGeneration(node.generationNumber),
        width: size.width,
        x: centerX - size.width / 2,
        y: GEN_Y[generation],
      });
    });
  }

  return { counts, hasG5Plus, layoutMap, unknownCount };
}

function buildHighlightedPath(selectedNodeId: string | null, edges: GenealogyEdge[]) {
  const highlightedEdgeIds = new Set<string>();
  const highlightedNodeIds = new Set<string>();
  const incomingEdges = new Map<string, GenealogyEdge[]>();

  for (const edge of edges) {
    const existing = incomingEdges.get(edge.target) ?? [];
    existing.push(edge);
    incomingEdges.set(edge.target, existing);
  }

  function visit(nodeId: string) {
    if (highlightedNodeIds.has(nodeId)) {
      return;
    }

    highlightedNodeIds.add(nodeId);

    for (const edge of incomingEdges.get(nodeId) ?? []) {
      highlightedEdgeIds.add(edge.id);
      visit(edge.source);
    }
  }

  if (selectedNodeId) {
    visit(selectedNodeId);
  }

  return { highlightedEdgeIds, highlightedNodeIds };
}

function nodeMatchesFilters({
  filterCountryId,
  filterGenerationNumber,
  node,
}: {
  filterCountryId?: string | null;
  filterGenerationNumber?: number | null;
  node: GenealogyNode;
}) {
  if (filterCountryId && node.countryId !== filterCountryId) {
    return false;
  }

  if (
    typeof filterGenerationNumber === "number" &&
    node.generationNumber !== filterGenerationNumber
  ) {
    return false;
  }

  return true;
}

function PyramidNode({
  dimmed,
  highlighted,
  layout,
  onSelectNode,
  selected,
}: {
  dimmed: boolean;
  highlighted: boolean;
  layout: PyramidLayoutNode;
  onSelectNode: (nodeId: string) => void;
  selected: boolean;
}) {
  const { generation, height, node, unknown, width, x, y } = layout;
  const colors = unknown ? UNKNOWN_COLORS : GEN_COLORS[generation];
  const opacity = highlighted || selected ? 1 : dimmed ? 0.28 : 0.92;
  // G3(높이 34)는 두 번째 줄과 세 번째 줄이 겹치므로 G1·G2에서만 표시한다.
  const canShowThirdLine = height >= 38;
  const titleSize = generation === 4 ? 6.7 : 7.8;
  const subSize = generation === 4 ? 5.8 : 6.4;

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectNode(node.id);
    }
  }

  return (
    <g
      aria-label={`${node.label} ${generationLabel(node.generationNumber)}`}
      className="cursor-pointer outline-none"
      onClick={() => onSelectNode(node.id)}
      onKeyDown={handleKeyDown}
      opacity={opacity}
      role="button"
      tabIndex={0}
      transform={`translate(${x} ${y})`}
    >
      <rect
        fill={colors.fill}
        height={height}
        rx={generation === 4 ? 7 : 9}
        stroke={selected || highlighted ? colors.stroke : colors.sub}
        strokeWidth={selected ? 2.6 : highlighted ? 2 : 1.1}
        width={width}
      />
      <text
        fill={colors.title}
        fontSize={titleSize}
        fontWeight={600}
        pointerEvents="none"
        textAnchor="middle"
        x={width / 2}
        y={generation === 4 ? 11 : 13}
      >
        {truncateText(node.label, width)}
      </text>
      <text
        fill={colors.sub}
        fontSize={subSize}
        pointerEvents="none"
        textAnchor="middle"
        x={width / 2}
        y={generation === 4 ? 22 : 25}
      >
        {truncateText(`${generationLabel(node.generationNumber)} · ${locationSummary(node)}`, width)}
      </text>
      {canShowThirdLine ? (
        <text
          fill={colors.text}
          fontSize={6}
          pointerEvents="none"
          textAnchor="middle"
          x={width / 2}
          y={height - 6}
        >
          {truncateText(`코치이 ${node.activeCoacheeCount}명`, width)}
        </text>
      ) : null}
    </g>
  );
}

function GenerationStackedBar({
  counts,
  hasG5Plus,
  unknownCount,
}: {
  counts: Record<GenerationKey, number>;
  hasG5Plus: boolean;
  unknownCount: number;
}) {
  const total =
    GENERATIONS.reduce((sum, generation) => sum + counts[generation], 0) +
    unknownCount;
  const unknownWidth = total > 0 ? (340 * unknownCount) / total : 0;
  const legendSpacing = unknownCount > 0 ? 72 : 92;
  let currentX = 80;

  return (
    <g>
      <rect fill="#f8fafc" height={32} rx={6} stroke="#d4d4d8" width={340} x={80} y={274} />
      {GENERATIONS.map((generation) => {
        const width = total > 0 ? (340 * counts[generation]) / total : 0;
        const segment = (
          <rect
            fill={GEN_COLORS[generation].stroke}
            height={32}
            key={generation}
            opacity={width > 0 ? 0.86 : 0}
            width={Math.max(0, width)}
            x={currentX}
            y={274}
          />
        );
        currentX += width;
        return segment;
      })}
      {unknownWidth > 0 ? (
        <rect
          fill={UNKNOWN_COLORS.stroke}
          height={32}
          opacity={0.6}
          width={unknownWidth}
          x={80 + 340 - unknownWidth}
          y={274}
        />
      ) : null}
      <text fill="#475569" fontSize={7.5} fontWeight={600} textAnchor="middle" x={250} y={295}>
        세대별 인원 비율
      </text>
      <g transform="translate(86 322)">
        {GENERATIONS.map((generation, index) => (
          <g key={generation} transform={`translate(${index * legendSpacing} 0)`}>
            <rect
              fill={GEN_COLORS[generation].stroke}
              height={7}
              rx={2}
              width={14}
              x={0}
              y={-6}
            />
            <text fill="#475569" fontSize={7} x={18} y={0}>
              {generationName(generation, hasG5Plus)} {counts[generation]}명
            </text>
          </g>
        ))}
        {unknownCount > 0 ? (
          <g transform={`translate(${GENERATIONS.length * legendSpacing} 0)`}>
            <rect
              fill={UNKNOWN_COLORS.stroke}
              height={7}
              opacity={0.6}
              rx={2}
              width={14}
              x={0}
              y={-6}
            />
            <text fill="#475569" fontSize={7} x={18} y={0}>
              미지정 {unknownCount}명
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

export function GenealogyTreeView({
  diagnostics,
  edges,
  filterCountryId,
  filterGenerationNumber,
  relationshipStatus,
  nodes,
  onSelectNode,
  selectedNodeId,
}: GenealogyTreeViewProps) {
  const { counts, hasG5Plus, layoutMap, unknownCount } = useMemo(
    () => computePyramidLayout(nodes),
    [nodes],
  );
  const { highlightedEdgeIds, highlightedNodeIds } = useMemo(
    () => buildHighlightedPath(selectedNodeId, edges),
    [edges, selectedNodeId],
  );
  const hasActiveFilter = Boolean(filterCountryId) || filterGenerationNumber !== null;
  const mismatchWarnings = diagnostics.generationMismatchWarnings;
  const visibleMismatchWarnings = mismatchWarnings.slice(0, 5);
  const hiddenMismatchCount = Math.max(0, mismatchWarnings.length - visibleMismatchWarnings.length);
  const isNonActiveStatus = relationshipStatus ? relationshipStatus !== "active" : false;

  return (
    <div className="space-y-4">
      {(diagnostics.circularRelationships.length > 0 ||
        diagnostics.generationMismatchWarnings.length > 0) && (
        <div className="space-y-2">
          {diagnostics.circularRelationships.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              순환 관계가 감지되었습니다. 배정 관계를 확인하세요.
            </div>
          )}
          {mismatchWarnings.length > 0 && (
            <div className="rounded-control border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    세대 불일치 {mismatchWarnings.length}건이 있습니다.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    코치 세대 + 1이 코치이 세대와 맞지 않는 관계입니다.
                    {isNonActiveStatus
                      ? ` 현재 선택한 관계 상태(${statusLabel(relationshipStatus)}) 기준으로 확인했습니다.`
                      : null}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  세대 배정 관리에서 수동 확인
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {visibleMismatchWarnings.map((warning) => (
                  <li
                    className="rounded-control border border-amber-200 bg-surface-card/70 px-3 py-2 text-xs leading-5 text-amber-950"
                    key={warning.relationshipId}
                  >
                    <span className="font-semibold">
                      {warning.coachLabel || "확인 필요"}
                    </span>
                    <span> {generationLabel(warning.coachGenerationNumber)} → </span>
                    <span className="font-semibold">
                      {warning.coacheeLabel || "확인 필요"}
                    </span>
                    <span> {generationLabel(warning.coacheeGenerationNumber)}</span>
                    <span className="ml-2 text-amber-800">
                      기대 세대: {generationLabel(warning.expectedCoacheeGenerationNumber)}
                    </span>
                  </li>
                ))}
              </ul>
              {hiddenMismatchCount > 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  외 {hiddenMismatchCount}건은 세대 배정 관리에서 함께 확인하세요.
                </p>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-amber-800">
                자동 수정하지 않고, 세대 배정 관리에서 관계와 세대 값을 확인한 뒤
                필요한 경우 수동으로 조정하세요.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="genealogy-tree-svg-shell overflow-x-auto rounded-md border border-line-base bg-surface-sunken">
        <svg
          aria-label="피라미드형 세대별 코칭 계보도"
          className="genealogy-tree-svg min-w-[640px]"
          role="img"
          viewBox="0 0 500 420"
          width="100%"
        >
          <defs>
            {GENERATIONS.map((generation) => (
              <marker
                id={`pyramid-arr-${generation}`}
                key={generation}
                markerHeight="6"
                markerWidth="6"
                orient="auto"
                refX="5"
                refY="3"
                viewBox="0 0 6 6"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill={GEN_COLORS[generation].stroke} />
              </marker>
            ))}
            <marker
              id="pyramid-arr-unknown"
              markerHeight="6"
              markerWidth="6"
              orient="auto"
              refX="5"
              refY="3"
              viewBox="0 0 6 6"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={UNKNOWN_COLORS.stroke} />
            </marker>
          </defs>

          <rect fill="#ffffff" height="420" width="500" x="0" y="0" />

          {PYRAMID_BACKGROUNDS.map((background) => (
            <polygon
              fill={background.fill}
              key={background.generation}
              opacity={0.55}
              points={background.points}
            />
          ))}
          <polygon
            fill="none"
            points="250,18 420,260 80,260"
            stroke="#d4d4d8"
            strokeDasharray="4 3"
            strokeWidth={0.8}
          />

          {GENERATIONS.map((generation) => (
            <g key={generation}>
              <text
                fill={GEN_COLORS[generation].stroke}
                fontSize={9}
                fontWeight={700}
                textAnchor="end"
                x={68}
                y={GEN_LABEL_Y[generation]}
              >
                {generationName(generation, hasG5Plus)}
              </text>
              <text
                fill={GEN_COLORS[generation].sub}
                fontSize={8}
                fontWeight={600}
                textAnchor="start"
                x={432}
                y={GEN_LABEL_Y[generation]}
              >
                {counts[generation]}명
              </text>
            </g>
          ))}
          {unknownCount > 0 ? (
            <text
              fill={UNKNOWN_COLORS.sub}
              fontSize={7}
              fontWeight={600}
              textAnchor="start"
              x={432}
              y={GEN_LABEL_Y[4] + 11}
            >
              미지정 {unknownCount}명
            </text>
          ) : null}

          <g>
            {edges.map((edge) => {
              const source = layoutMap.get(edge.source);
              const target = layoutMap.get(edge.target);

              if (!source || !target) {
                return null;
              }

              const isHighlighted = highlightedEdgeIds.has(edge.id);
              const sourceMatches = nodeMatchesFilters({
                filterCountryId,
                filterGenerationNumber,
                node: source.node,
              });
              const targetMatches = nodeMatchesFilters({
                filterCountryId,
                filterGenerationNumber,
                node: target.node,
              });
              const dimmed = hasActiveFilter && (!sourceMatches || !targetMatches);
              const active = edge.status === "active";
              const markerId = source.unknown ? "unknown" : source.generation;
              const strokeColor = source.unknown
                ? UNKNOWN_COLORS.stroke
                : GEN_COLORS[source.generation].stroke;
              const opacity = isHighlighted ? 1 : dimmed ? 0.12 : active ? 0.54 : 0.25;

              return (
                <line
                  key={edge.id}
                  markerEnd={`url(#pyramid-arr-${markerId})`}
                  opacity={opacity}
                  stroke={strokeColor}
                  strokeDasharray={active ? undefined : "4 3"}
                  strokeWidth={isHighlighted ? 1.9 : 1.1}
                  x1={source.x + source.width / 2}
                  x2={target.x + target.width / 2}
                  y1={source.y + source.height}
                  y2={target.y}
                />
              );
            })}
          </g>

          <g>
            {Array.from(layoutMap.values()).map((layout) => {
              const selected = layout.node.id === selectedNodeId;
              const highlighted = highlightedNodeIds.has(layout.node.id);
              const dimmed =
                hasActiveFilter &&
                !nodeMatchesFilters({
                  filterCountryId,
                  filterGenerationNumber,
                  node: layout.node,
                }) &&
                !highlighted;

              return (
                <PyramidNode
                  dimmed={dimmed}
                  highlighted={highlighted}
                  key={layout.node.id}
                  layout={layout}
                  onSelectNode={onSelectNode}
                  selected={selected}
                />
              );
            })}
          </g>

          <GenerationStackedBar
            counts={counts}
            hasG5Plus={hasG5Plus}
            unknownCount={unknownCount}
          />

          <text fill="#64748b" fontSize={8} textAnchor="middle" x={250} y={366}>
            노드를 선택하면 오른쪽 상세 패널에서 소속, 역할, 담당 관계를 확인할 수 있습니다.
          </text>
        </svg>
      </div>
    </div>
  );
}
