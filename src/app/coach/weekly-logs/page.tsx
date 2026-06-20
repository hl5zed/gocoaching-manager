import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCoachWeeklyLogs,
  type CoachWeeklyLogEntry,
} from "@/lib/api/coach/weekly-logs";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "임시 저장",
  submitted: "제출됨",
  archived: "보관됨",
};

const RELATIONSHIP_TYPE_LABEL: Record<string, string> = {
  individual_coaching: "개인 코칭",
  group_coaching: "그룹 코칭",
  leadership_coaching: "리더십 코칭",
  pastoral_coaching: "목회 코칭",
  missionary_coaching: "선교사 코칭",
};

function statusLabel(value: string) {
  return STATUS_LABEL[value] ?? value;
}

function relationshipTypeLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return RELATIONSHIP_TYPE_LABEL[value] ?? value;
}

function coacheeName(entry: CoachWeeklyLogEntry) {
  return (
    entry.coachee_display_name ??
    entry.coachee_full_name ??
    entry.coachee_email ??
    "-"
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

export default async function CoachWeeklyLogsPage() {
  const result = await getCoachWeeklyLogs();

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach/weekly-logs");
  }

  if (result.error?.code === "PROFILE_NOT_FOUND") {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800">
            아직 프로필이 생성되지 않았습니다.
          </p>
          <Link
            href="/profile"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            프로필 보기
          </Link>
        </div>
      </main>
    );
  }

  if (result.error) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <div className="mx-auto max-w-5xl">
          <Nav />
          <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            지금 주간 기록을 불러올 수 없습니다.
          </p>
        </div>
      </main>
    );
  }

  const logs = result.data;

  return (
    <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <div className="mx-auto max-w-5xl">
        <Nav />

        <h1 className="mt-6 text-2xl font-semibold">주간 기록</h1>
        <p className="mt-2 text-sm text-ink-muted">
          담당 코치이가 제출한 주간 기록을 확인합니다.
        </p>

        {logs.length === 0 ? (
          <p className="mt-8 rounded-md border border-line-base bg-surface-card px-4 py-6 text-center text-ink-faint">
            아직 확인할 주간 기록이 없습니다.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-line-base bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line-base bg-surface-sunken text-xs font-medium uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">코치이</th>
                  <th className="px-4 py-3">주간 기간</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">관계 유형</th>
                  <th className="px-4 py-3">제출일</th>
                  <th className="px-4 py-3">수정일</th>
                  <th className="px-4 py-3">보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-sunken">
                    <td className="px-4 py-3 font-medium">{coacheeName(entry)}</td>
                    <td className="px-4 py-3">
                      {formatDate(entry.week_start)} ~ {formatDate(entry.week_end)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3">
                      {relationshipTypeLabel(entry.relationship_type)}
                    </td>
                    <td className="px-4 py-3">{formatDate(entry.submitted_at)}</td>
                    <td className="px-4 py-3">{formatDate(entry.updated_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/coach/weekly-logs/${entry.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        상세 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function Nav() {
  return (
    <nav className="flex gap-3 text-sm">
      <Link href="/coach" className="text-blue-600 hover:underline">
        코치 홈
      </Link>
      <span className="text-ink-faint">/</span>
      <Link href="/dashboard" className="text-blue-600 hover:underline">
        대시보드
      </Link>
    </nav>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = "bg-surface-sunken text-ink-muted";

  if (status === "submitted") {
    color = "bg-green-100 text-green-700";
  }

  if (status === "draft") {
    color = "bg-yellow-100 text-yellow-700";
  }

  if (status === "archived") {
    color = "bg-surface-sunken text-ink-faint";
  }

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {statusLabel(status)}
    </span>
  );
}
