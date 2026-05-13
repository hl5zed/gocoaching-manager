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
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
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
        <span className="font-medium text-slate-700">
          {stat.generationNumber ? `G${stat.generationNumber}` : "미지정"}
        </span>
        <span className="text-slate-500">{stat.profileCount}명</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-800"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function CountrySummary({ country }: { country: CountryStat }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">
          {country.countryCode
            ? `${country.countryName} (${country.countryCode})`
            : country.countryName}
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
          {country.profileCount}명
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        관계 {country.relationshipCount}개 · 코치 {country.coachCount}명 ·
        코치이 {country.coacheeCount}명
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {country.generationBreakdown
          .map((item) => `${item.label} ${item.profileCount}명`)
          .join(" / ") || "세대 정보 없음"}
      </p>
    </div>
  );
}

function ChurchSummary({ church }: { church: ChurchStat }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">{church.churchName}</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
          {church.profileCount}명
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600">
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
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">선택 노드 정보</h2>
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
          <p className="mt-3 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            트리에서 노드를 선택하면 상세 정보가 표시됩니다.
          </p>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">전체 현황</h2>
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

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">세대별 인원 분포</h2>
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
          <p className="mt-3 text-sm text-slate-600">세대 통계가 없습니다.</p>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">국가별 현황</h2>
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
          <p className="mt-3 text-sm text-slate-600">국가 통계가 없습니다.</p>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">교회별 현황</h2>
        {topChurches.length > 0 ? (
          <div className="mt-4 space-y-3">
            {topChurches.map((church) => (
              <ChurchSummary church={church} key={church.churchId ?? "missing"} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">교회 통계가 없습니다.</p>
        )}
      </section>
    </aside>
  );
}
