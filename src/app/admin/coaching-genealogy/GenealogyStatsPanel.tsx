import type {
  ChurchStat,
  CoachingGenealogyData,
  CountryStat,
  GenealogyNode,
  GenerationStat,
} from "@/lib/api/admin/coaching-genealogy";

type GenealogyStatsPanelProps = {
  data: CoachingGenealogyData;
  selectedNode: GenealogyNode | null;
};

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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md bg-surface-app p-3">
      <p className="text-xs font-medium text-ink-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-strong">{value}</p>
    </div>
  );
}

// 세대별 막대 색상은 계보 트리(GenealogyTreeView)의 세대 팔레트와 동일하게 맞춘다.
const GENERATION_BAR_COLORS: Record<number, string> = {
  1: "#534AB7",
  2: "#0F6E56",
  3: "#BA7517",
  4: "#993C1D",
};

function generationBarColor(generationNumber: number | null) {
  if (generationNumber !== null && GENERATION_BAR_COLORS[generationNumber]) {
    return GENERATION_BAR_COLORS[generationNumber];
  }

  return "#888780";
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-soft py-2 text-sm last:border-b-0">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right font-medium text-ink-strong">{value}</span>
    </div>
  );
}

function GenerationBar({
  maxCount,
  stat,
}: {
  maxCount: number;
  stat: GenerationStat;
}) {
  const width = maxCount > 0 ? Math.max(8, (stat.profileCount / maxCount) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink-base">
          {stat.generationNumber ? `G${stat.generationNumber}` : "미지정"}
        </span>
        <span className="text-ink-faint">{stat.profileCount}명</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: generationBarColor(stat.generationNumber),
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

function CountrySummary({ country }: { country: CountryStat }) {
  return (
    <div className="rounded-md border border-line-base bg-surface-app p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink-strong">
          {country.countryCode
            ? `${country.countryName} (${country.countryCode})`
            : country.countryName}
        </p>
        <span className="rounded-full bg-surface-card px-2 py-0.5 text-xs text-ink-muted">
          {country.profileCount}명
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        관계 {country.relationshipCount}개 · 코치 {country.coachCount}명 ·
        코치이 {country.coacheeCount}명
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        {country.generationBreakdown
          .map((item) => `${item.label} ${item.profileCount}명`)
          .join(" / ") || "세대 정보 없음"}
      </p>
    </div>
  );
}

function ChurchSummary({ church }: { church: ChurchStat }) {
  return (
    <div className="rounded-md border border-line-base bg-surface-app p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink-strong">{church.churchName}</p>
        <span className="rounded-full bg-surface-card px-2 py-0.5 text-xs text-ink-muted">
          {church.profileCount}명
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        관계 {church.relationshipCount}개 · 코치 {church.coachCount}명 · 코치이{" "}
        {church.coacheeCount}명
      </p>
    </div>
  );
}

export function GenealogyStatsPanel({
  data,
  selectedNode,
}: GenealogyStatsPanelProps) {
  const maxGenerationCount = Math.max(
    0,
    ...data.generationStats.map((stat) => stat.profileCount),
  );
  const topChurches = [...data.churchStats]
    .sort((left, right) => right.profileCount - left.profileCount)
    .slice(0, 5);

  return (
    <aside className="space-y-5">
      <section className="rounded-card border border-line-base bg-surface-card p-5">
        <h2 className="text-base font-semibold">선택 노드 정보</h2>
        {selectedNode ? (
          <div className="mt-4">
            <DetailRow label="이름" value={selectedNode.label} />
            <DetailRow
              label="세대"
              value={generationLabel(selectedNode.generationNumber)}
            />
            <DetailRow label="소속 국가" value={countryLabel(selectedNode)} />
            <DetailRow
              label="소속 기관 및 단체"
              value={displayValue(selectedNode.organizationName)}
            />
            <DetailRow
              label="소속 교회"
              value={displayValue(selectedNode.churchName)}
            />
            <DetailRow
              label="소속 직분"
              value={displayValue(selectedNode.ministryPosition)}
            />
            <DetailRow
              label="시스템 역할"
              value={displayValue(selectedNode.primaryRole)}
            />
            <DetailRow label="담당 코치 수" value={selectedNode.activeCoachCount} />
            <DetailRow
              label="담당 코치이 수"
              value={selectedNode.activeCoacheeCount}
            />
            <DetailRow label="회원 상태" value={selectedNode.status} />
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-surface-app p-4 text-sm text-ink-muted">
            트리에서 노드를 선택하면 상세 정보가 표시됩니다.
          </p>
        )}
      </section>

      <section className="rounded-card border border-line-base bg-surface-card p-5">
        <h2 className="text-base font-semibold">전체 현황</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="전체 코치 수" value={data.summaryStats.totalCoaches} />
          <StatCard
            label="전체 코치이 수"
            value={data.summaryStats.totalCoachees}
          />
          <StatCard
            label="활성 관계 수"
            value={data.summaryStats.totalActiveRelationships}
          />
          <StatCard label="최대 세대" value={data.summaryStats.maxGeneration} />
          <StatCard
            label="활동 국가 수"
            value={data.summaryStats.totalCountries}
          />
          <StatCard
            label="활동 교회 수"
            value={data.summaryStats.totalChurches}
          />
        </div>
      </section>

      <section className="rounded-card border border-line-base bg-surface-card p-5">
        <h2 className="text-base font-semibold">세대별 인원 분포</h2>
        {data.generationStats.length > 0 ? (
          <div className="mt-4 space-y-4">
            {data.generationStats.map((stat) => (
              <GenerationBar
                key={stat.generationNumber ?? "missing"}
                maxCount={maxGenerationCount}
                stat={stat}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">세대 통계가 없습니다.</p>
        )}
      </section>

      <section className="rounded-card border border-line-base bg-surface-card p-5">
        <h2 className="text-base font-semibold">국가별 현황</h2>
        {data.countryStats.length > 0 ? (
          <div className="mt-4 space-y-3">
            {data.countryStats.map((country) => (
              <CountrySummary
                country={country}
                key={country.countryId ?? "missing"}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">국가 통계가 없습니다.</p>
        )}
      </section>

      <section className="rounded-card border border-line-base bg-surface-card p-5">
        <h2 className="text-base font-semibold">교회별 현황</h2>
        {topChurches.length > 0 ? (
          <div className="mt-4 space-y-3">
            {topChurches.map((church) => (
              <ChurchSummary church={church} key={church.churchId ?? "missing"} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">교회 통계가 없습니다.</p>
        )}
      </section>
    </aside>
  );
}
